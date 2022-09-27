import * as awsXRay from 'aws-xray-sdk-core';
import * as awssdk from 'aws-sdk';
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import logger from './logger';
import DocDbSecurityCredentials from './definitions';
import { MongoDuplicatesError } from './errors';

const { AWS_STAGE, DB_NAME, TIMEOUT } = process.env;
const AwsSdk = awsXRay.captureAWS(awssdk);
const { SecretsManager } = AwsSdk;

const ca = [fs.readFileSync(path.join(__dirname, '../rds-combined-ca-bundle.pem'))];
const secretsManager = new SecretsManager();
const COLLECTIONS = {
  SALEABLE_COMPONENT: 'accommodation-saleable-components',
  SALEABLE_UNIT: 'accommodation-saleable-units',
};

export default class DocumentDbClient {
  private client: MongoClient;

  async getClient() {
    if (this.client) return this.client;
    try {
      const connString = await DocumentDbClient.getConnectionString();
      const timeoutMS = Number(TIMEOUT) * 1000;
      this.client = await MongoClient.connect(connString, {
        sslValidate: true,
        sslCA: ca,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        poolSize: 1,
        connectTimeoutMS: timeoutMS,
        socketTimeoutMS: timeoutMS
      });
      return this.client;
    } catch (e) {
      logger.error(e);
      throw new Error('Failed to connect to db');
    }
  }

  static async getConnectionString(): Promise<string> {
    if (process.env.IS_LOCAL === 'true') {
      return process.env.MONGO_CONNECTION_STRING;
    }
    const secretName = `/product/${AWS_STAGE}/docdb-credentials`;
    const response = await secretsManager.getSecretValue({ SecretId: secretName }).promise();

    if (!('SecretString' in response)) {
      throw new Error('Failed to get DB credentials');
    }
    const creds: DocDbSecurityCredentials = JSON.parse(response.SecretString);
    return `mongodb://${creds.username}:${creds.password}@${creds.host}:${creds.port}/?ssl=${creds.ssl}&readPreference=secondaryPreferred&retryWrites=false`;
  }

  async saveComponentIfNeeded(record) {
    const documentDbClient = await this.getClient();
    const db = documentDbClient.db(DB_NAME);
    const collection = db.collection(COLLECTIONS.SALEABLE_COMPONENT);
    await collection.createIndex({ 'sourcedComponentData.id': 1 }, { unique: true });
    await collection.createIndex({ baselineComponentId: 1 }, { unique: true });

    logger.info(`Creating new saleable component with id: ${record.sourcedComponentData.id}`);
    try {
      return await collection.insertOne(record);
    } catch (error) {
      // if it's mongo error 11k: duplicate key error saleable component already exists for given baseline component
      if (typeof error === 'object' && error.name === 'MongoError' && error.code === 11000) {
        logger.error('Skip creating SaleableComponent because of duplication.');
        logger.error(`BaselineComponentId: ${record.baselineComponentId}. SourcedComponentId:${record.sourcedComponentData.id}`);
        throw new MongoDuplicatesError();
      }
      throw error;
    }
  }

  async updateComponent(record) {
    const documentDbClient = await this.getClient();
    const db = documentDbClient.db(DB_NAME);
    const collection = db.collection(COLLECTIONS.SALEABLE_COMPONENT);

    logger.info(`Updating saleable component with id: ${record.sourcedComponentData.id}`);
    await collection.updateOne({ 'sourcedComponentData.id': record.sourcedComponentData.id }, { $set: record });
    await collection.updateOne({ 'sourcedComponentData.id': record.sourcedComponentData.id }, { $unset: { inactiveReason: 1 } });
  }

  async saveUnitIfNeeded(record) {
    const documentDbClient = await this.getClient();
    const db = documentDbClient.db(DB_NAME);
    const collection = db.collection(COLLECTIONS.SALEABLE_UNIT);
    await collection.createIndex({ 'sourcedUnitData.roomTypeId': 1 }, { unique: true });
    await collection.createIndex({ baselineUnitId: 1 }, { unique: true });

    logger.info(`Creating new saleable unit with room type id: ${record.sourcedUnitData.roomTypeId}`);
    try {
      return await collection.insertOne(record);
    } catch (error) {
      // if it's mongo error 11k: duplicate key error saleable component already exists for given baseline component
      if (typeof error === 'object' && error.name === 'MongoError' && error.code === 11000) {
        logger.error('Skip creating SaleableUnit because of duplication.');
        logger.error(`BaselineUnitId: ${record.baselineUnitId}. RoomTypeId:${record.sourcedUnitData.roomTypeId}`);
        throw new MongoDuplicatesError();
      }
      throw error;
    }
  }

  async updateUnit(record) {
    const documentDbClient = await this.getClient();
    const db = documentDbClient.db(DB_NAME);
    const collection = db.collection(COLLECTIONS.SALEABLE_UNIT);

    logger.info(`Updating saleable unit with id: ${record.sourcedUnitData.roomTypeId}`);

    await collection.updateOne({ 'sourcedUnitData.roomTypeId': record.sourcedUnitData.roomTypeId }, { $set: record });
  }

  async loadComponentByBaselineId(baselineId: string) {
    const documentDbClient = await this.getClient();
    const db = documentDbClient.db(DB_NAME);

    return db.collection(COLLECTIONS.SALEABLE_COMPONENT).findOne({ baselineComponentId: baselineId }, { projection: { _id: 0 } });
  }

  async loadUnitByBaselineId(baselineId: string) {
    const documentDbClient = await this.getClient();
    const db = documentDbClient.db(DB_NAME);

    return db.collection(COLLECTIONS.SALEABLE_UNIT).findOne({ baselineUnitId: baselineId }, { projection: { _id: 0 } });
  }

  async loadUnitsBySaleableComponentId(saleableComponentId: string) {
    const documentDbClient = await this.getClient();
    const db = documentDbClient.db(DB_NAME);

    return db.collection(COLLECTIONS.SALEABLE_UNIT).find({ saleableComponentId }, { projection: { _id: 0 } }).toArray();
  }
}

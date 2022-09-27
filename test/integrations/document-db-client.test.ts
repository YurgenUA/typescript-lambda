import { Db, MongoClient } from 'mongodb';
import { SecretsManager } from 'aws-sdk';
import { GenericContainer } from 'testcontainers';
import DocumentDbClient from '../../src/document-db-client';
import logger from '../../src/logger';
import { MongoDuplicatesError } from '../../src/errors';
import { testables } from '../../src';

const event = require('../events/accommodation-baseline-event.json');
const predefinedBaselineComponents = require('../fixtures/saleable-components');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
let db: Db;
let documentDbClient: DocumentDbClient;
let mongoClient: MongoClient;

async function populateCollections() {
  const col = db.collection('accommodation-saleable-components');
  const result = await col.insertMany(predefinedBaselineComponents);
  logger.debug(`populateCollections result: ${JSON.stringify(result)}`);
}

async function clearCollections() {
  const col = db.collection('accommodation-saleable-components');
  const result = await col.deleteMany({});
  logger.debug(`clearCollections result: ${result}`);
}

describe('handler', () => {
  let container;

  beforeAll(async () => {
    SecretsManager.prototype.getSecretValue = jest.fn()
      .mockReturnValue({ promise: () => Promise.resolve({ SecretString: '{}' }) });
    try {
      const MONGO_PORT = Number(process.env.MONGO_PORT);
      container = await new GenericContainer('mongo:3.6.23').withExposedPorts(MONGO_PORT).start();
      const port = container.getMappedPort(MONGO_PORT);
      const host = container.getHost();
      process.env.MONGO_CONNECTION_STRING = `mongodb://${host}:${port}`;

      documentDbClient = testables.dbClient;// new DocumentDbClient();
      mongoClient = await documentDbClient.getClient();
      db = mongoClient.db(process.env.DB_NAME);
    } catch (e) {
      logger.error('failed before all:', JSON.stringify(e));
    }
  });

  afterAll(async () => {
    try {
      await mongoClient.close();
      await container.stop();
    } catch (e) {
      logger.error('failed after all:', JSON.stringify(e));
    }
  });

  it('result from loadComponentByBaselineId method should not has _id attribute', async () => {
    await populateCollections();
    const result = await documentDbClient.loadComponentByBaselineId(event.data.component.baselineComponentId);
    await clearCollections();
    // eslint-disable-next-line no-underscore-dangle
    expect(result._id).toBeUndefined();
    expect(result.baselineComponentId).toBe(event.data.component.baselineComponentId);
  });

  it('attempt to save an existing component should throw an 1100 error code', async () => {
    await populateCollections();
    const e = await documentDbClient.saveComponentIfNeeded(predefinedBaselineComponents[0]).catch((err) => err);
    await clearCollections();
    expect(e).toBeInstanceOf(MongoDuplicatesError);
  });
});

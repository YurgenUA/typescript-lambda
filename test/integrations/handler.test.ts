import { Db, MongoClient } from 'mongodb';
import { SecretsManager, SNS, SQS } from 'aws-sdk';
import { SQSEvent, SQSRecord } from 'aws-lambda';
import { GenericContainer } from 'testcontainers';
import { handler, testables } from '../../src';
import DocumentDbClient from '../../src/document-db-client';
import logger from '../../src/logger';

const event = require('../events/accommodation-baseline-event.json');

const createRecord = ({ body = '' }: Partial<SQSRecord>): SQSRecord => ({ body } as SQSRecord);

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
let db: Db;
let documentDbClient: DocumentDbClient;
let mongoClient: MongoClient;

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

      documentDbClient = testables.dbClient;
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

  it('should not return an error of duplication when attempt to save an existing component', async () => {
    SNS.prototype.publish = jest.fn().mockReturnValue({ promise: () => Promise.resolve({ MessageId: '' }) });
    SQS.prototype.sendMessage = jest.fn().mockReturnValue({ promise: () => Promise.resolve() });
    const spy = jest.spyOn(testables.dbClient, 'saveComponentIfNeeded')
      .mockRejectedValue({ name: 'MongoError', code: 11000 });

    const record: SQSRecord = createRecord({ body: JSON.stringify(event) });
    const sqsEvent: SQSEvent = { Records: [record] };

    const e = await handler(sqsEvent).catch((err) => err);
    spy.mockRestore();

    // we just ignore message if we got controlled duplicates
    expect(e).toBe('OK');
  });

  it('handler should return OK', async () => {
    SNS.prototype.publish = jest.fn().mockReturnValue({ promise: () => Promise.resolve({ MessageId: '' }) });
    SQS.prototype.sendMessage = jest.fn().mockReturnValue({ promise: () => Promise.resolve() });

    const record: SQSRecord = createRecord({ body: JSON.stringify(event) });
    const sqsEvent: SQSEvent = {
      Records: [
        record
      ]
    };
    const res = await handler(sqsEvent);
    await clearCollections();
    expect(SQS.prototype.sendMessage).toHaveBeenCalledTimes(0);
    expect(res).toBe('OK');
  });
});

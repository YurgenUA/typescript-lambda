import { SecretsManager, SNS, SQS } from 'aws-sdk';

import DocumentDbClient from '../src/document-db-client';
import DocDbSecurityCredentials from '../src/definitions';

describe('Lambda handler tests', () => {
  beforeEach(async () => {
    (SQS.prototype.sendMessage as jest.Mock) = jest.fn((input: any) => ({ promise: () => Promise.resolve() }));
    (SNS.prototype.publish as jest.Mock) = jest.fn((input: any) => ({ promise: () => Promise.resolve() }));
  });

  test('DocumentDbClient getConnectionString ok', async () => {
    const { IS_LOCAL } = process.env;
    let connectionString = await DocumentDbClient.getConnectionString();
    expect(connectionString).toBe('mongodb://127.0.0.1:27017');

    process.env.IS_LOCAL = 'false';
    const fakeCreds: DocDbSecurityCredentials = {
      username: 'username',
      password: 'password',
      host: 'host',
      engine: 'engine',
      dbClusterIdentifier: 'dbClusterIdentifier',
      port: 'port',
      ssl: false
    };
    SecretsManager.prototype.getSecretValue = jest.fn()
      .mockReturnValue({ promise: () => Promise.resolve({ SecretString: JSON.stringify(fakeCreds) }) });
    connectionString = await DocumentDbClient.getConnectionString();
    expect(connectionString).toBe('mongodb://username:password@host:port/?ssl=false&readPreference=secondaryPreferred&retryWrites=false');
    process.env.IS_LOCAL = IS_LOCAL;
  });
});

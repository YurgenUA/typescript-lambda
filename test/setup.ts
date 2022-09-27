process.env.AWS_REGION = 'eu-central-1';
process.env.AWS_DEFAULT_REGION = 'eu-central-1';
process.env.STAGE = 'dev';
process.env.SQS_DLQ = 'product-dev-accommodation-saleable-dlq';
process.env.IS_LOCAL = 'true';
process.env.LOG_LEVEL = 'info';
process.env.DB_NAME = 'product-database';
process.env.MONGO_PORT = '27017';
// this var will be overwritten in integration test by docker initialization
process.env.MONGO_CONNECTION_STRING = `mongodb://127.0.0.1:${process.env.MONGO_PORT}`;
process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';
process.env.TIMEOUT = '100';

jest.mock('aws-sdk');

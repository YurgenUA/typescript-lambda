import { SNS, Request } from 'aws-sdk';
import { publishSnsTopic } from '../src/sns-client';

describe('Lambda handler tests', () => {
  test('publishSnsTopic ok', async () => {
    SNS.prototype.publish = jest.fn((input: any) => {
      expect(input.Message).toBe('"my message"');
      const resp: any = new Request(input, 'getSecretValue');
      resp.promise = () => ({
        MessageId: '#1',
      });
      return resp;
    });
    await publishSnsTopic('my message');
  });

  test('publishSnsTopic failed', async () => {
    SNS.prototype.publish = jest.fn((input: any) => {
      const resp: any = new Request(input, 'getSecretValue');
      resp.promise = () => { throw new Error('No AWS'); };
      return resp;
    });
    expect.assertions(1);
    try {
      await publishSnsTopic('my message');
    } catch (e) {
      expect(e).toMatchObject(new Error('No AWS'));
    }
  });
});

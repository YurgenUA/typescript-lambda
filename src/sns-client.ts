import * as awsXRay from 'aws-xray-sdk-core';
import * as awssdk from 'aws-sdk';
import logger from './logger';

const AwsSdk = awsXRay.captureAWS(awssdk);
const { SNS } = AwsSdk;
const sns = new SNS();
export async function publishSnsTopic(message: any): Promise<void> {
  const params = {
    Message: JSON.stringify(message),
    TopicArn: process.env.OUTPUT_TOPIC,
  };

  try {
    const response = await sns.publish(params).promise();

    logger.info(`Published MessageId: ${response.MessageId}`);
  } catch (error) {
    logger.error('PublishSnsTopic failed', error);
    throw error;
  }
}

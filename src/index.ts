import { SQSEvent, SQSRecord } from 'aws-lambda';
import * as awsSdk from 'aws-sdk';
import * as awsXRay from 'aws-xray-sdk-core';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger';
import AccommodationInputModel, { IncomingMessage } from './model/accommodationInputModel';
import { createGeographies, createSaleableComponent, createSaleableUnit } from './mapping';

import DocumentDbClient from './document-db-client';
import { validateAgainstSchema } from './validations';
import { AccommodationSaleableComponent } from './model/generated/AccommodationSaleableComponent';
import { publishSnsTopic } from './sns-client';
import { AccommodationSaleableUnit } from './model/generated/AccommodationSaleableUnit';
import { MongoDuplicatesError } from './errors';
import { formatOutputMessage, getLoggingContext, withLoggingContext } from './utils';

const componentSchema = require('../schema/AccommodationSaleableComponentSchema.json');
const unitSchema = require('../schema/AccommodationSaleableUnitSchema.json');

const { SQS } = awsXRay.captureAWS(awsSdk);
const sqs = new SQS();

const dbClient = new DocumentDbClient();

function prepareMessageForSending(component: AccommodationSaleableComponent, units: AccommodationSaleableUnit[]) {
  const saleableComponent = component;
  delete saleableComponent['_id']; // eslint-disable-line @typescript-eslint/dot-notation
  const saleableUnits: any[] = units.map((unit: any) => {
    const patchedUnit = unit;
    delete patchedUnit['_id']; // eslint-disable-line @typescript-eslint/dot-notation
    return patchedUnit;
  });

  return formatOutputMessage(getLoggingContext(), { component: saleableComponent, units: saleableUnits });
}

async function processRecord(record: SQSRecord) {
  try {
    const incomingMessage: IncomingMessage = JSON.parse(record.body);
    const correlationId = incomingMessage.metadata?.correlationId || uuidv4();
    return await withLoggingContext(async () => {
      try {
        await processSingleRecord(incomingMessage.data);
      } catch (error) {
        if (error instanceof MongoDuplicatesError) {
          throw error;
        }
        logger.error('Failed to process message', error);
        await sqs.sendMessage({ QueueUrl: process.env.SQS_DLQ, MessageBody: record.body }).promise();
      }
    }, correlationId);
  } catch (e) {
    logger.error(`Process failed with error ${e.message}`);
    throw e;
  }
}

async function processSingleRecord(inputData: AccommodationInputModel) {
  logger.info(`Received baseline accommodation component ${inputData.component.baselineComponentId}`);
  logger.info(`Accommodation id is ${inputData.component.sourcedComponentData?.id}`);
  logger.info(`Received ${inputData.units?.length} baseline accommodation units`);
  for (const unit of inputData.units || []) {
    logger.info(`Received baseline accommodation unit ${unit.baselineUnitId}`);
    logger.info(`RoomTypeId is ${unit.sourcedUnitData?.roomTypeId}`);
  }
  const saleableUnits = [];
  const tasks = [];

  let saleableComponent: AccommodationSaleableComponent = await dbClient.loadComponentByBaselineId(inputData.component.baselineComponentId);

  if (!saleableComponent) {
    logger.info(`Saleable component does not exist for baseline component ${inputData.component?.baselineComponentId}. Creating new.`);
    saleableComponent = createSaleableComponent(inputData);

    const validationErrors = validateAgainstSchema(saleableComponent, componentSchema);
    if (validationErrors) {
      throw Error(validationErrors);
    }

    await dbClient.saveComponentIfNeeded(saleableComponent);
    logger.info(`Stored saleable accommodation component ${saleableComponent.saleableComponentId}`);
  } else {
    logger.info(`Loaded existing saleable component ${saleableComponent.saleableComponentId}`);
    if (saleableComponent.entityStatus === 'INACTIVE' && inputData.geographies && inputData.geographies.length === 1) {
      logger.info(`Saleable component ${saleableComponent.saleableComponentId} was inactive and geographies arrived - need to update`);
      saleableComponent.entityStatus = 'ACTIVE';
      saleableComponent.saleableComponentVersion += 1;
      const geographies = createGeographies(inputData.geographies[0]);
      saleableComponent.accommodationComponent.geographies = {
        structuralLocations: geographies.structuralLocations
      };
      if (geographies.logicalLocations) {
        saleableComponent.accommodationComponent.geographies.logicalLocations = geographies.logicalLocations;
      }
      if (geographies.isServedBy) {
        saleableComponent.accommodationComponent.geographies.isServedBy = geographies.isServedBy;
      }
      await dbClient.updateComponent(saleableComponent);
      logger.info(`Updated geography on saleable component ${saleableComponent.saleableComponentId}`);

      const existingUnits: AccommodationSaleableUnit[] = await dbClient.loadUnitsBySaleableComponentId(saleableComponent.saleableComponentId);
      if (existingUnits) {
        for (const existingUnit of existingUnits) {
          existingUnit.entityStatus = 'ACTIVE';
          existingUnit.saleableUnitVersion += 1;
          tasks.push(dbClient.updateUnit(existingUnit));
          logger.info(`Updated geography on saleable unit ${existingUnit.saleableUnitId}`);
        }
      }
    }
  }

  const errors = [];
  if (inputData.units) {
    for (const input of inputData.units) {
      // eslint-disable-next-line no-await-in-loop
      let saleableUnit: AccommodationSaleableUnit = await dbClient.loadUnitByBaselineId(input.baselineUnitId);

      if (!saleableUnit) {
        saleableUnit = createSaleableUnit(input, inputData.geographies, saleableComponent.saleableComponentId);

        const validationErrors = validateAgainstSchema(saleableUnit, unitSchema);

        if (validationErrors) {
          errors.push(Error(validationErrors));
        }
        tasks.push(dbClient.saveUnitIfNeeded(saleableUnit));
        logger.info(`Created new saleable unit ${saleableUnit.saleableUnitId}`);
        logger.info(`RoomTypeId ${saleableUnit.sourcedUnitData?.roomTypeId}`);
      } else {
        logger.info(`Loaded existing saleable unit ${saleableUnit.saleableUnitId}`);
        logger.info(`RoomTypeId ${saleableUnit.sourcedUnitData?.roomTypeId}`);
      }

      saleableUnits.push(saleableUnit);
    }
  }

  if (errors.length > 0) {
    throw errors[0];
  }

  if (tasks.length === 0) {
    // do not need further processing if no units were created
    logger.info('Stop processing current event as no units were created.');
    return;
  }

  await Promise.all(tasks);

  if (saleableComponent.entityStatus === 'ACTIVE') {
    logger.info(`Sending out to SNS saleable component ${saleableComponent.saleableComponentId}`);
    for (const saleableUnit of saleableUnits) {
      logger.info(`Sending out to SNS saleable unit ${saleableUnit.saleableUnitId}`);
    }
    await publishSnsTopic(prepareMessageForSending(saleableComponent, saleableUnits));
  } else {
    logger.info(`saleable component and units will not be sent. Component is not active. Reasons: ${saleableComponent.inactiveReason}`);
  }
}

export async function handler(event: SQSEvent) {
  try {
    logger.info('event', event);
    logger.info(`Received [${event?.Records?.length}] records from SQS`);

    const tasks = event.Records.map((record) => processRecord(record));

    await Promise.all(tasks);
    return 'OK';
  } catch (error) {
    logger.error('Lambda execution failed', error);
    throw error;
  }
}

export const testables = {
  prepareMessageForSending,
  processRecord,
  dbClient,
};

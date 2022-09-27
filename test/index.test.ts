import { SQSEvent, SQSRecord } from 'aws-lambda';
import { Request, SNS, SQS } from 'aws-sdk';
import { handler, testables } from '../src/index';
import * as mapping from '../src/mapping';
import * as validations from '../src/validations';
import DocumentDbClient from '../src/document-db-client';

jest.mock('../src/document-db-client');

export const createRecord = ({ body = '' }: Partial<SQSRecord>): SQSRecord => ({
  body
} as SQSRecord);

describe('Lambda handler tests', () => {
  beforeEach(async () => {
    (SQS.prototype.sendMessage as jest.Mock) = jest.fn((input: any) => ({ promise: () => Promise.resolve() }));
    (SNS.prototype.publish as jest.Mock) = jest.fn((input: any) => ({ promise: () => Promise.resolve() }));
  });

  const event = require('./events/accommodation-baseline-event.json');

  test('prepareMessageForSending ok', async () => {
    const component = { creationDate: new Date('2020-01-01T01:01:01.333Z'), _id: 'id1 to remove' } as any;
    const units = [{ creationDate: new Date('2020-01-01T01:01:01.444Z'), _id: 'id2 to remove' } as any];
    expect(testables.prepareMessageForSending(component, units)).toMatchObject({
      data: {
        component: {
          creationDate: new Date('2020-01-01T01:01:01.333Z'),
        },
        units: [{
          creationDate: new Date('2020-01-01T01:01:01.444Z'),
        }]
      }
    });
  });

  test('processRecord ok', async () => {
    expect.assertions(3);
    SNS.prototype.publish = jest.fn((input: any) => {
      const { component, units } = JSON.parse(input.Message).data;
      const { correlationId } = JSON.parse(input.Message).metadata;
      expect(component.baselineComponentId).toBe(event.data.component.baselineComponentId);
      expect(units[0].baselineUnitId).toBe(event.data.units[0].baselineUnitId);
      expect(correlationId).toBe('correlationId #1');

      const resp: any = new Request(input, 'getSecretValue');
      resp.promise = () => ({
        MessageId: '#1',
      });
      return resp;
    });

    event.metadata.correlationId = 'correlationId #1';
    const record = createRecord({ body: JSON.stringify(event) });
    await testables.processRecord(record);
  });

  test('handler ok', async () => {
    expect.assertions(2);
    SNS.prototype.publish = jest.fn((input: any) => {
      const { component, units } = JSON.parse(input.Message).data;
      expect(component.baselineComponentId).toBe(event.data.component.baselineComponentId);
      expect(units[0].baselineUnitId).toBe(event.data.units[0].baselineUnitId);

      const resp: any = new Request(input, 'getSecretValue');
      resp.promise = () => ({
        MessageId: '#1',
      });
      return resp;
    });

    const record: SQSRecord = createRecord({ body: JSON.stringify(event) });
    const sqsEvent: SQSEvent = {
      Records: [
        record
      ]
    };
    await handler(sqsEvent);
  });

  test('handler no correlationId -> create and add to output message ok', async () => {
    expect.assertions(1);
    SNS.prototype.publish = jest.fn((input: any) => {
      const { correlationId } = JSON.parse(input.Message).metadata;
      expect(correlationId).toBeDefined();

      const resp: any = new Request(input, 'getSecretValue');
      resp.promise = () => ({
        MessageId: '#1',
      });
      return resp;
    });
    Reflect.deleteProperty(event, 'correlationId');
    const record: SQSRecord = createRecord({ body: JSON.stringify(event) });
    const sqsEvent: SQSEvent = {
      Records: [
        record
      ]
    };
    await handler(sqsEvent);
  });

  test('handler failed with component validation error', async () => {
    const createSaleableComponent = jest.spyOn(mapping, 'createSaleableComponent');
    const createSaleableUnit = jest.spyOn(mapping, 'createSaleableUnit');

    SNS.prototype.publish = jest.fn((input: any) => {
      const { component, units } = JSON.parse(input.Message).data;
      expect(component.baselineComponentId).toBe(event.data.component.baselineComponentId);
      expect(units[0].baselineUnitId).toBe(event.data.units[0].baselineUnitId);

      const resp: any = new Request(input, 'getSecretValue');
      resp.promise = () => ({
        MessageId: '#1',
      });
      return resp;
    });

    const record: SQSRecord = createRecord({ body: JSON.stringify(event) });
    const invalidEvent = {
      data: {
        component: {},
        geography: {}
      },
      metadata: {
        correlationId: 'correlationId #1',
      }
    };
    const invalidRecord: SQSRecord = createRecord({ body: JSON.stringify(invalidEvent) });
    const screwedEvent: SQSEvent = {
      Records: [
        record,
        invalidRecord
      ]
    };

    await handler(screwedEvent).catch((err) => err);

    expect(createSaleableComponent as jest.SpyInstance).toHaveBeenCalledTimes(2);
    expect(createSaleableComponent as jest.SpyInstance).toHaveBeenNthCalledWith(1, JSON.parse(screwedEvent.Records[0].body).data);
    expect(createSaleableComponent as jest.SpyInstance).toHaveBeenNthCalledWith(2, { component: {}, geography: {} });

    const saleableComponentIdFromFirstCall = createSaleableComponent.mock.results[0].value.saleableComponentId;
    expect(createSaleableUnit as jest.SpyInstance).toHaveBeenCalledTimes(1);
    expect(createSaleableUnit as jest.SpyInstance).toHaveBeenNthCalledWith(
      1,
      JSON.parse(screwedEvent.Records[0].body).data.units[0],
      JSON.parse(screwedEvent.Records[0].body).data.geographies,
      saleableComponentIdFromFirstCall
    );

    expect(SQS.prototype.sendMessage).toHaveBeenCalledTimes(1);
    expect(SQS.prototype.sendMessage)
      .toHaveBeenCalledWith({
        MessageBody: '{"data":{"component":{},"geography":{}},"metadata":{"correlationId":"correlationId #1"}}',
        QueueUrl: 'product-dev-accommodation-saleable-dlq'
      });
  });

  test('handler failed with unit validation error', async () => {
    const createSaleableComponent = jest.spyOn(mapping, 'createSaleableComponent');
    const createSaleableUnit = jest.spyOn(mapping, 'createSaleableUnit');

    const etalonInputMessage = {
      data: {
        component: event.data.component,
        units: [{}],
        geographies: event.data.geographies
      },
    };

    const invalidRecord: SQSRecord = createRecord({ body: JSON.stringify(etalonInputMessage) });
    const screwedEvent: SQSEvent = {
      Records: [
        invalidRecord
      ]
    };

    await handler(screwedEvent).catch((err) => err);

    expect(createSaleableComponent as jest.SpyInstance).toHaveBeenCalled();
    expect(createSaleableComponent as jest.SpyInstance).toHaveBeenCalledWith(etalonInputMessage.data);

    const { saleableComponentId } = createSaleableComponent.mock.results[0].value;
    expect(createSaleableUnit as jest.SpyInstance).toHaveBeenCalledTimes(1);
    expect(createSaleableUnit as jest.SpyInstance).toHaveBeenNthCalledWith(
      1,
      JSON.parse(screwedEvent.Records[0].body).data.units[0],
      JSON.parse(screwedEvent.Records[0].body).data.geographies,
      saleableComponentId
    );
    expect(SQS.prototype.sendMessage).toHaveBeenCalledTimes(1);
    expect(SQS.prototype.sendMessage).toHaveBeenCalledWith({
      QueueUrl: 'product-dev-accommodation-saleable-dlq',
      MessageBody: JSON.stringify(etalonInputMessage)
    });
  });

  test('handler failed with unexpected error', async () => {
    const createSaleableComponent = jest.spyOn(mapping, 'createSaleableComponent');
    const createSaleableUnit = jest.spyOn(mapping, 'createSaleableUnit');
    const screwedEvent = {};
    await handler(screwedEvent as SQSEvent).catch((err) => err);

    expect((createSaleableComponent as jest.SpyInstance)).toHaveBeenCalledTimes(0);
    expect((createSaleableUnit as jest.SpyInstance)).toHaveBeenCalledTimes(0);
    expect(SQS.prototype.sendMessage).toHaveBeenCalledTimes(0);
    expect(SNS.prototype.publish).toHaveBeenCalledTimes(0);
  });

  test('processRecord use existing Component ok', async () => {
    testables.dbClient.loadComponentByBaselineId = jest.fn().mockResolvedValue({
      baselineComponentId: event.data.component.baselineComponentId,
      saleableComponentId: 'existingSaleableComponentId',
      entityStatus: 'ACTIVE'
    });

    const createSaleableComponent = jest.spyOn(mapping, 'createSaleableComponent');
    expect.assertions(3);
    SNS.prototype.publish = jest.fn((input: any) => {
      const { component, units } = JSON.parse(input.Message).data;
      expect(component.baselineComponentId).toBe(event.data.component.baselineComponentId);
      expect(units[0].baselineUnitId).toBe(event.data.units[0].baselineUnitId);

      const resp: any = new Request(input, 'getSecretValue');
      resp.promise = () => ({
        MessageId: '#1',
      });
      return resp;
    });

    const record: SQSRecord = createRecord({ body: JSON.stringify(event) });
    await testables.processRecord(record);
    expect(createSaleableComponent as jest.SpyInstance).not.toHaveBeenCalled();
  });

  test('processRecord use existing inactive Component ok', async () => {
    testables.dbClient.loadComponentByBaselineId = jest.fn().mockResolvedValue({
      baselineComponentId: event.data.component.baselineComponentId,
      saleableComponentId: 'existingSaleableComponentId',
      entityStatus: 'INACTIVE',
      accommodationComponent: {
        geographies: {}
      }
    });
    testables.dbClient.loadUnitsBySaleableComponentId = jest.fn().mockResolvedValue([{
      baselineComponentId: event.data.component.baselineComponentId,
      baselineUnitId: '338fea8d-4de4-4ef2-87d6-b9aeeea7a901',
      entityStatus: 'INACTIVE',
      sourcedUnitData: {
        sourcingCategory: 'CONTRACTED'
      }
    }]);

    const createSaleableComponent = jest.spyOn(mapping, 'createSaleableComponent');
    SNS.prototype.publish = jest.fn((input: any) => {
      const { component, units } = JSON.parse(input.Message).data;
      expect(component.baselineComponentId).toBe(event.data.component.baselineComponentId);
      expect(units[0].baselineUnitId).toBe(event.data.units[0].baselineUnitId);

      const resp: any = new Request(input, 'getSecretValue');
      resp.promise = () => ({
        MessageId: '#1',
      });
      return resp;
    });

    const record: SQSRecord = createRecord({ body: JSON.stringify(event) });
    await testables.processRecord(record);
    expect(createSaleableComponent as jest.SpyInstance).not.toHaveBeenCalled();
    expect(DocumentDbClient.prototype.updateComponent).toBeCalled();
    expect(DocumentDbClient.prototype.updateUnit).toBeCalled();
  });

  test('saleable component validated before saving when resort not found', async () => {
    // given
    delete event.geographies;
    const record: SQSRecord = createRecord({ body: JSON.stringify(event) });
    testables.dbClient.loadComponentByBaselineId = jest.fn().mockResolvedValue(null);
    const createSaleableComponent = jest.spyOn(mapping, 'createSaleableComponent');
    const validateAgainstSchema = jest.spyOn(validations, 'validateAgainstSchema');
    // when
    await testables.processRecord(record);
    // then
    expect((createSaleableComponent as jest.SpyInstance)).toHaveBeenCalled();
    expect((validateAgainstSchema as jest.SpyInstance)).toBeCalledTimes(2);
  });

  test('saleable component saved when resort not found', async () => {
    // given
    delete event.geographies;
    const record: SQSRecord = createRecord({ body: JSON.stringify(event) });
    testables.dbClient.loadComponentByBaselineId = jest.fn().mockResolvedValue(null);
    // when
    await testables.processRecord(record);
    // then
    expect(DocumentDbClient.prototype.saveComponentIfNeeded).toBeCalled();
  });

  test('saleable component and units not published to SNS when resort not found', async () => {
    // given
    delete event.data.geographies;
    const record: SQSRecord = createRecord({ body: JSON.stringify(event) });
    DocumentDbClient.prototype.loadComponentByBaselineId = jest.fn().mockResolvedValue(null);
    // when
    await testables.processRecord(record);
    // then
    expect(SQS.prototype.sendMessage).toHaveBeenCalledTimes(0);
  });
});

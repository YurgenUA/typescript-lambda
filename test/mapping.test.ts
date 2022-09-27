import MockDate from 'mockdate';
import * as uuid from 'uuid';
import { createSaleableComponent, createSaleableUnit } from '../src/mapping';
import AccommodationInputModel from '../src/model/accommodationInputModel';
import { validateAgainstSchema } from '../src/validations';
import { AccommodationBaselineUnit } from '../src/model/generated/AccommodationBaselineUnit';

const componentSchema = require('../schema/AccommodationSaleableComponentSchema.json');

jest.mock('uuid', () => ({
  ...jest.requireActual('uuid')
}));

describe('mapping tests', () => {
  const event = require('./events/accommodation-baseline-event.json');
  let inputModel: AccommodationInputModel;
  let uuidMock = jest.spyOn(uuid, 'v4').mockReturnValue('initial-mocked-id');

  afterEach(() => {
    uuidMock.mockRestore();
    MockDate.reset();
  });

  beforeEach(() => {
    const eventJson: string = JSON.stringify(event.data);
    inputModel = JSON.parse(eventJson);
  });

  test('component should pass validation', async () => {
    uuidMock = jest.spyOn(uuid, 'v4').mockReturnValue('91363994-df46-489e-8915-e395e28283b6');
    MockDate.set('2021-02-26T10:25:11.801Z');

    const saleableComponent = createSaleableComponent(inputModel);
    const validationErrors = validateAgainstSchema(saleableComponent, componentSchema);

    expect(saleableComponent).toMatchSnapshot();
    expect(validationErrors).toBeNull();
  });

  test('component is inactive when resort not found', async () => {
    // given
    delete inputModel.geographies;
    // when
    const saleableComponent = createSaleableComponent(inputModel);
    // then
    expect(saleableComponent.entityStatus).toBe('INACTIVE');
  });

  test('createSaleableComponent has geography', async () => {
    const input = {
      component: {
        accommodationComponent: {},
        sourcedComponentData: {},
      },
      units: [],
      geographies: [{
        country: {
          id: 'countryId',
          names: [{ name: 'countryName' }],
          code: 'CC',
        },
        destination: {
          id: 'destinationId',
          names: [{ name: 'destinationName' }],
        },
        resort: {
          id: 'resortId',
          names: [{ name: 'resortName' }],
        }
      }]
    } as AccommodationInputModel;
    const output = createSaleableComponent(input);

    expect(output.accommodationComponent.geographies.structuralLocations[0]).toStrictEqual({
      country: {
        id: 'countryId',
        names: [{ name: 'countryName' }],
        code: 'CC'
      },
      destination: {
        id: 'destinationId',
        names: [{ name: 'destinationName' }]
      },
      resort: {
        id: 'resortId',
        names: [{ name: 'resortName' }]
      }
    });
    expect(output.accommodationComponent.geographies.logicalLocations).toBeUndefined();
  });

  test('createSaleableComponent overwrite creationTimeStamp', async () => {
    const newCentury = new Date(2000, 1, 1);
    const input = {
      component: {
        creationTimeStamp: newCentury.toISOString(),
        accommodationComponent: {},
        sourcedComponentData: {},
        baselineComponentId: 'any',
        baselineComponentVersion: 1
      },
      units: [],
      geographies: [{
        country: {
          id: 'countryId',
        },
        destination: {
          id: 'destinationId',
        },
        resort: {
          id: 'resortId',
        }
      }]
    } as unknown as AccommodationInputModel;
    const output = createSaleableComponent(input);

    expect(output.creationTimeStamp).not.toBe(newCentury);
  });

  test('createSaleableComponent removes null & undefined properties', async () => {
    const input = {
      component: {
        accommodationComponent: {
          chains: null
        },
        sourcedComponentData: {},
      },
      units: [],
      geographies: [{
        country: {
          id: 'countryId',
        },
        destination: {
          id: 'destinationId',
        },
        resort: {
          id: 'resortId',
        },
        logicalLocations: undefined,
      }]
    } as AccommodationInputModel;
    const output = createSaleableComponent(input);

    expect(output.accommodationComponent).not.toHaveProperty('chains');
    expect(output.accommodationComponent.geographies).not.toHaveProperty('logicalLocations');
  });

  test('createSaleableUnits has saleableComponentId', async () => {
    const input = {
      accommodationUnit: {},
      sourcedUnitData: { roomTypeName: 'Test1' }
    } as AccommodationBaselineUnit;

    const output = createSaleableUnit(input, null, '42');
    expect(output).not.toBeNull();
    expect(output.saleableComponentId).toBe('42');
  });

  test('createSaleableUnits overwrite creationTimeStamp', async () => {
    const newCentury = new Date(2000, 1, 1);
    const input = {
      creationTimeStamp: newCentury.toISOString(),
      accommodationUnit: {},
      sourcedUnitData: { roomTypeName: 'Test1' },
      baselineUnitId: 'any',
      baselineUnitVersion: 1
    } as unknown as AccommodationBaselineUnit;
    const output = createSaleableUnit(input, null, '42');

    expect(output).not.toBeNull();
    expect(output.creationTimeStamp).not.toBe(newCentury);
  });

  test('createSaleableUnits has supplier', async () => {
    const input = {
      sourcedUnitData: {
        supplier: 'supplier',
        subSupplier: 'subSupplier',
      },
      accommodationUnit: {},
    } as AccommodationBaselineUnit;

    const output = createSaleableUnit(input, null, '42');
    expect(output).not.toBeNull();
    expect(output.sourcedUnitData.supplier).toStrictEqual('supplier');
    expect(output.sourcedUnitData.subSupplier).toStrictEqual('subSupplier');
  });

  test('createSaleableUnit has accommodationUnit.name', async () => {
    const input = {
      accommodationUnit: {},
      sourcedUnitData: { roomTypeName: 'Test1' }
    } as AccommodationBaselineUnit;

    const output = createSaleableUnit(input, null, '42');
    expect(output).not.toBeNull();
    expect(output.accommodationUnit.name).toBe('Test1');
  });

  test('createSaleableUnits has supplierRoomTypeName', async () => {
    const input = {
      sourcedUnitData: {
        supplierRoomTypeName: 'Family Room'
      },
      accommodationUnit: {},
    } as AccommodationBaselineUnit;

    const output = createSaleableUnit(input, null, '42');
    expect(output).not.toBeNull();
    expect(output.sourcedUnitData.supplierRoomTypeName).toStrictEqual('Family Room');
  });
});

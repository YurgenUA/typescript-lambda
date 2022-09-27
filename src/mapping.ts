import { v4 as uuidv4 } from 'uuid';
import * as _ from 'lodash';
import AccommodationInputModel from './model/accommodationInputModel';
import { AccommodationSaleableComponent } from './model/generated/AccommodationSaleableComponent';
import { AccommodationSaleableUnit } from './model/generated/AccommodationSaleableUnit';
import AccommodationGeographyModel, { ServedBy } from './model/accommodationGeographyModel';
import { omitByDeep } from './utils';
import { AccommodationBaselineUnit } from './model/generated/AccommodationBaselineUnit';

const COMPONENT_SCHEMA_VERSION = '0.2.6';
const UNIT_SCHEMA_VERSION = '0.2.4';

function getServedBy(servedBy: ServedBy) {
  return {
    transportHubId: servedBy.transportHubId,
    transportHubCode: servedBy.transportHubCode,
    transportHubType: servedBy.servedByType,
    sourceMarket: servedBy.sourceMarket,
    validDateBand: {
      startDate: servedBy?.validDateBand?.fromDate,
      endDate: servedBy?.validDateBand?.toDate
    }
  };
}

export function createGeographies(inputGeography: AccommodationGeographyModel): any {
  return {
    logicalLocations: inputGeography.logicalLocations && inputGeography.logicalLocations.length !== 0 ? inputGeography.logicalLocations : undefined,
    structuralLocations: [{
      country: inputGeography.country,
      destination: inputGeography.destination,
      resort: inputGeography.resort
    }],
    isServedBy: inputGeography.isServedBy?.map((served) => getServedBy(served))
  };
}

export function createSaleableComponent(input: AccommodationInputModel): AccommodationSaleableComponent {
  const { component } = _.cloneDeep(input);

  delete component.baselineComponentVersion; // eslint-disable-line @typescript-eslint/dot-notation
  delete component.sourcedComponentData.version; // eslint-disable-line @typescript-eslint/dot-notation
  component.accommodationComponent?.attributes?.forEach((e) => {
    delete e.subType;
    delete e.description;
  });

  let inactiveReason = null;
  if (!input.geographies) {
    inactiveReason = ['NO_GEO'];
  } else if (input.geographies.length > 1) {
    inactiveReason = ['MULTIPLE_GEO'];
  }

  return omitByDeep({
    ...component,
    schemaVersion: COMPONENT_SCHEMA_VERSION,
    saleableComponentId: uuidv4(),
    saleableComponentVersion: 1,
    entityStatus: input.geographies && input.geographies.length === 1 ? 'ACTIVE' : 'INACTIVE',
    inactiveReason,
    username: 'Automatic',
    creationTimeStamp: new Date(), // overwriting date
    updatedTimeStamp: new Date(),
    accommodationComponent: {
      sourceMarketClassifications: component.accommodationComponent.officialClassifications,
      geographies: input.geographies && input.geographies.length === 1 ? createGeographies(input.geographies[0]) : undefined,
      ...component.accommodationComponent,
    },
  });
}

export function createSaleableUnit(input: AccommodationBaselineUnit,
  geographies: Array<AccommodationGeographyModel>,
  componentId: string): AccommodationSaleableUnit {
  const unit = _.cloneDeep(input);

  delete unit.baselineComponentId;
  delete unit.baselineUnitVersion;
  delete unit.termsAndConditions;
  delete unit.sourcedUnitData.roomTypeVersion; // eslint-disable-line @typescript-eslint/dot-notation
  if (unit?.accommodationUnit) {
    unit.accommodationUnit.name = unit?.sourcedUnitData?.roomTypeName;
  }

  return omitByDeep({
    ...unit,
    schemaVersion: UNIT_SCHEMA_VERSION,
    saleableUnitId: uuidv4(),
    saleableUnitVersion: 1,
    entityStatus: getUnitStatus(unit, geographies),
    saleableComponentId: componentId,
    creationTimeStamp: new Date(), // overwriting date
    updatedTimeStamp: new Date(),
    default: true,
  });
}

export function getUnitStatus(unit: AccommodationSaleableUnit, geographies: Array<AccommodationGeographyModel>) {
  return geographies && geographies.length === 1 ? 'ACTIVE' : 'INACTIVE';
}

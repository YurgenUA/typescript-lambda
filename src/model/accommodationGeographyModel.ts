export interface LogicalLocation {
  locationType: string;
  locationLevel?: string;
  locatedIn?: {
    id: string;
    validDateBand?: DateBand;
  }
}

export type TransportHubType = 'AIRPORT' | 'PORT' | 'TRAINSTATION' | 'BUSSTATION';

export interface ServedBy {
  transportHubId: string;
  transportHubCode?: string;
  sourceMarket: string;
  validDateBand?: DateBand;
  servedByType: TransportHubType;
}

export interface DateBand {
  fromDate?: string;
  toDate?: string;
}

export interface Name {
  name: string;
  validDateBand?: DateBand;
}

export default class AccommodationGeographyModel {
  resort: {
    id: string;
    names: [...Name[]];
  };

  destination: {
    id: string;
    names: [...Name[]];
  };

  country: {
    id: string;
    code: string;
    names: [...Name[]];
  };

  logicalLocations?: Array<LogicalLocation>;
  isServedBy?: Array<ServedBy>;
}

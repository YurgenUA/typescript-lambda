import { AccommodationBaselineComponent } from './generated/AccommodationBaselineComponent';
import { AccommodationBaselineUnit } from './generated/AccommodationBaselineUnit';
import AccommodationGeographyModel from './accommodationGeographyModel';

export default class AccommodationInputModel {
  component: AccommodationBaselineComponent;
  units: Array<AccommodationBaselineUnit>;
  geographies?: Array<AccommodationGeographyModel>;
}

export interface IncomingMessage {
  data: AccommodationInputModel;
  metadata?: {
    correlationId: string;
  }
}

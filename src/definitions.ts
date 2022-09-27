import { AccommodationSaleableUnit } from './model/generated/AccommodationSaleableUnit';
import { AccommodationSaleableComponent } from './model/generated/AccommodationSaleableComponent';

export default class DocDbSecurityCredentials {
  username: string;
  password: string;
  engine: string;
  host: string;
  port: string;
  ssl: boolean;
  dbClusterIdentifier: string;
}

export interface OutgoingMessageData {
  component: AccommodationSaleableComponent;
  units: AccommodationSaleableUnit[];
}

export interface OutgoingMessage {
  data: OutgoingMessageData;
  metadata: {
    correlationId: string;
  }
}

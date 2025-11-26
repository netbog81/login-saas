import { registerEnumType } from '@nestjs/graphql';

export enum InstrumentStatus {
  ACTIVE = 'active',
  UNAVAILABLE = 'unavailable',
  MAINTENANCE = 'maintenance'
}

registerEnumType(InstrumentStatus, {
  name: 'InstrumentStatus',
  description: 'Status of an instrument (active, unavailable, or in maintenance)',
});

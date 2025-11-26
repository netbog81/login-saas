import { registerEnumType } from '@nestjs/graphql';

export enum AppointmentType {
  STANDARD = 'standard',
  GYM = 'gym'
}

registerEnumType(AppointmentType, {
  name: 'AppointmentType',
  description: 'Type of appointment (standard or gym)',
});

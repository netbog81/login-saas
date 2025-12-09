// GraphQL InputType for updating an existing Patient

import { InputType, Field, PartialType } from '@nestjs/graphql';
import { CreatePatientInput } from './create-patient.input';

@InputType({ description: 'Input for updating an existing patient (all fields optional)' })
export class UpdatePatientInput extends PartialType(CreatePatientInput) {
  // All fields from CreatePatientInput are now optional
  // This uses NestJS PartialType utility which makes all fields optional
}

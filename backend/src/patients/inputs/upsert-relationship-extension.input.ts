import { Field, ID, InputType } from '@nestjs/graphql';

/**
 * Input per upsert dei flag clinici su una relationship esistente nel registry.
 */
@InputType()
export class UpsertRelationshipExtensionInput {
  @Field(() => ID, { description: 'ID della relationship nel registry' })
  registryRelationshipId: string;

  @Field({ nullable: true })
  isEmergencyContact?: boolean;

  @Field({ nullable: true })
  isAuthorizedPickup?: boolean;

  @Field({ nullable: true })
  isCaregiverDuringVisits?: boolean;

  @Field({ nullable: true })
  notes?: string;
}

@InputType()
export class CreatePatientRelationshipInput {
  @Field(() => ID, { description: 'subjectId del paziente' })
  fromSubjectId: string;

  @Field(() => ID, { description: 'subjectId della persona di riferimento (genitore/tutore/...)' })
  toSubjectId: string;

  @Field({ description: 'Tipo di relazione (PARENT_OF, LEGAL_GUARDIAN_OF, SPOUSE_OF, ...)' })
  relationshipType: string;

  @Field({ nullable: true, description: 'ISO date' })
  validFrom?: string;

  @Field({ nullable: true, description: 'ISO date' })
  validTo?: string;
}

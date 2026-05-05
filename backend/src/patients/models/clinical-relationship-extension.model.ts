import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('ClinicalRelationshipExtension')
export class ClinicalRelationshipExtensionModel {
  @Field(() => ID)
  registryRelationshipId: string;

  @Field(() => ID)
  organizationId: string;

  @Field()
  isEmergencyContact: boolean;

  @Field()
  isAuthorizedPickup: boolean;

  @Field()
  isCaregiverDuringVisits: boolean;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}

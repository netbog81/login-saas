import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

/**
 * Riferimento a una relazione del registry, popolato da
 * outgoingRelationships / incomingRelationships di SubjectResponse.
 *
 * otherSubjectId è già normalizzato dal mapper: per outgoing è il target,
 * per incoming è la sorgente (i.e. l'altro estremo, qualunque sia il verso).
 */
@ObjectType('RegistrySubjectRelationshipRef')
export class RegistrySubjectRelationshipRefModel {
  @Field(() => ID)
  id: string;

  @Field()
  relationshipType: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  validFrom?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  validTo?: Date;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, unknown>;

  @Field(() => ID)
  otherSubjectId: string;
}

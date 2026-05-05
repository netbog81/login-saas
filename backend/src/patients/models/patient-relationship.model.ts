import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

import { RegistrySubjectModel } from '../../modules/registry/models/registry-subject.model';
import { ClinicalRelationshipExtensionModel } from './clinical-relationship-extension.model';

/**
 * Relazione di un paziente vista dal clinico.
 *
 * - `registryRelationshipId` è l'id della relazione nel registry (autoritativo)
 * - `relationshipType` è il tipo (PARENT_OF, LEGAL_GUARDIAN_OF, ecc.) — dal registry
 * - `relatedSubject` è il subject all'altro estremo (DataLoader → registry)
 * - `extension` sono i flag operativi clinici (LEFT JOIN, può essere null)
 */
@ObjectType('PatientRelationship')
export class PatientRelationshipModel {
  @Field(() => ID)
  registryRelationshipId: string;

  @Field()
  relationshipType: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  validFrom?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  validTo?: Date;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, unknown>;

  @Field(() => RegistrySubjectModel, {
    description: "L'altro estremo della relazione (genitore/figlio/coniuge/...)",
  })
  relatedSubject: RegistrySubjectModel;

  @Field(() => ClinicalRelationshipExtensionModel, {
    nullable: true,
    description: 'Flag operativi clinici (contatto emergenza, ritiro autorizzato, ...)',
  })
  extension?: ClinicalRelationshipExtensionModel;
}

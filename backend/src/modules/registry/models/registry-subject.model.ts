import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

import { RegistryAddressModel } from './registry-address.model';
import { RegistryContactModel } from './registry-contact.model';
import { RegistryPrivacyConsentModel } from './registry-privacy-consent.model';
import { RegistrySubjectRelationshipRefModel } from './registry-subject-relationship-ref.model';
import { RegistrySubjectRoleModel } from './registry-subject-role.model';

/**
 * Mirror GraphQL del SubjectResponse REST del registry.
 * Tutti i campi sono nullable per gestire INDIVIDUAL vs ORGANIZATION
 * con un solo type.
 */
@ObjectType('RegistrySubject')
export class RegistrySubjectModel {
  @Field(() => ID)
  id: string;

  @Field()
  subjectType: string;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  notes?: string;

  // ==================== INDIVIDUAL ====================

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  gender?: string;

  @Field({ nullable: true })
  birthDate?: string;

  @Field({ nullable: true })
  birthPlace?: string;

  @Field({ nullable: true })
  birthCountry?: string;

  @Field({ nullable: true })
  taxCode?: string;

  /** ADULT_AUTONOMOUS | MINOR_WITH_GUARDIAN | INCAPACITATED_WITH_GUARDIAN | ELDERLY_WITH_GUARDIAN */
  @Field({ nullable: true })
  legalCapacity?: string;

  // ==================== ORGANIZATION ====================

  @Field({ nullable: true })
  legalName?: string;

  @Field({ nullable: true })
  organizationType?: string;

  @Field({ nullable: true })
  sdiCode?: string;

  @Field({ nullable: true })
  pecEmail?: string;

  @Field({ nullable: true })
  vatNumber?: string;

  // ==================== COLLECTIONS ====================

  @Field(() => [RegistrySubjectRoleModel])
  roles: RegistrySubjectRoleModel[];

  @Field(() => [RegistryAddressModel])
  addresses: RegistryAddressModel[];

  @Field(() => [RegistryContactModel])
  contacts: RegistryContactModel[];

  @Field(() => RegistryPrivacyConsentModel, { nullable: true })
  privacyGeneralConsent?: RegistryPrivacyConsentModel;

  @Field(() => [RegistrySubjectRelationshipRefModel], { nullable: true })
  outgoingRelationships?: RegistrySubjectRelationshipRefModel[];

  @Field(() => [RegistrySubjectRelationshipRefModel], { nullable: true })
  incomingRelationships?: RegistrySubjectRelationshipRefModel[];

  // ==================== DERIVED FIELDS ====================
  // Risolti da registry-subject-fields.resolver.ts

  @Field({ nullable: true, description: 'firstName + lastName, oppure legalName se ORGANIZATION' })
  displayName?: string;

  @Field(() => RegistryAddressModel, { nullable: true })
  primaryAddress?: RegistryAddressModel;

  @Field({ nullable: true })
  primaryEmail?: string;

  @Field({ nullable: true })
  primaryPhone?: string;

  // ==================== AUDIT ====================

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}

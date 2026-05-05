/**
 * Type-only mirror del contratto REST del Curandis Registry.
 * Non importare entità TypeORM o classi GraphQL qui: solo interfacce
 * pure per uso lato HTTP client.
 *
 * Riferimento: /home/marco/curandis-registry/docs/integration-guide-clinico.md §3.5
 */

export type SubjectType = 'INDIVIDUAL' | 'ORGANIZATION';

export type Gender = 'M' | 'F' | 'X';

export type LegalCapacity =
  | 'ADULT_AUTONOMOUS'
  | 'MINOR_WITH_GUARDIAN'
  | 'INCAPACITATED_WITH_GUARDIAN'
  | 'ELDERLY_WITH_GUARDIAN';

export type AddressType = 'LEGAL' | 'RESIDENCE' | 'BILLING' | 'SHIPPING' | 'OTHER';

export type ContactType = 'EMAIL' | 'PHONE' | 'MOBILE' | 'FAX' | 'PEC';

export type OrganizationType =
  | 'COMPANY'
  | 'PUBLIC_ADMINISTRATION'
  | 'INSURANCE'
  | 'ASSOCIATION'
  | 'OTHER';

export type PrivacyConsentType = 'general' | 'marketing' | 'sharing' | 'whatsapp';

export type PrivacyConsentState = 'given' | 'not_given' | 'revoked';

export interface RegistrySubjectAddress {
  id: string;
  addressType: AddressType;
  street?: string;
  city?: string;
  zipCode?: string;
  province?: string;
  countryCode: string;
  isPrimary: boolean;
}

export interface RegistrySubjectContact {
  id: string;
  contactType: ContactType;
  value: string;
  label?: string;
  isPrimary: boolean;
  verified: boolean;
}

export interface RegistrySubjectRole {
  id: string;
  roleType: string;
  isActive: boolean;
}

export interface RegistryPrivacyConsent {
  given: boolean;
  givenAt?: string;
  revokedAt?: string;
  documentRef?: string;
}

export interface RegistrySubjectRelationshipRef {
  id: string;
  relationshipType: string;
  validFrom?: string;
  validTo?: string;
  metadata?: Record<string, unknown>;
  // Per le outgoing è l'altro estremo della relazione (target);
  // per le incoming è la sorgente. Il client clinico li tratta uniformemente.
  otherSubjectId: string;
}

export interface RegistrySubjectResponse {
  id: string;
  subjectType: SubjectType;
  isActive: boolean;
  notes?: string;

  // Campi INDIVIDUAL
  firstName?: string;
  lastName?: string;
  gender?: Gender;
  birthDate?: string;
  birthPlace?: string;
  birthCountry?: string;
  taxCode?: string;
  legalCapacity?: LegalCapacity;

  // Campi ORGANIZATION
  legalName?: string;
  organizationType?: OrganizationType;
  sdiCode?: string;
  pecEmail?: string;

  vatNumber?: string;

  roles: RegistrySubjectRole[];
  addresses: RegistrySubjectAddress[];
  contacts: RegistrySubjectContact[];

  privacyGeneralConsent?: RegistryPrivacyConsent;

  // Relazioni (riempite da GET /subjects/:id)
  outgoingRelationships?: RegistrySubjectRelationshipRef[];
  incomingRelationships?: RegistrySubjectRelationshipRef[];

  createdAt: string;
  updatedAt: string;
}

export interface CreateIndividualDto {
  firstName: string;
  lastName: string;
  taxCode?: string;
  gender?: Gender;
  birthDate?: string;
  birthPlace?: string;
  birthCountry?: string;
  legalCapacity?: LegalCapacity;
  vatNumber?: string;
  notes?: string;
  addresses?: Array<Omit<RegistrySubjectAddress, 'id'>>;
  contacts?: Array<Omit<RegistrySubjectContact, 'id' | 'verified'>>;
  roles?: Array<{ roleType: string }>;
}

export type UpdateIndividualDto = Partial<CreateIndividualDto> & {
  isActive?: boolean;
};

export interface GlobalSearchRequest {
  query?: string;
  subjectType?: SubjectType;
  isActive?: boolean;
  privacyConsent?: PrivacyConsentState;
  page?: number;
  pageSize?: number;
}

export interface GlobalSearchResponse {
  data: RegistrySubjectResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BulkSubjectsRequest {
  ids: string[];
}

export type BulkSubjectsResponse = Array<RegistrySubjectResponse | null>;

export interface UpdatePrivacyConsentDto {
  given: boolean;
  documentRef?: string;
}

export interface CreateRelationshipDto {
  fromSubjectId: string;
  toSubjectId: string;
  relationshipType: string;
  validFrom?: string;
  validTo?: string;
  metadata?: Record<string, unknown>;
}

export interface RegistryRelationshipResponse {
  id: string;
  fromSubjectId: string;
  toSubjectId: string;
  relationshipType: string;
  validFrom?: string;
  validTo?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Contesto request che il clinico costruisce a partire da CurrentUserContext
 * e passa a ogni chiamata del RegistryClient.
 *
 * - rawToken: JWT utente o service-account, forwardato come Authorization Bearer
 * - tenantAlias: alias del tenant (es. "bdq"), inviato come X-Tenant-Alias
 * - orgId: UUID organizzazione, inviato come X-Org-Id se presente. `null` per
 *   service-account (il registry risolve il tenant via X-Tenant-Alias).
 * - requestId: correlation id, inviato come X-Request-Id
 */
export interface RegistryRequestContext {
  rawToken: string;
  tenantAlias: string;
  orgId: string | null;
  requestId: string;
}

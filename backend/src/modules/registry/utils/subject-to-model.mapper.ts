import { RegistrySubjectModel } from '../models/registry-subject.model';
import { RegistrySubjectResponse, RegistrySubjectRelationshipRef } from '../registry.types';

/**
 * Mappa il payload REST al modello GraphQL. Le date ISO restano stringhe per
 * birthDate; createdAt/updatedAt diventano Date oggetti.
 *
 * Le outgoing/incoming relationships del registry hanno fromSubjectId/toSubjectId.
 * Il `otherSubjectId` esposto in GraphQL è già normalizzato all'altro estremo
 * della relazione rispetto al subject corrente (caller deve passare currentSubjectId).
 */
export function subjectResponseToModel(
  resp: RegistrySubjectResponse,
): RegistrySubjectModel {
  const m = new RegistrySubjectModel();
  m.id = resp.id;
  m.subjectType = resp.subjectType;
  m.isActive = resp.isActive;
  m.notes = resp.notes;
  m.firstName = resp.firstName;
  m.lastName = resp.lastName;
  m.gender = resp.gender;
  m.birthDate = resp.birthDate;
  m.birthPlace = resp.birthPlace;
  m.birthCountry = resp.birthCountry;
  m.taxCode = resp.taxCode;
  m.legalCapacity = resp.legalCapacity;
  m.legalName = resp.legalName;
  m.organizationType = resp.organizationType;
  m.sdiCode = resp.sdiCode;
  m.pecEmail = resp.pecEmail;
  m.vatNumber = resp.vatNumber;
  m.roles = (resp.roles || []).map((r) => ({ ...r }));
  m.addresses = (resp.addresses || []).map((a) => ({ ...a }));
  m.contacts = (resp.contacts || []).map((c) => ({ ...c }));
  m.privacyGeneralConsent = resp.privacyGeneralConsent
    ? {
        given: resp.privacyGeneralConsent.given,
        givenAt: resp.privacyGeneralConsent.givenAt
          ? new Date(resp.privacyGeneralConsent.givenAt)
          : undefined,
        revokedAt: resp.privacyGeneralConsent.revokedAt
          ? new Date(resp.privacyGeneralConsent.revokedAt)
          : undefined,
        documentRef: resp.privacyGeneralConsent.documentRef,
      }
    : undefined;
  m.outgoingRelationships = mapRelationshipRefs(resp.outgoingRelationships);
  m.incomingRelationships = mapRelationshipRefs(resp.incomingRelationships);
  m.createdAt = new Date(resp.createdAt);
  m.updatedAt = new Date(resp.updatedAt);
  return m;
}

function mapRelationshipRefs(refs?: RegistrySubjectRelationshipRef[]) {
  if (!refs) return undefined;
  return refs.map((r) => ({
    id: r.id,
    relationshipType: r.relationshipType,
    validFrom: r.validFrom ? new Date(r.validFrom) : undefined,
    validTo: r.validTo ? new Date(r.validTo) : undefined,
    metadata: r.metadata,
    otherSubjectId: r.otherSubjectId,
  }));
}

/**
 * Eventi pubblicati dal registry su exchange ex.registry.events.
 * Routing: <eventType>.<tenantAlias>, e l'eventType può contenere punti:
 *   - subject.created.bdq, subject.updated.bdq        (tre segmenti)
 *   - subject.role.added.bdq, subject.consent.updated.bdq (QUATTRO)
 *   - relationship.created.bdq
 * Per questo il bind è `subject.#` e non `subject.*.*`.
 *
 * Il payload NON contiene PII. Solo subjectId + metadati.
 */

/**
 * Tutti i tipi che il registry pubblica davvero (non solo quelli che il
 * clinico tratta): tenerli elencati serve a sapere cosa passa dal binding
 * `subject.#` e cosa invece finisce nel `default:` del dispatch.
 *
 * Gestiti dal clinico: created, updated, deactivated, reactivated,
 * role.added, role.removed, consent.updated.
 * NON gestiti di proposito (loggati come warn, vedi dispatch): merged e
 * deleted — richiedono di ripuntare i dati clinici, non è una no-op.
 */
export type SubjectEventType =
  | 'subject.created'
  | 'subject.updated'
  | 'subject.deactivated'
  | 'subject.reactivated'
  | 'subject.role.added'
  | 'subject.role.removed'
  | 'subject.consent.updated'
  | 'subject.merged'
  | 'subject.deleted';

export type RelationshipEventType =
  | 'relationship.created'
  | 'relationship.updated'
  | 'relationship.deleted';

export interface SubjectEventPayload {
  subjectId: string;
  subjectType: 'INDIVIDUAL' | 'ORGANIZATION';
  organizationId: string;
  roles?: string[];
}

export interface RelationshipEventPayload {
  relationshipId: string;
  fromSubjectId: string;
  toSubjectId: string;
  relationshipType: string;
  organizationId: string;
}

export interface RegistryEvent<T = SubjectEventPayload | RelationshipEventPayload> {
  schemaVersion: '1.0';
  occurredAt: string;
  eventId: string;
  producerVersion?: string;
  eventType: SubjectEventType | RelationshipEventType;
  tenantAlias: string;
  correlationId?: string;
  payload: T;
}

/**
 * Eventi pubblicati dal registry su exchange ex.registry.events.
 * Routing: <entity>.<action>.<tenantAlias>
 *   - subject.created.bdq, subject.updated.bdq, subject.deactivated.bdq, ...
 *   - relationship.*.bdq
 *
 * Il payload NON contiene PII. Solo subjectId + metadati.
 */

export type SubjectEventType =
  | 'subject.created'
  | 'subject.updated'
  | 'subject.deactivated'
  | 'subject.reactivated'
  | 'subject.role.added'
  | 'subject.role.removed';

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

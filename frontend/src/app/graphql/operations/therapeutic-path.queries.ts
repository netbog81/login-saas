import { gql } from 'apollo-angular';
import { PATIENT_EVALUATION_FRAGMENT } from './patient-evaluation.queries';

// Re-export per retrocompatibilità (usato da therapeutic-path.mutations.ts)
export { PATIENT_EVALUATION_FRAGMENT };

// ==================== FRAGMENTS ====================

// NOTA: PATH_DOCUMENT_FRAGMENT rimosso — i documenti sono ora della scheda
// paziente (patient-documents.operations.ts, entity patient_documents).

export const THERAPEUTIC_PATH_FRAGMENT = gql`
  fragment TherapeuticPathFields on TherapeuticPath {
    id
    patientId
    primaryOperatorId
    name
    diagnosis
    icdCode
    status
    externalDoctorName
    externalPrescriptionRef
    notes
    createdAt
    updatedAt
    closedAt
    primaryOperator {
      id
      name
      surname
      appUserId
    }
  }
`;

/**
 * Fragment con relazioni per TherapeuticPath
 *
 * NOTA: 'evaluations' è stato rimosso - la relazione PatientEvaluation
 * è ora 1:1 con TherapeuticPath e si carica separatamente tramite
 * evaluationByPath(pathId: ID!)
 */
export const THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT = gql`
  fragment TherapeuticPathWithRelationsFields on TherapeuticPath {
    ...TherapeuticPathFields
  }
  ${THERAPEUTIC_PATH_FRAGMENT}
`;

// ==================== PATH QUERIES ====================

export const GET_THERAPEUTIC_PATH = gql`
  query GetTherapeuticPath($id: ID!) {
    therapeuticPath(id: $id) {
      ...TherapeuticPathWithRelationsFields
    }
  }
  ${THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT}
`;

export const GET_THERAPEUTIC_PATHS_BY_PATIENT = gql`
  query GetTherapeuticPathsByPatient($patientId: ID!) {
    therapeuticPathsByPatient(patientId: $patientId) {
      ...TherapeuticPathWithRelationsFields
    }
  }
  ${THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT}
`;

export const GET_ACTIVE_THERAPEUTIC_PATHS_BY_PATIENT = gql`
  query GetActiveTherapeuticPathsByPatient($patientId: ID!) {
    activeTherapeuticPathsByPatient(patientId: $patientId) {
      ...TherapeuticPathWithRelationsFields
    }
  }
  ${THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT}
`;

export const GET_THERAPEUTIC_PATHS_BY_OPERATOR = gql`
  query GetTherapeuticPathsByOperator($operatorId: ID!) {
    therapeuticPathsByOperator(operatorId: $operatorId) {
      ...TherapeuticPathWithRelationsFields
    }
  }
  ${THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT}
`;

/**
 * Query batch: percorsi terapeutici per più pazienti in una sola chiamata.
 */
export const GET_THERAPEUTIC_PATHS_BY_PATIENTS = gql`
  query GetTherapeuticPathsByPatients($patientIds: [ID!]!) {
    therapeuticPathsByPatients(patientIds: $patientIds) {
      ...TherapeuticPathWithRelationsFields
    }
  }
  ${THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT}
`;

// ==================== EVALUATION QUERIES ====================

// NOTA: operation name `GetPatientEvaluationForPath` (non `GetPatientEvaluation`)
// per evitare conflitto di nome con `patient-evaluation.queries.ts` che ha
// operation con stesso nome ma fragment diverso (`PatientEvaluationWithRelationsFields`).
// La const TS `GET_PATIENT_EVALUATION` resta uguale → caller intatti.
export const GET_PATIENT_EVALUATION = gql`
  query GetPatientEvaluationForPath($id: ID!) {
    patientEvaluation(id: $id) {
      ...PatientEvaluationFields
    }
  }
  ${PATIENT_EVALUATION_FRAGMENT}
`;

/**
 * Query per ottenere la valutazione di un percorso terapeutico
 * Relazione 1:1 tra PatientEvaluation e TherapeuticPath
 *
 * Operation name `GetEvaluationByPathScope` per evitare conflitto con
 * `patient-evaluation.queries.ts`.
 */
export const GET_EVALUATION_BY_PATH = gql`
  query GetEvaluationByPathScope($pathId: ID!) {
    evaluationByPath(pathId: $pathId) {
      ...PatientEvaluationFields
    }
  }
  ${PATIENT_EVALUATION_FRAGMENT}
`;

// Legacy alias per compatibilità
export const GET_EVALUATIONS_BY_PATH = GET_EVALUATION_BY_PATH;

// NOTA: le DOCUMENT QUERIES (pathDocument/documentsByPath/...) sono state
// sostituite da patient-documents.operations.ts (documenti scheda paziente).

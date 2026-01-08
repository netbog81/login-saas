import { gql } from 'apollo-angular';

// ==================== FRAGMENTS ====================

export const PATIENT_EVALUATION_FRAGMENT = gql`
  fragment PatientEvaluationFields on PatientEvaluation {
    id
    therapeuticPathId
    operatorId
    templateId
    chiefComplaint
    historyOfPresentIllness
    aggravatingFactors
    relievingFactors
    patientGoals
    therapistGoals
    functionalAssessment
    conclusions
    fieldValues
    createdAt
    updatedAt
    operator {
      id
      name
      surname
    }
  }
`;

export const PATH_DOCUMENT_FRAGMENT = gql`
  fragment PathDocumentFields on PathDocument {
    id
    therapeuticPathId
    type
    category
    fileName
    originalFileName
    mimeType
    fileSize
    storagePath
    thumbnailPath
    externalDoctorName
    notes
    description
    uploadedBy
    uploadedAt
  }
`;

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
    }
    patient {
      id
      nome
      cognome
      codiceFiscale
      telefono
      email
    }
  }
`;

export const THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT = gql`
  fragment TherapeuticPathWithRelationsFields on TherapeuticPath {
    ...TherapeuticPathFields
    evaluations {
      ...PatientEvaluationFields
    }
    documents {
      ...PathDocumentFields
    }
  }
  ${THERAPEUTIC_PATH_FRAGMENT}
  ${PATIENT_EVALUATION_FRAGMENT}
  ${PATH_DOCUMENT_FRAGMENT}
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
  query GetTherapeuticPathsByPatient($patientId: Int!) {
    therapeuticPathsByPatient(patientId: $patientId) {
      ...TherapeuticPathWithRelationsFields
    }
  }
  ${THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT}
`;

export const GET_ACTIVE_THERAPEUTIC_PATHS_BY_PATIENT = gql`
  query GetActiveTherapeuticPathsByPatient($patientId: Int!) {
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

// ==================== EVALUATION QUERIES ====================

export const GET_PATIENT_EVALUATION = gql`
  query GetPatientEvaluation($id: ID!) {
    patientEvaluation(id: $id) {
      ...PatientEvaluationFields
    }
  }
  ${PATIENT_EVALUATION_FRAGMENT}
`;

export const GET_EVALUATIONS_BY_PATH = gql`
  query GetEvaluationsByPath($pathId: ID!) {
    evaluationsByPath(pathId: $pathId) {
      ...PatientEvaluationFields
    }
  }
  ${PATIENT_EVALUATION_FRAGMENT}
`;

// ==================== DOCUMENT QUERIES ====================

export const GET_PATH_DOCUMENT = gql`
  query GetPathDocument($id: ID!) {
    pathDocument(id: $id) {
      ...PathDocumentFields
    }
  }
  ${PATH_DOCUMENT_FRAGMENT}
`;

export const GET_DOCUMENTS_BY_PATH = gql`
  query GetDocumentsByPath($pathId: ID!) {
    documentsByPath(pathId: $pathId) {
      ...PathDocumentFields
    }
  }
  ${PATH_DOCUMENT_FRAGMENT}
`;

export const GET_DOCUMENTS_BY_PATH_AND_CATEGORY = gql`
  query GetDocumentsByPathAndCategory($pathId: ID!, $category: DocumentCategory!) {
    documentsByPathAndCategory(pathId: $pathId, category: $category) {
      ...PathDocumentFields
    }
  }
  ${PATH_DOCUMENT_FRAGMENT}
`;

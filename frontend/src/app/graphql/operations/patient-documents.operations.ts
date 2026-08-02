import { gql } from 'apollo-angular';

// ==================== FRAGMENTS ====================

export const PATIENT_DOCUMENT_FRAGMENT = gql`
  fragment PatientDocumentFields on PatientDocument {
    id
    subjectId
    organizationId
    therapeuticPathId
    treatmentId
    category
    contentKind
    originalFileName
    mimeType
    fileSize
    sha256
    externalDoctorName
    notes
    description
    uploadedBy
    uploadedAt
    updatedAt
  }
`;

// ==================== QUERIES ====================

export const GET_PATIENT_DOCUMENTS = gql`
  query GetPatientDocuments($subjectId: ID!, $filter: PatientDocumentsFilterInput) {
    patientDocuments(subjectId: $subjectId, filter: $filter) {
      ...PatientDocumentFields
    }
  }
  ${PATIENT_DOCUMENT_FRAGMENT}
`;

export const GET_PATIENT_DOCUMENT_STATS = gql`
  query GetPatientDocumentStats($subjectId: ID!) {
    patientDocumentStats(subjectId: $subjectId) {
      total
      generalCount
      pathCount
      treatmentCount
      byCategory { category count }
      byKind { kind count }
      byPath { therapeuticPathId count }
    }
  }
`;

// ==================== MUTATIONS ====================

export const UPDATE_PATIENT_DOCUMENT = gql`
  mutation UpdatePatientDocument($id: ID!, $input: UpdatePatientDocumentInput!) {
    updatePatientDocument(id: $id, input: $input) {
      ...PatientDocumentFields
    }
  }
  ${PATIENT_DOCUMENT_FRAGMENT}
`;

export const DELETE_PATIENT_DOCUMENT = gql`
  mutation DeletePatientDocument($id: ID!) {
    deletePatientDocument(id: $id)
  }
`;

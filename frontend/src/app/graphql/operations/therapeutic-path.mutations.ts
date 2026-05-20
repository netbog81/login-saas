import { gql } from 'apollo-angular';
import {
  THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT,
  PATIENT_EVALUATION_FRAGMENT,
  PATH_DOCUMENT_FRAGMENT,
} from './therapeutic-path.queries';

// ==================== PATH MUTATIONS ====================

export const CREATE_THERAPEUTIC_PATH = gql`
  mutation CreateTherapeuticPath($input: CreateTherapeuticPathInput!) {
    createTherapeuticPath(input: $input) {
      ...TherapeuticPathWithRelationsFields
    }
  }
  ${THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT}
`;

export const UPDATE_THERAPEUTIC_PATH = gql`
  mutation UpdateTherapeuticPath($id: ID!, $input: UpdateTherapeuticPathInput!) {
    updateTherapeuticPath(id: $id, input: $input) {
      ...TherapeuticPathWithRelationsFields
    }
  }
  ${THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT}
`;

export const DELETE_THERAPEUTIC_PATH = gql`
  mutation DeleteTherapeuticPath($id: ID!) {
    deleteTherapeuticPath(id: $id)
  }
`;

// ==================== EVALUATION MUTATIONS ====================

// NB: schema backend rinominato `createPatientEvaluation` → `createEvaluation`
// (idem update/delete). Mutation TS const e operation name client mantengono
// il vecchio name "PatientEvaluation" per minimo impatto sui caller; il
// nome del field GraphQL è quello nuovo dello schema.
export const CREATE_PATIENT_EVALUATION = gql`
  mutation CreatePatientEvaluation($input: CreateEvaluationInput!) {
    createEvaluation(input: $input) {
      ...PatientEvaluationFields
    }
  }
  ${PATIENT_EVALUATION_FRAGMENT}
`;

export const UPDATE_PATIENT_EVALUATION = gql`
  mutation UpdatePatientEvaluation($id: ID!, $input: UpdateEvaluationInput!) {
    updateEvaluation(id: $id, input: $input) {
      ...PatientEvaluationFields
    }
  }
  ${PATIENT_EVALUATION_FRAGMENT}
`;

export const DELETE_PATIENT_EVALUATION = gql`
  mutation DeletePatientEvaluation($id: ID!) {
    deleteEvaluation(id: $id)
  }
`;

// ==================== DOCUMENT MUTATIONS ====================

export const CREATE_PATH_DOCUMENT = gql`
  mutation CreatePathDocument($input: CreateDocumentInput!) {
    createPathDocument(input: $input) {
      ...PathDocumentFields
    }
  }
  ${PATH_DOCUMENT_FRAGMENT}
`;

export const DELETE_PATH_DOCUMENT = gql`
  mutation DeletePathDocument($id: ID!) {
    deletePathDocument(id: $id)
  }
`;

import { gql } from 'apollo-angular';
import {
  PATIENT_ANAMNESIS_WITH_RELATIONS_FRAGMENT,
  ANAMNESIS_OBJECTIVE_FRAGMENT,
  ANAMNESIS_TEST_FRAGMENT,
} from './patient-anamnesis.queries';

// ==================== ANAMNESIS MUTATIONS ====================

export const CREATE_ANAMNESIS = gql`
  mutation CreateAnamnesis($input: CreateAnamnesisInput!) {
    createAnamnesis(input: $input) {
      ...PatientAnamnesisWithRelationsFields
    }
  }
  ${PATIENT_ANAMNESIS_WITH_RELATIONS_FRAGMENT}
`;

export const UPDATE_ANAMNESIS = gql`
  mutation UpdateAnamnesis($id: ID!, $input: UpdateAnamnesisInput!) {
    updateAnamnesis(id: $id, input: $input) {
      ...PatientAnamnesisWithRelationsFields
    }
  }
  ${PATIENT_ANAMNESIS_WITH_RELATIONS_FRAGMENT}
`;

export const DELETE_ANAMNESIS = gql`
  mutation DeleteAnamnesis($id: ID!) {
    deleteAnamnesis(id: $id)
  }
`;

// ==================== OBJECTIVE MUTATIONS ====================
// Per la sezione "Valutazione Trattamento"

export const MARK_OBJECTIVE_ACHIEVED = gql`
  mutation MarkObjectiveAchieved($objectiveId: ID!, $input: MarkObjectiveAchievedInput!) {
    markObjectiveAchieved(objectiveId: $objectiveId, input: $input) {
      ...AnamnesisObjectiveFields
    }
  }
  ${ANAMNESIS_OBJECTIVE_FRAGMENT}
`;

// ==================== TEST MUTATIONS ====================
// Per la sezione "Valutazione Trattamento"

export const UPDATE_TEST_RESULT = gql`
  mutation UpdateTestResult($testId: ID!, $input: UpdateTestResultInput!) {
    updateTestResult(testId: $testId, input: $input) {
      ...AnamnesisTestFields
    }
  }
  ${ANAMNESIS_TEST_FRAGMENT}
`;

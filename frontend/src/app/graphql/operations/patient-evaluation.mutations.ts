import { gql } from 'apollo-angular';
import {
  PATIENT_EVALUATION_WITH_RELATIONS_FRAGMENT,
  EVALUATION_OBJECTIVE_FRAGMENT,
  EVALUATION_TEST_FRAGMENT,
} from './patient-evaluation.queries';

// ==================== EVALUATION MUTATIONS ====================

export const CREATE_EVALUATION = gql`
  mutation CreateEvaluation($input: CreateEvaluationInput!) {
    createEvaluation(input: $input) {
      ...PatientEvaluationWithRelationsFields
    }
  }
  ${PATIENT_EVALUATION_WITH_RELATIONS_FRAGMENT}
`;

export const UPDATE_EVALUATION = gql`
  mutation UpdateEvaluation($id: ID!, $input: UpdateEvaluationInput!) {
    updateEvaluation(id: $id, input: $input) {
      ...PatientEvaluationWithRelationsFields
    }
  }
  ${PATIENT_EVALUATION_WITH_RELATIONS_FRAGMENT}
`;

export const DELETE_EVALUATION = gql`
  mutation DeleteEvaluation($id: ID!) {
    deleteEvaluation(id: $id)
  }
`;

// ==================== OBJECTIVE MUTATIONS ====================
// Per la sezione "Valutazione Trattamento"

export const MARK_OBJECTIVE_ACHIEVED = gql`
  mutation MarkObjectiveAchieved($objectiveId: ID!, $input: MarkObjectiveAchievedInput!) {
    markObjectiveAchieved(objectiveId: $objectiveId, input: $input) {
      ...EvaluationObjectiveFields
    }
  }
  ${EVALUATION_OBJECTIVE_FRAGMENT}
`;

// ==================== TEST MUTATIONS ====================
// Per la sezione "Valutazione Trattamento"

export const UPDATE_TEST_RESULT = gql`
  mutation UpdateTestResult($testId: ID!, $input: UpdateTestResultInput!) {
    updateTestResult(testId: $testId, input: $input) {
      ...EvaluationTestFields
    }
  }
  ${EVALUATION_TEST_FRAGMENT}
`;

import { gql } from '@apollo/client/core';
import { OPERATOR_ABSENCE_TYPE_FIELDS } from './operator-absence-type.queries';

export const CREATE_OPERATOR_ABSENCE_TYPE = gql`
  ${OPERATOR_ABSENCE_TYPE_FIELDS}
  mutation CreateOperatorAbsenceType($input: CreateOperatorAbsenceTypeInput!) {
    createOperatorAbsenceType(input: $input) {
      ...OperatorAbsenceTypeFields
    }
  }
`;

export const UPDATE_OPERATOR_ABSENCE_TYPE = gql`
  ${OPERATOR_ABSENCE_TYPE_FIELDS}
  mutation UpdateOperatorAbsenceType(
    $id: ID!
    $input: UpdateOperatorAbsenceTypeInput!
  ) {
    updateOperatorAbsenceType(id: $id, input: $input) {
      ...OperatorAbsenceTypeFields
    }
  }
`;

export const DELETE_OPERATOR_ABSENCE_TYPE = gql`
  mutation DeleteOperatorAbsenceType($id: ID!) {
    deleteOperatorAbsenceType(id: $id)
  }
`;

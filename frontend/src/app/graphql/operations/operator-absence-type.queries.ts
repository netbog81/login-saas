import { gql } from '@apollo/client/core';

export const OPERATOR_ABSENCE_TYPE_FIELDS = gql`
  fragment OperatorAbsenceTypeFields on OperatorAbsenceType {
    id
    name
    description
    isActive
    createdAt
    updatedAt
  }
`;

export const GET_OPERATOR_ABSENCE_TYPES = gql`
  ${OPERATOR_ABSENCE_TYPE_FIELDS}
  query GetOperatorAbsenceTypes($onlyActive: Boolean) {
    operatorAbsenceTypes(onlyActive: $onlyActive) {
      ...OperatorAbsenceTypeFields
    }
  }
`;

export const GET_OPERATOR_ABSENCE_TYPE = gql`
  ${OPERATOR_ABSENCE_TYPE_FIELDS}
  query GetOperatorAbsenceType($id: ID!) {
    operatorAbsenceType(id: $id) {
      ...OperatorAbsenceTypeFields
    }
  }
`;

import { gql } from '@apollo/client/core';

export const CREATE_OPERATOR_CATEGORY = gql`
  mutation CreateOperatorCategory(
    $macroCategory: OperatorMacroCategory!
    $name: String!
    $description: String
  ) {
    createOperatorCategory(
      macroCategory: $macroCategory
      name: $name
      description: $description
    ) {
      id
      macroCategory
      name
      description
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_OPERATOR_CATEGORY = gql`
  mutation UpdateOperatorCategory(
    $id: ID!
    $name: String
    $description: String
    $macroCategory: OperatorMacroCategory
    $isActive: Boolean
  ) {
    updateOperatorCategory(
      id: $id
      name: $name
      description: $description
      macroCategory: $macroCategory
      isActive: $isActive
    ) {
      id
      macroCategory
      name
      description
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_OPERATOR_CATEGORY = gql`
  mutation DeleteOperatorCategory($id: ID!) {
    deleteOperatorCategory(id: $id)
  }
`;

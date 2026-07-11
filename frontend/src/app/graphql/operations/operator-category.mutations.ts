import { gql } from '@apollo/client/core';

export const CREATE_OPERATOR_CATEGORY = gql`
  mutation CreateOperatorCategory(
    $macroCategory: OperatorMacroCategory!
    $name: String!
    $description: String
    $invoiceLineDescription: String
  ) {
    createOperatorCategory(
      macroCategory: $macroCategory
      name: $name
      description: $description
      invoiceLineDescription: $invoiceLineDescription
    ) {
      id
      macroCategory
      name
      description
      invoiceLineDescription
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
    $invoiceLineDescription: String
    $macroCategory: OperatorMacroCategory
    $isActive: Boolean
  ) {
    updateOperatorCategory(
      id: $id
      name: $name
      description: $description
      invoiceLineDescription: $invoiceLineDescription
      macroCategory: $macroCategory
      isActive: $isActive
    ) {
      id
      macroCategory
      name
      description
      invoiceLineDescription
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

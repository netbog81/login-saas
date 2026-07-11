import { gql } from '@apollo/client/core';

export const GET_OPERATOR_CATEGORIES = gql`
  query GetOperatorCategories($macroCategory: OperatorMacroCategory) {
    operatorCategories(macroCategory: $macroCategory) {
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

export const GET_OPERATOR_CATEGORY = gql`
  query GetOperatorCategory($id: ID!) {
    operatorCategory(id: $id) {
      id
      macroCategory
      name
      description
      invoiceLineDescription
      isActive
      operators {
        id
        name
        surname
        email
        isActive
      }
      createdAt
      updatedAt
    }
  }
`;

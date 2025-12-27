import { gql } from '@apollo/client/core';

/**
 * Fragment: Campi base sottocategoria servizio
 */
export const SERVICE_SUBCATEGORY_FIELDS = gql`
  fragment ServiceSubcategoryFields on ServiceSubcategory {
    id
    macroCategory
    name
    description
    isActive
    createdAt
    updatedAt
  }
`;

/**
 * Query: Ottiene tutte le sottocategorie servizio
 * Opzionalmente filtrate per macroCategory
 */
export const GET_SERVICE_SUBCATEGORIES = gql`
  ${SERVICE_SUBCATEGORY_FIELDS}
  query GetServiceSubcategories($macroCategory: OperatorMacroCategory, $onlyActive: Boolean) {
    serviceSubcategories(macroCategory: $macroCategory, onlyActive: $onlyActive) {
      ...ServiceSubcategoryFields
    }
  }
`;

/**
 * Query: Ottiene una singola sottocategoria servizio
 */
export const GET_SERVICE_SUBCATEGORY = gql`
  ${SERVICE_SUBCATEGORY_FIELDS}
  query GetServiceSubcategory($id: ID!) {
    serviceSubcategory(id: $id) {
      ...ServiceSubcategoryFields
    }
  }
`;

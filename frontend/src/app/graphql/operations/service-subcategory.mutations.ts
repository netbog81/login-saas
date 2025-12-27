import { gql } from '@apollo/client/core';
import { SERVICE_SUBCATEGORY_FIELDS } from './service-subcategory.queries';

/**
 * Mutation: Crea una nuova sottocategoria servizio
 */
export const CREATE_SERVICE_SUBCATEGORY = gql`
  ${SERVICE_SUBCATEGORY_FIELDS}
  mutation CreateServiceSubcategory($macroCategory: OperatorMacroCategory!, $name: String!, $description: String) {
    createServiceSubcategory(macroCategory: $macroCategory, name: $name, description: $description) {
      ...ServiceSubcategoryFields
    }
  }
`;

/**
 * Mutation: Aggiorna una sottocategoria servizio esistente
 */
export const UPDATE_SERVICE_SUBCATEGORY = gql`
  ${SERVICE_SUBCATEGORY_FIELDS}
  mutation UpdateServiceSubcategory($id: ID!, $name: String, $description: String, $isActive: Boolean) {
    updateServiceSubcategory(id: $id, name: $name, description: $description, isActive: $isActive) {
      ...ServiceSubcategoryFields
    }
  }
`;

/**
 * Mutation: Elimina una sottocategoria servizio
 */
export const DELETE_SERVICE_SUBCATEGORY = gql`
  mutation DeleteServiceSubcategory($id: ID!) {
    deleteServiceSubcategory(id: $id)
  }
`;

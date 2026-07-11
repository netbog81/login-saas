import { gql } from '@apollo/client/core';
import { SERVICE_SUBCATEGORY_FIELDS } from './service-subcategory.queries';

/**
 * Mutation: Crea una nuova sottocategoria servizio
 */
export const CREATE_SERVICE_SUBCATEGORY = gql`
  ${SERVICE_SUBCATEGORY_FIELDS}
  mutation CreateServiceSubcategory($macroCategory: OperatorMacroCategory!, $name: String!, $description: String, $invoiceLineDescription: String) {
    createServiceSubcategory(macroCategory: $macroCategory, name: $name, description: $description, invoiceLineDescription: $invoiceLineDescription) {
      ...ServiceSubcategoryFields
    }
  }
`;

/**
 * Mutation: Aggiorna una sottocategoria servizio esistente
 */
export const UPDATE_SERVICE_SUBCATEGORY = gql`
  ${SERVICE_SUBCATEGORY_FIELDS}
  mutation UpdateServiceSubcategory($id: ID!, $name: String, $description: String, $invoiceLineDescription: String, $isActive: Boolean) {
    updateServiceSubcategory(id: $id, name: $name, description: $description, invoiceLineDescription: $invoiceLineDescription, isActive: $isActive) {
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

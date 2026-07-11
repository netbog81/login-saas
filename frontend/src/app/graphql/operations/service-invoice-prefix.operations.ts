import { gql } from '@apollo/client/core';

export const SERVICE_INVOICE_PREFIXES = gql`
  query ServiceInvoicePrefixes {
    serviceInvoicePrefixes {
      id
      macroCategory
      prefix
      template
      createdAt
      updatedAt
    }
  }
`;

export const UPSERT_SERVICE_INVOICE_PREFIX = gql`
  mutation UpsertServiceInvoicePrefix($input: UpsertServiceInvoicePrefixInput!) {
    upsertServiceInvoicePrefix(input: $input) {
      id
      macroCategory
      prefix
      template
      updatedAt
    }
  }
`;

export const INVOICE_LINE_SETTINGS = gql`
  query InvoiceLineSettings {
    invoiceLineSettings {
      id
      useOperatorCategories
      updatedAt
    }
  }
`;

export const SET_INVOICE_LINE_USE_OPERATOR_CATEGORIES = gql`
  mutation SetInvoiceLineUseOperatorCategories($useOperatorCategories: Boolean!) {
    setInvoiceLineUseOperatorCategories(useOperatorCategories: $useOperatorCategories) {
      id
      useOperatorCategories
      updatedAt
    }
  }
`;

export const OPERATOR_CATEGORIES_FOR_INVOICE_CONFIG = gql`
  query OperatorCategoriesForInvoiceConfig {
    operatorCategories {
      id
      macroCategory
      name
      isActive
      invoiceLineDescription
      invoicePrefix
      invoiceTemplate
    }
  }
`;

export const UPDATE_OPERATOR_CATEGORY_INVOICE_CONFIG = gql`
  mutation UpdateOperatorCategoryInvoiceConfig(
    $id: ID!
    $invoicePrefix: String
    $invoiceTemplate: String
  ) {
    updateOperatorCategory(
      id: $id
      invoicePrefix: $invoicePrefix
      invoiceTemplate: $invoiceTemplate
    ) {
      id
      invoicePrefix
      invoiceTemplate
      updatedAt
    }
  }
`;

import { gql } from '@apollo/client/core';

export const SERVICE_INVOICE_PREFIXES = gql`
  query ServiceInvoicePrefixes {
    serviceInvoicePrefixes {
      id
      macroCategory
      prefix
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
      updatedAt
    }
  }
`;

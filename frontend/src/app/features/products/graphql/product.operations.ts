import { gql } from '@apollo/client/core';

/**
 * Operations GraphQL del modulo Product.
 *
 * Single file (queries + mutations + fragment) coerente con il pattern
 * di altre feature (`features/operators-new/graphql/my-appointments.operations.ts`).
 *
 * Backend: ogni create/update/delete pubblica `product.upserted.<tenant>` o
 * `product.deleted.<tenant>` su `ex.clinical.events` verso accounting
 * (sessione 6 Step 7.6, pattern publish-after-commit).
 */

export const PRODUCT_FIELDS = gql`
  fragment ProductFields on Product {
    id
    productCode
    name
    description
    defaultPrice
    category
    isActive
    createdByUserId
    createdAt
    updatedAt
  }
`;

export const GET_PRODUCTS = gql`
  query GetProducts($onlyActive: Boolean) {
    products(onlyActive: $onlyActive) {
      ...ProductFields
    }
  }
  ${PRODUCT_FIELDS}
`;

export const GET_PRODUCT = gql`
  query GetProduct($id: ID!) {
    product(id: $id) {
      ...ProductFields
    }
  }
  ${PRODUCT_FIELDS}
`;

export const CREATE_PRODUCT = gql`
  mutation CreateProduct(
    $productCode: String!
    $name: String!
    $defaultPrice: Float!
    $description: String
    $category: String
    $isActive: Boolean
  ) {
    createProduct(
      productCode: $productCode
      name: $name
      defaultPrice: $defaultPrice
      description: $description
      category: $category
      isActive: $isActive
    ) {
      ...ProductFields
    }
  }
  ${PRODUCT_FIELDS}
`;

export const UPDATE_PRODUCT = gql`
  mutation UpdateProduct(
    $id: ID!
    $productCode: String
    $name: String
    $defaultPrice: Float
    $description: String
    $category: String
    $isActive: Boolean
  ) {
    updateProduct(
      id: $id
      productCode: $productCode
      name: $name
      defaultPrice: $defaultPrice
      description: $description
      category: $category
      isActive: $isActive
    ) {
      ...ProductFields
    }
  }
  ${PRODUCT_FIELDS}
`;

export const DELETE_PRODUCT = gql`
  mutation DeleteProduct($id: ID!) {
    deleteProduct(id: $id)
  }
`;

/**
 * Vendita rapida prodotto (sessione 6 Step 7.5 backend, Step 6.6 UI).
 *
 * Pubblica `sale.completed.<tenant>` verso accounting. Niente entità
 * Sale persistita lato clinico — `saleId` è UUID v4 generato dal backend
 * e ritornato come business key per tracking.
 *
 * Default `requestImmediateInvoice=true` lato backend → AutoIssue
 * accounting fatturazione automatica (se mapping prodotto fiscalmente
 * configurato).
 */
export const RECORD_PRODUCT_SALE = gql`
  mutation RecordProductSale($input: RecordProductSaleInput!) {
    recordProductSale(input: $input) {
      saleId
      publishedAt
      totalAmount
    }
  }
`;

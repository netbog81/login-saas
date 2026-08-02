import { gql } from 'apollo-angular';

export const OPERATOR_FE_SETTLEMENT_LINE_FIELDS = gql`
  fragment OperatorFeSettlementLineFields on OperatorFeSettlementLine {
    id
    treatmentId
    treatmentServiceId
    executionDate
    description
    serviceName
    patientName
    unitPrice
    studioExtraAmount
    baseAmount
    percentage
    compensationAmount
    studioShareAmount
    state
    isCustomPrice
  }
`;

export const OPERATOR_FE_SETTLEMENT_FIELDS = gql`
  fragment OperatorFeSettlementFields on OperatorFeSettlement {
    id
    batchId
    operatorAppUserId
    operatorName
    periodFrom
    periodTo
    includeUnpaid
    includeOpen
    countTotal
    countPaid
    countUnpaid
    countOpen
    grossAmount
    baseAmount
    compensationAmount
    studioShareAmount
    studioExtraAmount
    communicatedAt
    verifiedAt
    paidAt
    paymentDate
    notes
    createdAt
  }
`;

export const GET_OPERATORS_FOR_FE_ACCOUNTS = gql`
  query OperatorsForFeAccounts {
    operators {
      id
      name
      surname
      appUserId
      macroCategory
      royaltyPercentage
      isActive
    }
  }
`;

export const GET_OPERATOR_FE_ANALYSIS = gql`
  query OperatorFeAnalysisList($from: String!, $to: String!, $operatorAppUserIds: [ID!]) {
    operatorFeAnalysis(from: $from, to: $to, operatorAppUserIds: $operatorAppUserIds) {
      operatorAppUserId
      operatorName
      hasOperator
      royaltyPercentage
      counts {
        total
        paid
        unpaid
        open
      }
      totals {
        gross
        base
        compensation
        studioShare
        studioExtra
      }
      rows {
        treatmentId
        treatmentServiceId
        executionDate
        description
        serviceName
        patientName
        unitPrice
        studioExtraAmount
        baseAmount
        percentage
        compensationAmount
        studioShareAmount
        state
        isCustomPrice
        missingBreakdown
      }
    }
  }
`;

export const GET_OPERATOR_FE_SETTLEMENTS = gql`
  query OperatorFeSettlementsList($operatorAppUserId: ID) {
    operatorFeSettlements(operatorAppUserId: $operatorAppUserId) {
      ...OperatorFeSettlementFields
    }
  }
  ${OPERATOR_FE_SETTLEMENT_FIELDS}
`;

export const GET_OPERATOR_FE_SETTLEMENT = gql`
  query OperatorFeSettlementDetail($id: ID!) {
    operatorFeSettlement(id: $id) {
      ...OperatorFeSettlementFields
      lines {
        ...OperatorFeSettlementLineFields
      }
    }
  }
  ${OPERATOR_FE_SETTLEMENT_FIELDS}
  ${OPERATOR_FE_SETTLEMENT_LINE_FIELDS}
`;

export const GET_OPERATOR_FE_ACCOUNT_SETTINGS = gql`
  query OperatorFeAccountSettingsGet {
    operatorFeAccountSettings {
      periodMode
      cutoffDay
    }
  }
`;

export const GENERATE_OPERATOR_FE_SETTLEMENTS = gql`
  mutation GenerateOperatorFeSettlements($input: GenerateOperatorFeSettlementsInput!) {
    generateOperatorFeSettlements(input: $input) {
      ...OperatorFeSettlementFields
    }
  }
  ${OPERATOR_FE_SETTLEMENT_FIELDS}
`;

export const PATCH_OPERATOR_FE_SETTLEMENT = gql`
  mutation PatchOperatorFeSettlement($id: ID!, $input: PatchOperatorFeSettlementInput!) {
    patchOperatorFeSettlement(id: $id, input: $input) {
      ...OperatorFeSettlementFields
    }
  }
  ${OPERATOR_FE_SETTLEMENT_FIELDS}
`;

export const BULK_DELETE_OPERATOR_FE_SETTLEMENTS = gql`
  mutation BulkDeleteOperatorFeSettlements($ids: [ID!]!) {
    bulkDeleteOperatorFeSettlements(ids: $ids) {
      deleted
      skippedPaid
    }
  }
`;

export const UPDATE_OPERATOR_FE_ACCOUNT_SETTINGS = gql`
  mutation UpdateOperatorFeAccountSettings($input: UpdateOperatorFeAccountSettingsInput!) {
    updateOperatorFeAccountSettings(input: $input) {
      periodMode
      cutoffDay
    }
  }
`;

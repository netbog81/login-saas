import { gql } from 'apollo-angular';
import { TREATMENT_WITH_RELATIONS_FRAGMENT } from './treatment.queries';

// ==================== TREATMENT MUTATIONS ====================

export const CREATE_TREATMENT = gql`
  mutation CreateTreatment($appointmentId: ID!, $therapeuticPathId: ID!, $scontoFE: Boolean) {
    createTreatment(appointmentId: $appointmentId, therapeuticPathId: $therapeuticPathId, scontoFE: $scontoFE) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const COMPLETE_TREATMENT = gql`
  mutation CompleteTreatment($id: ID!, $input: CompleteTreatmentInput!) {
    completeTreatment(id: $id, input: $input) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

// Operation name `CloseTreatmentLegacy` per evitare collisione codegen con
// `features/trattamenti/graphql/trattamenti.operations.ts` (pattern "feature
// wins": le operations dentro features/<name>/graphql/ tengono il nome
// originale; questa legacy riceve suffisso). La const TS resta `CLOSE_TREATMENT`
// → caller (app/services/treatment.service.ts) intatti.
export const CLOSE_TREATMENT = gql`
  mutation CloseTreatmentLegacy($id: ID!, $input: CloseTreatmentInput!) {
    closeTreatment(id: $id, input: $input) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

/**
 * @deprecated Usa REOPEN_TREATMENT_BY_OPERATOR o REOPEN_TREATMENT_BY_SECRETARY.
 * Manteniamo questa per retrocompatibilità durante la transizione.
 */
// Operation name `ReopenTreatmentLegacy` per evitare collisione codegen
// (vedi nota su CloseTreatment).
export const REOPEN_TREATMENT = gql`
  mutation ReopenTreatmentLegacy($id: ID!) {
    reopenTreatment(id: $id) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const REOPEN_TREATMENT_BY_OPERATOR = gql`
  mutation ReopenTreatmentByOperator($id: ID!) {
    reopenTreatmentByOperator(id: $id) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const REOPEN_TREATMENT_BY_SECRETARY = gql`
  mutation ReopenTreatmentBySecretary($id: ID!) {
    reopenTreatmentBySecretary(id: $id) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

/**
 * Segreteria forza la chiusura di un trattamento rimasto IN_PROGRESS
 * (operatore dimentico). IN_PROGRESS → CLOSED in una sola transizione.
 */
// Operation name `ForceCloseTreatmentLegacy` per evitare collisione codegen.
export const FORCE_CLOSE_TREATMENT = gql`
  mutation ForceCloseTreatmentLegacy($id: ID!, $secretaryNotes: String) {
    forceCloseTreatment(id: $id, secretaryNotes: $secretaryNotes) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

// Operation name `RecordTreatmentPaymentLegacy` per evitare collisione codegen.
export const RECORD_TREATMENT_PAYMENT = gql`
  mutation RecordTreatmentPaymentLegacy($id: ID!, $input: RecordPaymentInput!, $callerRole: TreatmentCallerRole) {
    recordTreatmentPayment(id: $id, input: $input, callerRole: $callerRole) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

// Operation name `CancelTreatmentPaymentLegacy` per evitare collisione codegen
// con la mutation omonima della feature trattamenti.
export const CANCEL_TREATMENT_PAYMENT = gql`
  mutation CancelTreatmentPaymentLegacy($id: ID!) {
    cancelTreatmentPayment(id: $id) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const MARK_TREATMENT_INVOICED_TO_PATIENT = gql`
  mutation MarkTreatmentInvoicedToPatient($id: ID!, $invoiceNumber: String) {
    markTreatmentInvoicedToPatient(id: $id, invoiceNumber: $invoiceNumber) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const MARK_TREATMENT_INVOICED_BY_OPERATOR = gql`
  mutation MarkTreatmentInvoicedByOperator($id: ID!, $invoiceNumber: String) {
    markTreatmentInvoicedByOperator(id: $id, invoiceNumber: $invoiceNumber) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const UPDATE_TREATMENT_INSTRUMENTS = gql`
  mutation UpdateTreatmentInstruments($id: ID!, $instruments: [TreatmentInstrumentInput!]!) {
    updateTreatmentInstruments(id: $id, instruments: $instruments) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const UPDATE_TREATMENT = gql`
  mutation UpdateTreatment($input: UpdateTreatmentInput!) {
    updateTreatment(input: $input) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const DELETE_TREATMENT = gql`
  mutation DeleteTreatment($id: ID!) {
    deleteTreatment(id: $id)
  }
`;

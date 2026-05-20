import { gql } from '@apollo/client/core';

/**
 * Fragment "billing context" — campi del flusso fatturazione clinico ↔
 * accounting (sessione 6). Definito separato per essere componibile in
 * future query "leggere" che vogliono solo lo stato billing senza tutti
 * i dettagli clinici (es. lista billable PENDING per dashboard segreteria).
 *
 * Spread dentro `TreatmentDetails` per backward-compatibility con tutte
 * le query/mutation esistenti.
 */
export const TREATMENT_BILLING_FIELDS = gql`
  fragment TreatmentBillingFields on Treatment {
    billingStatus
    amendmentRevision
    accountingBillableEventId
    accountingInvoiceUrl
    accountingInvoiceIssuedAt
    accountingDocumentType
    accountingCreditNoteNumber
    accountingCreditNoteIssuedAt
    accountingRefundReason
    billingAlertMessage
    billingAlertAt
    billingAlertDismissedAt
    cancelledAt
    cancelledByUserId
    cancellationReason
  }
`;

/**
 * Fragment centrale con tutti i dettagli di un Trattamento usati
 * dalla pagina/dialog. Include paziente, operatore, servizi (con
 * descrizioni riga fattura), strumenti e righe custom.
 *
 * Definito come fragment per essere riusato da tutte le query/mutation
 * che ritornano un Treatment completo.
 *
 * Spreda `TreatmentBillingFields` per esporre lo stato billing senza
 * dover modificare ogni query esistente (additivo, pattern fragment
 * composition).
 */
export const TREATMENT_DETAILS_FRAGMENT = gql`
  fragment TreatmentDetails on Treatment {
    id
    appointmentId
    operatorId
    patientId
    status
    forcedClosure
    scontoFE
    price
    isPaid
    paymentMethod
    paidAt
    collectedBy
    readyForBilling
    readyForBillingAt
    isInvoicedToPatient
    invoicedToPatientAt
    patientInvoiceNumber
    isInvoicedByOperator
    invoicedByOperatorAt
    operatorInvoiceNumber
    clinicalNotes
    secretaryNotes
    operatorNotes
    patientNotes
    painLevel
    painBefore
    painAfter
    startedAt
    completedAt
    closedAt
    createdAt
    updatedAt
    operator {
      id
      name
      surname
      macroCategory
      professionalRegistration
      canCollectPayment
      color
      appUserId
    }
    patient {
      id
      displayName
      subject {
        id
        firstName
        lastName
      }
    }
    appointment {
      id
      appointmentDate
      startTime
      endTime
    }
    treatmentServices {
      id
      serviceId
      price
      duration
      orderPosition
      isCustomPrice
      invoiceLineDescription
      invoiceLineDescriptionAuto
      service {
        id
        name
        defaultPrice
        discountFE
      }
    }
    instruments {
      id
      instrumentId
      wasUsed
      instrument {
        id
        name
      }
    }
    invoiceLines {
      id
      treatmentId
      description
      amount
      createdBy
      createdAt
      updatedAt
    }
    ...TreatmentBillingFields
  }
  ${TREATMENT_BILLING_FIELDS}
`;

// ==================== QUERIES ====================

export const TREATMENTS_FOR_SECRETARY = gql`
  query TreatmentsForSecretary(
    $patientId: ID
    $operatorId: ID
    $statuses: [TreatmentStatus!]
    $dateFrom: String
    $dateTo: String
    $readyForBilling: Boolean
    $isInvoicedToPatient: Boolean
    $scontoFE: Boolean
    $limit: Int
    $offset: Int
  ) {
    treatmentsForSecretary(
      patientId: $patientId
      operatorId: $operatorId
      statuses: $statuses
      dateFrom: $dateFrom
      dateTo: $dateTo
      readyForBilling: $readyForBilling
      isInvoicedToPatient: $isInvoicedToPatient
      scontoFE: $scontoFE
      limit: $limit
      offset: $offset
    ) {
      ...TreatmentDetails
    }
  }
  ${TREATMENT_DETAILS_FRAGMENT}
`;

export const TREATMENTS_FOR_OPERATOR = gql`
  query TreatmentsForOperator(
    $operatorId: ID!
    $statuses: [TreatmentStatus!]
    $dateFrom: String
    $dateTo: String
    $limit: Int
    $offset: Int
  ) {
    treatmentsForOperator(
      operatorId: $operatorId
      statuses: $statuses
      dateFrom: $dateFrom
      dateTo: $dateTo
      limit: $limit
      offset: $offset
    ) {
      ...TreatmentDetails
    }
  }
  ${TREATMENT_DETAILS_FRAGMENT}
`;

// ==================== MUTATIONS ====================

export const UPDATE_TREATMENT_BY_SECRETARY = gql`
  mutation UpdateTreatmentBySecretary($input: UpdateTreatmentBySecretaryInput!) {
    updateTreatmentBySecretary(input: $input) {
      ...TreatmentDetails
    }
  }
  ${TREATMENT_DETAILS_FRAGMENT}
`;

// `immediateInvoice` opzionale (default false). Se true (con ready=true),
// il payload `treatment.closed` esce con requestImmediateInvoice=true →
// AutoIssue accounting fatturazione automatica. Vedi sessione 6 Step 6.5bis.
export const SET_TREATMENTS_READY_FOR_BILLING = gql`
  mutation SetTreatmentsReadyForBilling(
    $ids: [ID!]!,
    $ready: Boolean!,
    $immediateInvoice: Boolean = false
  ) {
    setTreatmentsReadyForBilling(
      ids: $ids,
      ready: $ready,
      immediateInvoice: $immediateInvoice
    ) {
      id
      readyForBilling
      readyForBillingAt
    }
  }
`;

// Cancel treatment (sessione 6 Step 7.4 backend). Triggera publish
// `treatment.cancelled.<tenant>` SOLO se billingStatus era SENT/PENDING.
// Vincolo backend: rifiuta se status post-INVOICED.
export const CANCEL_TREATMENT_BILLING = gql`
  mutation CancelTreatmentBilling($id: ID!, $reason: String!) {
    cancelTreatment(id: $id, reason: $reason) {
      ...TreatmentDetails
    }
  }
  ${TREATMENT_DETAILS_FRAGMENT}
`;

// Dismiss billing alert (sessione 6 Step 6.7). Setta
// billingAlertDismissedAt = now lato backend. Idempotente: no-op se non
// c'è alert o è già dismissato. Use case tipico: operatore legge
// cancellation-rejected warning e clicca "Letto" nella BillingSection.
export const DISMISS_BILLING_ALERT = gql`
  mutation DismissBillingAlert($id: ID!) {
    dismissBillingAlert(id: $id) {
      ...TreatmentDetails
    }
  }
  ${TREATMENT_DETAILS_FRAGMENT}
`;

export const UPDATE_TREATMENT_SERVICE_INVOICE_DESCRIPTION = gql`
  mutation UpdateTreatmentServiceInvoiceDescription(
    $input: UpdateTreatmentServiceInvoiceDescriptionInput!
  ) {
    updateTreatmentServiceInvoiceDescription(input: $input) {
      id
      invoiceLineDescription
      invoiceLineDescriptionAuto
    }
  }
`;

export const CREATE_TREATMENT_INVOICE_LINE = gql`
  mutation CreateTreatmentInvoiceLine(
    $input: CreateTreatmentInvoiceLineInput!
    $createdBy: ID
  ) {
    createTreatmentInvoiceLine(input: $input, createdBy: $createdBy) {
      id
      treatmentId
      description
      amount
      createdBy
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_TREATMENT_INVOICE_LINE = gql`
  mutation UpdateTreatmentInvoiceLine($input: UpdateTreatmentInvoiceLineInput!) {
    updateTreatmentInvoiceLine(input: $input) {
      id
      description
      amount
      updatedAt
    }
  }
`;

export const DELETE_TREATMENT_INVOICE_LINE = gql`
  mutation DeleteTreatmentInvoiceLine($id: ID!) {
    deleteTreatmentInvoiceLine(id: $id)
  }
`;

export const RECORD_TREATMENT_PAYMENT = gql`
  mutation RecordTreatmentPayment(
    $id: ID!
    $input: RecordPaymentInput!
    $callerRole: TreatmentCallerRole
  ) {
    recordTreatmentPayment(id: $id, input: $input, callerRole: $callerRole) {
      ...TreatmentDetails
    }
  }
  ${TREATMENT_DETAILS_FRAGMENT}
`;

export const CLOSE_TREATMENT = gql`
  mutation CloseTreatment($id: ID!, $input: CloseTreatmentInput!) {
    closeTreatment(id: $id, input: $input) {
      ...TreatmentDetails
    }
  }
  ${TREATMENT_DETAILS_FRAGMENT}
`;

export const REOPEN_TREATMENT = gql`
  mutation ReopenTreatment($id: ID!) {
    reopenTreatment(id: $id) {
      ...TreatmentDetails
    }
  }
  ${TREATMENT_DETAILS_FRAGMENT}
`;

/**
 * Forza la chiusura di un trattamento rimasto IN_PROGRESS perché l'operatore
 * ha dimenticato di completarlo. Permission: `treatment_force_close`
 * (segreteria/admin). Regola UX (frontend): consentito solo dopo l'orario
 * di fine dell'appuntamento.
 */
export const FORCE_CLOSE_TREATMENT = gql`
  mutation ForceCloseTreatment($id: ID!, $secretaryNotes: String) {
    forceCloseTreatment(id: $id, secretaryNotes: $secretaryNotes) {
      ...TreatmentDetails
    }
  }
  ${TREATMENT_DETAILS_FRAGMENT}
`;

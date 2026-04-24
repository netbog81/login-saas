import { gql } from '@apollo/client/core';

/**
 * Fragment centrale con tutti i dettagli di un Trattamento usati
 * dalla pagina/dialog. Include paziente, operatore, servizi (con
 * descrizioni riga fattura), strumenti e righe custom.
 *
 * Definito come fragment per essere riusato da tutte le query/mutation
 * che ritornano un Treatment completo.
 */
export const TREATMENT_DETAILS_FRAGMENT = gql`
  fragment TreatmentDetails on Treatment {
    id
    appointmentId
    operatorId
    patientId
    status
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
    }
    patient {
      id
      nome
      cognome
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
  }
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

export const SET_TREATMENTS_READY_FOR_BILLING = gql`
  mutation SetTreatmentsReadyForBilling($ids: [ID!]!, $ready: Boolean!) {
    setTreatmentsReadyForBilling(ids: $ids, ready: $ready) {
      id
      readyForBilling
      readyForBillingAt
    }
  }
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

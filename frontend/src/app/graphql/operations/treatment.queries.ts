import { gql } from 'apollo-angular';

// ==================== FRAGMENTS ====================

export const TREATMENT_FRAGMENT = gql`
  fragment TreatmentFields on Treatment {
    id
    appointmentId
    operatorId
    patientId
    serviceId
    therapeuticPathId
    scontoFE
    status
    isTest
    forcedClosure
    startedAt
    completedAt
    closedAt
    clinicalNotes
    secretaryNotes
    operatorNotes
    patientNotes
    painLevel
    painBefore
    painAfter
    rescheduleRequested
    reschedulingType
    suggestInDays
    suggestDateRangeStart
    suggestDateRangeEnd
    reschedulingNotes
    price
    isPaid
    paymentMethod
    paidAt
    collectedBy
    isInvoicedToPatient
    invoicedToPatientAt
    patientInvoiceNumber
    isInvoicedByOperator
    invoicedByOperatorAt
    operatorInvoiceNumber
    createdAt
    updatedAt
  }
`;

export const TREATMENT_WITH_RELATIONS_FRAGMENT = gql`
  fragment TreatmentWithRelationsFields on Treatment {
    ...TreatmentFields
    appointment {
      id
      startTime
      endTime
      bookingStatus
    }
    operator {
      id
      name
      surname
      email
      royaltyPercentage
      appUserId
    }
    patient {
      id
      nome
      cognome
      codiceFiscale
      telefono
      email
    }
    service {
      id
      name
      defaultDuration
      defaultPrice
    }
    treatmentServices {
      id
      serviceId
      price
      duration
      orderPosition
      isCustomPrice
      service {
        id
        name
        defaultPrice
        discountFE
        defaultDuration
      }
    }
    instruments {
      id
      instrumentId
      instrumentCategoryId
      wasUsed
      startOffsetMinutes
      endOffsetMinutes
      orderPosition
    }
    therapeuticPath {
      id
      name
      status
      diagnosis
    }
  }
  ${TREATMENT_FRAGMENT}
`;

// ==================== QUERIES ====================

export const GET_TREATMENT = gql`
  query GetTreatment($id: ID!) {
    treatment(id: $id) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const GET_TREATMENT_BY_APPOINTMENT = gql`
  query GetTreatmentByAppointment($appointmentId: ID!) {
    treatmentByAppointment(appointmentId: $appointmentId) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

/**
 * Query batch: trattamenti per più appuntamenti in una sola chiamata.
 */
export const GET_TREATMENTS_BY_APPOINTMENTS = gql`
  query GetTreatmentsByAppointments($appointmentIds: [ID!]!) {
    treatmentsByAppointments(appointmentIds: $appointmentIds) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const GET_TREATMENTS_BY_OPERATOR = gql`
  query GetTreatmentsByOperator($operatorId: ID!, $date: String) {
    treatmentsByOperator(operatorId: $operatorId, date: $date) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

/**
 * Query bulk: Trattamenti attivi per più operatori in una data.
 */
export const GET_TREATMENTS_BY_OPERATORS = gql`
  query GetTreatmentsByOperators($operatorIds: [ID!]!, $date: String) {
    treatmentsByOperators(operatorIds: $operatorIds, date: $date) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const GET_TREATMENTS_PENDING_CLOSURE = gql`
  query GetTreatmentsPendingClosure {
    treatmentsPendingClosure {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const GET_TREATMENTS_BY_PATIENT = gql`
  query GetTreatmentsByPatient($patientId: ID!, $limit: Int, $offset: Int) {
    treatmentsByPatient(patientId: $patientId, limit: $limit, offset: $offset) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const GET_TREATMENTS_NOT_INVOICED_TO_PATIENT = gql`
  query GetTreatmentsNotInvoicedToPatient($dateFrom: String, $dateTo: String) {
    treatmentsNotInvoicedToPatient(dateFrom: $dateFrom, dateTo: $dateTo) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const GET_TREATMENTS_NOT_INVOICED_BY_OPERATOR = gql`
  query GetTreatmentsNotInvoicedByOperator($operatorId: ID, $dateFrom: String, $dateTo: String) {
    treatmentsNotInvoicedByOperator(operatorId: $operatorId, dateFrom: $dateFrom, dateTo: $dateTo) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const GET_TREATMENTS_BY_THERAPEUTIC_PATH = gql`
  query GetTreatmentsByTherapeuticPath($therapeuticPathId: ID!) {
    treatmentsByTherapeuticPath(therapeuticPathId: $therapeuticPathId) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

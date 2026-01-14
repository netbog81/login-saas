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
    startedAt
    completedAt
    closedAt
    clinicalNotes
    secretaryNotes
    operatorNotes
    painLevel
    painBefore
    painAfter
    rescheduleRequested
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

export const GET_TREATMENTS_BY_OPERATOR = gql`
  query GetTreatmentsByOperator($operatorId: ID!, $date: String) {
    treatmentsByOperator(operatorId: $operatorId, date: $date) {
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
  query GetTreatmentsByPatient($patientId: Int!, $limit: Int, $offset: Int) {
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

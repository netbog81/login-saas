import { gql } from 'apollo-angular';
import { TREATMENT_WITH_RELATIONS_FRAGMENT } from './treatment.queries';

// ==================== TREATMENT MUTATIONS ====================

export const CREATE_TREATMENT = gql`
  mutation CreateTreatment($appointmentId: ID!) {
    createTreatment(appointmentId: $appointmentId) {
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

export const CLOSE_TREATMENT = gql`
  mutation CloseTreatment($id: ID!, $input: CloseTreatmentInput!) {
    closeTreatment(id: $id, input: $input) {
      ...TreatmentWithRelationsFields
    }
  }
  ${TREATMENT_WITH_RELATIONS_FRAGMENT}
`;

export const RECORD_TREATMENT_PAYMENT = gql`
  mutation RecordTreatmentPayment($id: ID!, $input: RecordPaymentInput!) {
    recordTreatmentPayment(id: $id, input: $input) {
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

// ==================== APPOINTMENT STATUS MUTATIONS ====================

export const CANCEL_APPOINTMENT_WITH_NOTICE = gql`
  mutation CancelAppointmentWithNotice($id: ID!, $input: CancelAppointmentInput!) {
    cancelAppointmentWithNotice(id: $id, input: $input) {
      id
      bookingStatus
      cancelledAt
      cancelledBy
      cancellationHoursNotice
      notes
    }
  }
`;

export const MARK_APPOINTMENT_NO_SHOW = gql`
  mutation MarkAppointmentNoShow($id: ID!) {
    markAppointmentNoShow(id: $id) {
      id
      bookingStatus
    }
  }
`;

export const MARK_APPOINTMENT_ATTENDED = gql`
  mutation MarkAppointmentAttended($id: ID!) {
    markAppointmentAttended(id: $id) {
      id
      bookingStatus
    }
  }
`;

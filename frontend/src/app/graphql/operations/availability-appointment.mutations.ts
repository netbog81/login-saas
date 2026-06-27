import { gql } from '@apollo/client/core';
import { AVAILABILITY_APPOINTMENT_FIELDS } from './availability-appointment.queries';

/**
 * Mutation: Crea un nuovo appuntamento
 */
export const CREATE_AVAILABILITY_APPOINTMENT = gql`
  ${AVAILABILITY_APPOINTMENT_FIELDS}
  mutation CreateAvailabilityAppointment($input: CreateAvailabilityAppointmentInput!) {
    createAvailabilityAppointment(input: $input) {
      ...AvailabilityAppointmentFields
    }
  }
`;

/**
 * Mutation: Aggiorna un appuntamento esistente
 */
export const UPDATE_AVAILABILITY_APPOINTMENT = gql`
  ${AVAILABILITY_APPOINTMENT_FIELDS}
  mutation UpdateAvailabilityAppointment($id: ID!, $input: UpdateAvailabilityAppointmentInput!) {
    updateAvailabilityAppointment(id: $id, input: $input) {
      ...AvailabilityAppointmentFields
    }
  }
`;

/**
 * Mutation: Cancella un appuntamento (soft delete)
 */
export const CANCEL_AVAILABILITY_APPOINTMENT = gql`
  ${AVAILABILITY_APPOINTMENT_FIELDS}
  mutation CancelAvailabilityAppointment($id: ID!, $cancellationReason: String) {
    cancelAvailabilityAppointment(id: $id, cancellationReason: $cancellationReason) {
      ...AvailabilityAppointmentFields
    }
  }
`;

/**
 * Mutation: Elimina definitivamente un appuntamento
 */
export const DELETE_AVAILABILITY_APPOINTMENT = gql`
  mutation DeleteAvailabilityAppointment($id: ID!) {
    deleteAvailabilityAppointment(id: $id)
  }
`;

/**
 * Mutation: Conferma un appuntamento
 */
export const CONFIRM_AVAILABILITY_APPOINTMENT = gql`
  ${AVAILABILITY_APPOINTMENT_FIELDS}
  mutation ConfirmAvailabilityAppointment($id: ID!) {
    confirmAvailabilityAppointment(id: $id) {
      ...AvailabilityAppointmentFields
    }
  }
`;

/**
 * Mutation: Segna come no-show
 */
export const MARK_APPOINTMENT_AS_NO_SHOW = gql`
  ${AVAILABILITY_APPOINTMENT_FIELDS}
  mutation MarkAppointmentAsNoShow($id: ID!) {
    markAppointmentAsNoShow(id: $id) {
      ...AvailabilityAppointmentFields
    }
  }
`;

/**
 * Mutation: Cancella appuntamento con calcolo automatico preavviso
 * - >24h → cancelled_early
 * - <24h → cancelled_late (incrementa contatore paziente)
 */
export const CANCEL_APPOINTMENT_WITH_NOTICE = gql`
  ${AVAILABILITY_APPOINTMENT_FIELDS}
  mutation CancelAppointmentWithNotice($id: ID!, $reason: String!, $cancelledBy: ID!) {
    cancelAppointmentWithNotice(id: $id, reason: $reason, cancelledBy: $cancelledBy) {
      ...AvailabilityAppointmentFields
    }
  }
`;

/**
 * Mutation: Segna paziente come presentato (abilita creazione trattamento)
 */
export const MARK_APPOINTMENT_ATTENDED = gql`
  ${AVAILABILITY_APPOINTMENT_FIELDS}
  mutation MarkAppointmentAttended($id: ID!) {
    markAppointmentAttended(id: $id) {
      ...AvailabilityAppointmentFields
    }
  }
`;

/**
 * Mutation: Annulla stato attended e ripristina a confirmed
 * Utile per correggere click accidentali
 */
export const REVERT_APPOINTMENT_ATTENDED = gql`
  ${AVAILABILITY_APPOINTMENT_FIELDS}
  mutation RevertAppointmentAttended($id: ID!) {
    revertAppointmentAttended(id: $id) {
      ...AvailabilityAppointmentFields
    }
  }
`;

/**
 * Mutation: Re-invia il messaggio WhatsApp di recap per un appuntamento
 */
export const SEND_APPOINTMENT_RECAP = gql`
  mutation SendAppointmentRecap($appointmentId: ID!) {
    sendAppointmentRecap(appointmentId: $appointmentId)
  }
`;

// ==================== RECURRING SERIES ====================

/**
 * Mutation: Cancella (soft) appuntamenti di una serie ricorrente
 */
export const CANCEL_RECURRING_SERIES = gql`
  mutation CancelRecurringSeries(
    $appointmentId: ID!
    $fromDate: String!
    $scope: RecurringSeriesScope!
    $reason: String!
    $cancelledBy: ID!
  ) {
    cancelRecurringSeries(
      appointmentId: $appointmentId
      fromDate: $fromDate
      scope: $scope
      reason: $reason
      cancelledBy: $cancelledBy
    )
  }
`;

/**
 * Mutation: Elimina (hard delete) appuntamenti di una serie ricorrente
 */
export const DELETE_RECURRING_SERIES = gql`
  mutation DeleteRecurringSeries(
    $appointmentId: ID!
    $fromDate: String!
    $scope: RecurringSeriesScope!
    $rangeFrom: String
    $rangeTo: String
    $includeCurrent: Boolean
  ) {
    deleteRecurringSeries(
      appointmentId: $appointmentId
      fromDate: $fromDate
      scope: $scope
      rangeFrom: $rangeFrom
      rangeTo: $rangeTo
      includeCurrent: $includeCurrent
    )
  }
`;

/**
 * Mutation: Modifica orario/durata delle occorrenze di una serie ricorrente.
 * Ritorna i conflitti rilevati (se non vuoti, nulla è stato applicato).
 */
export const UPDATE_RECURRING_SERIES_TIME = gql`
  mutation UpdateRecurringSeriesTime($input: UpdateRecurringSeriesTimeInput!) {
    updateRecurringSeriesTime(input: $input) {
      applied
      affectedCount
      conflicts {
        appointmentId
        date
        startTime
        endTime
        type
        reason
        conflictingStartTime
        conflictingEndTime
      }
    }
  }
`;

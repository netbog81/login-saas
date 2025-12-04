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

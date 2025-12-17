import { gql } from '@apollo/client/core';

/**
 * Fragment per i campi comuni degli appuntamenti
 */
export const AVAILABILITY_APPOINTMENT_FIELDS = gql`
  fragment AvailabilityAppointmentFields on AvailabilityAppointment {
    id
    operatorId
    serviceId
    clientName
    clientEmail
    clientPhone
    patientId
    appointmentDate
    startTime
    endTime
    bookingStatus
    treatmentStatus
    hasConflict
    conflictReason
    notes
    cancellationReason
    cancelledAt
    cancelledBy
    cancellationHoursNotice
    operatorNotes
    instrumentOrderMatters
    createdAt
    updatedAt
    operator {
      id
      name
      surname
      color
    }
    service {
      id
      name
    }
    instruments {
      id
      instrumentId
      startOffsetMinutes
      endOffsetMinutes
      orderPosition
      instrument {
        id
        name
        color
        category {
          id
          name
        }
      }
    }
  }
`;

/**
 * Query: Ottiene un singolo appuntamento per ID
 */
export const GET_AVAILABILITY_APPOINTMENT = gql`
  ${AVAILABILITY_APPOINTMENT_FIELDS}
  query GetAvailabilityAppointment($id: ID!) {
    availabilityAppointment(id: $id) {
      ...AvailabilityAppointmentFields
    }
  }
`;

/**
 * Query: Ottiene appuntamenti per operatore e range di date
 */
export const GET_AVAILABILITY_APPOINTMENTS_BY_OPERATOR = gql`
  ${AVAILABILITY_APPOINTMENT_FIELDS}
  query GetAvailabilityAppointmentsByOperator(
    $operatorId: ID!
    $startDate: String!
    $endDate: String!
  ) {
    availabilityAppointmentsByOperator(
      operatorId: $operatorId
      startDate: $startDate
      endDate: $endDate
    ) {
      ...AvailabilityAppointmentFields
    }
  }
`;

/**
 * Query: Ottiene appuntamenti per range di date (tutti o specifici operatori)
 */
export const GET_AVAILABILITY_APPOINTMENTS = gql`
  ${AVAILABILITY_APPOINTMENT_FIELDS}
  query GetAvailabilityAppointments(
    $startDate: String!
    $endDate: String!
    $operatorIds: [ID!]
  ) {
    availabilityAppointments(
      startDate: $startDate
      endDate: $endDate
      operatorIds: $operatorIds
    ) {
      ...AvailabilityAppointmentFields
    }
  }
`;

/**
 * Query: Verifica disponibilità strumento singolo
 */
export const IS_INSTRUMENT_AVAILABLE = gql`
  query IsInstrumentAvailable(
    $instrumentId: ID!
    $appointmentDate: String!
    $startTime: String!
    $startOffsetMinutes: Int!
    $endOffsetMinutes: Int!
    $excludeAppointmentId: ID
  ) {
    isInstrumentAvailable(
      instrumentId: $instrumentId
      appointmentDate: $appointmentDate
      startTime: $startTime
      startOffsetMinutes: $startOffsetMinutes
      endOffsetMinutes: $endOffsetMinutes
      excludeAppointmentId: $excludeAppointmentId
    )
  }
`;

/**
 * Query: Verifica disponibilità slot con strumenti multipli
 * Usata per validazione real-time nel modal di prenotazione
 */
export const CHECK_SLOT_AVAILABILITY = gql`
  query CheckAppointmentSlotAvailability($input: CheckPhysiotherapistAvailabilityInput!) {
    physiotherapistAvailableSlots(input: $input) {
      startTime
      endTime
      available
      reason
      suggestedInstruments {
        instrumentCategoryId
        categoryName
        instrumentId
        startOffsetMinutes
        endOffsetMinutes
      }
    }
  }
`;

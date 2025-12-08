import { gql } from '@apollo/client/core';

/**
 * Fragment per i campi degli appuntamenti palestra
 */
export const GYM_APPOINTMENT_FIELDS = gql`
  fragment GymAppointmentFields on AvailabilityAppointment {
    id
    operatorId
    gymRoomId
    clientName
    clientEmail
    clientPhone
    patientId
    appointmentDate
    startTime
    endTime
    bookingStatus
    treatmentStatus
    notes
    participantCount
    maxParticipants
    isRecurring
    recurringGroupId
    createdAt
    updatedAt
    operator {
      id
      name
      surname
      color
    }
    gymRoom {
      id
      name
      color
      maxCapacity
    }
  }
`;

/**
 * Fragment per le informazioni sugli slot palestra
 */
export const GYM_SLOT_INFO_FIELDS = gql`
  fragment GymSlotInfoFields on GymSlotInfo {
    startTime
    endTime
    operator {
      id
      name
      surname
    }
    currentCount
    maxCapacity
    isAvailable
    isClosed
  }
`;

/**
 * Query: Ottiene appuntamenti per una GymRoom in una data specifica
 */
export const GET_GYM_ROOM_APPOINTMENTS = gql`
  ${GYM_APPOINTMENT_FIELDS}
  query GetGymRoomAppointments($gymRoomId: ID!, $date: String!) {
    gymRoomAppointments(gymRoomId: $gymRoomId, date: $date) {
      ...GymAppointmentFields
    }
  }
`;

/**
 * Query: Ottiene appuntamenti per più GymRoom in un range di date
 */
export const GET_GYM_ROOMS_APPOINTMENTS = gql`
  ${GYM_APPOINTMENT_FIELDS}
  query GetGymRoomsAppointments(
    $gymRoomIds: [ID!]!
    $startDate: String!
    $endDate: String!
  ) {
    gymRoomsAppointments(
      gymRoomIds: $gymRoomIds
      startDate: $startDate
      endDate: $endDate
    ) {
      ...GymAppointmentFields
    }
  }
`;

/**
 * Query: Ottiene gli slot disponibili per una GymRoom in una data
 */
export const GET_GYM_ROOM_AVAILABLE_SLOTS = gql`
  ${GYM_SLOT_INFO_FIELDS}
  query GetGymRoomAvailableSlots($gymRoomId: ID!, $date: String!) {
    gymRoomAvailableSlots(gymRoomId: $gymRoomId, date: $date) {
      ...GymSlotInfoFields
    }
  }
`;

/**
 * Mutation: Crea un appuntamento palestra
 */
export const CREATE_GYM_APPOINTMENT = gql`
  ${GYM_APPOINTMENT_FIELDS}
  mutation CreateGymAppointment($input: CreateGymAppointmentInput!) {
    createGymAppointment(input: $input) {
      ...GymAppointmentFields
    }
  }
`;

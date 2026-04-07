import { gql } from '@apollo/client/core';
import { GYM_APPOINTMENT_FIELDS } from './gym-appointment.queries';

/**
 * Query: Ottiene appuntamenti palestra per un istruttore in un range di date.
 * Riusa GYM_APPOINTMENT_FIELDS (include gymRoomId, gymRoom) con la query
 * backend esistente availabilityAppointmentsByOperator.
 */
export const GET_INSTRUCTOR_APPOINTMENTS = gql`
  ${GYM_APPOINTMENT_FIELDS}
  query GetInstructorAppointments(
    $operatorId: ID!
    $startDate: String!
    $endDate: String!
  ) {
    availabilityAppointmentsByOperator(
      operatorId: $operatorId
      startDate: $startDate
      endDate: $endDate
    ) {
      ...GymAppointmentFields
    }
  }
`;

import { gql } from '@apollo/client/core';

/**
 * Fragment per i campi comuni delle GymException
 */
export const GYM_EXCEPTION_FIELDS = gql`
  fragment GymExceptionFields on GymException {
    id
    gymRoomId
    operatorId
    exceptionDate
    startTime
    endTime
    exceptionType
    substituteOperatorId
    reason
    createdBy
    createdAt
    updatedAt
    gymRoom {
      id
      name
    }
    operator {
      id
      name
      surname
      color
    }
    substituteOperator {
      id
      name
      surname
      color
    }
  }
`;

/**
 * Query: Ottiene le eccezioni per una palestra in un range di date
 */
export const GET_GYM_EXCEPTIONS = gql`
  ${GYM_EXCEPTION_FIELDS}
  query GetGymExceptions($gymRoomId: ID!, $startDate: String!, $endDate: String!) {
    gymExceptions(gymRoomId: $gymRoomId, startDate: $startDate, endDate: $endDate) {
      ...GymExceptionFields
    }
  }
`;

/**
 * Query: Ottiene le eccezioni per una palestra in una data specifica
 */
export const GET_GYM_EXCEPTIONS_BY_DATE = gql`
  ${GYM_EXCEPTION_FIELDS}
  query GetGymExceptionsByDate($gymRoomId: ID!, $date: String!) {
    gymExceptionsByDate(gymRoomId: $gymRoomId, date: $date) {
      ...GymExceptionFields
    }
  }
`;

/**
 * Query: Ottiene una singola eccezione per ID
 */
export const GET_GYM_EXCEPTION = gql`
  ${GYM_EXCEPTION_FIELDS}
  query GetGymException($id: ID!) {
    gymException(id: $id) {
      ...GymExceptionFields
    }
  }
`;

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
    absenceTypeId
    absenceTypeSnapshot {
      id
      name
      description
    }
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
    substitutes {
      id
      gymRoomId
      startTime
      endTime
      substituteOperatorId
      isClosed
      gymRoom {
        id
        name
      }
      substituteOperator {
        id
        name
        surname
        color
      }
    }
  }
`;

/**
 * Query: Ottiene le eccezioni per una palestra in un range di date
 * (include sia scoped sia operator-wide che toccano quella palestra)
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

/**
 * Query: Slot (palestra + fascia oraria) in cui un operatore è schedulato
 * in una data specifica, derivati dai GymTemplatePattern correnti.
 * Usato dal modal "Nuova eccezione" per popolare la griglia di slot coverabili.
 */
export const GET_OPERATOR_PATTERNS_ON_DATE = gql`
  query GetOperatorPatternsOnDate($operatorId: ID!, $date: String!) {
    operatorPatternsOnDate(operatorId: $operatorId, date: $date) {
      gymRoom {
        id
        name
      }
      startTime
      endTime
    }
  }
`;

/**
 * Query: Operatori GYM_INSTRUCTOR liberi in una fascia oraria di una palestra.
 * Usato dal toggle "Mostra operatori disponibili" nel modal di eccezione.
 */
export const GET_AVAILABLE_OPERATORS_FOR_SLOT = gql`
  query GetAvailableOperatorsForSlot(
    $gymRoomId: ID!
    $date: String!
    $startTime: String!
    $endTime: String!
    $excludeOperatorId: ID!
  ) {
    availableOperatorsForSlot(
      gymRoomId: $gymRoomId
      date: $date
      startTime: $startTime
      endTime: $endTime
      excludeOperatorId: $excludeOperatorId
    ) {
      id
      name
      surname
      color
    }
  }
`;

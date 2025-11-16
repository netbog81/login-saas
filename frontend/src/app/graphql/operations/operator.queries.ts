import { gql } from '@apollo/client/core';

export const GET_OPERATORS = gql`
  query GetOperators {
    operators {
      id
      name
      surname
      email
      phone
      color
      operatorType
      maxConcurrentAppointments
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const GET_OPERATOR = gql`
  query GetOperator($id: ID!) {
    operator(id: $id) {
      id
      name
      surname
      email
      phone
      color
      operatorType
      maxConcurrentAppointments
      isActive
      createdAt
      updatedAt
      availabilityTemplates {
        id
        name
        description
        dayInPattern
        patternDuration
        startTime
        endTime
        isCurrent
        validFrom
        validUntil
      }
      availabilityExceptions {
        id
        exceptionDate
        exceptionType
        startTime
        endTime
        reason
      }
    }
  }
`;

export const GET_OPERATOR_AVAILABILITY = gql`
  query GetOperatorAvailability($operatorId: ID!, $startDate: String!, $endDate: String!) {
    operatorAvailability(operatorId: $operatorId, startDate: $startDate, endDate: $endDate) {
      date
      hasAvailability
      slots {
        operatorId
        date
        startTime
        endTime
        totalCapacity
        bookedCapacity
        availableCapacity
        isAvailable
        source
        sourceId
      }
    }
  }
`;
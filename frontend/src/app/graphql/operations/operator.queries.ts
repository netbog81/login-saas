import { gql } from '@apollo/client/core';

export const GET_OPERATORS = gql`
  query GetOperators(
    $macroCategory: OperatorMacroCategory
    $categoryId: ID
    $onlyActive: Boolean
  ) {
    operators(
      macroCategory: $macroCategory
      categoryId: $categoryId
      onlyActive: $onlyActive
    ) {
      id
      name
      surname
      email
      phone
      color
      macroCategory
      categoryId
      category {
        id
        name
        macroCategory
        description
      }
      preferredDurations
      legacyUserId
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
      macroCategory
      categoryId
      category {
        id
        name
        macroCategory
        description
      }
      preferredDurations
      legacyUserId
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

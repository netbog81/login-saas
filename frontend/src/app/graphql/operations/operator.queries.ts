import { gql } from '@apollo/client/core';

export const CHECK_DUPLICATE_OPERATOR = gql`
  query CheckDuplicateOperator($name: String!, $surname: String) {
    checkDuplicateOperator(name: $name, surname: $surname) {
      id
      name
      surname
      email
      macroCategory
      category {
        id
        name
      }
    }
  }
`;

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
      royaltyPercentage
      professionalRegistration
      createdAt
      updatedAt
      templateAssignments {
        id
        isCurrent
      }
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
      royaltyPercentage
      professionalRegistration
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

export const MY_OPERATOR = gql`
  query MyOperator {
    myOperator {
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
      royaltyPercentage
      professionalRegistration
      createdAt
      updatedAt
      templateAssignments {
        id
        isCurrent
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

/**
 * Query bulk: Disponibilità per più operatori in un range di date.
 */
export const GET_OPERATORS_AVAILABILITY = gql`
  query GetOperatorsAvailability($operatorIds: [ID!]!, $startDate: String!, $endDate: String!) {
    operatorsAvailability(operatorIds: $operatorIds, startDate: $startDate, endDate: $endDate) {
      operatorId
      availability {
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
  }
`;

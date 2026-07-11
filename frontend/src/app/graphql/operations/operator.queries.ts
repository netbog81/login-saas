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
        invoiceLineDescription
      }
      preferredDurations
      legacyUserId
      maxConcurrentAppointments
      isActive
      royaltyPercentage
      professionalRegistration
      professionalTitle
      taxCode
      vatNumber
      canCollectPayment
      createdAt
      updatedAt
      deletedAt
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
        invoiceLineDescription
      }
      preferredDurations
      legacyUserId
      maxConcurrentAppointments
      isActive
      royaltyPercentage
      professionalRegistration
      professionalTitle
      taxCode
      vatNumber
      canCollectPayment
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
        invoiceLineDescription
      }
      preferredDurations
      legacyUserId
      maxConcurrentAppointments
      isActive
      royaltyPercentage
      professionalRegistration
      professionalTitle
      taxCode
      vatNumber
      canCollectPayment
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
 * Lista degli operatori archiviati (soft-deletati). Solo per la pagina
 * admin "Operatori archiviati" — richiede permission `operator_manage`.
 */
export const GET_ARCHIVED_OPERATORS = gql`
  query GetArchivedOperators {
    archivedOperators {
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
      }
      isActive
      deletedAt
      deletedByUserId
      appUserId
      createdAt
      updatedAt
    }
  }
`;

/**
 * Conteggio dipendenze storiche di un operatore. Usato dal dialog di
 * conferma archiviazione per dare contesto all'admin.
 */
export const GET_OPERATOR_DEPENDENCIES = gql`
  query GetOperatorDependencies($id: ID!) {
    operatorDependencies(id: $id) {
      total
      treatments
      therapeuticPaths
      evaluations
      anamnesis
      appointments
      gymSchedules
      templateAssignments
      waitingList
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

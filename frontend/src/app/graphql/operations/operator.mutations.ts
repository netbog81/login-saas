import { gql } from '@apollo/client/core';

export const CREATE_OPERATOR = gql`
  mutation CreateOperator($input: CreateOperatorInput!) {
    createOperator(input: $input) {
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
      preferredDurations
      userId
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
    }
  }
`;

export const UPDATE_OPERATOR = gql`
  mutation UpdateOperator($id: ID!, $input: UpdateOperatorInput!) {
    updateOperator(id: $id, input: $input) {
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
      preferredDurations
      userId
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
    }
  }
`;

/**
 * Elimina un operatore. Lato backend:
 *  - se l'operatore ha dipendenze storiche (trattamenti, percorsi, ecc.)
 *    viene archiviato (soft-delete) preservando lo storico clinico
 *  - se non ha dipendenze viene eliminato definitivamente
 * Il client può distinguere i due casi tramite il campo `archived`.
 */
export const DELETE_OPERATOR = gql`
  mutation DeleteOperator($id: ID!) {
    deleteOperator(id: $id) {
      archived
      hardDeleted
      dependencies {
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
  }
`;

/** Ripristina un operatore archiviato. */
export const RESTORE_OPERATOR = gql`
  mutation RestoreOperator($id: ID!) {
    restoreOperator(id: $id) {
      id
      name
      surname
      isActive
      deletedAt
    }
  }
`;

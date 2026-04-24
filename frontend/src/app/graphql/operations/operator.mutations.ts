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
      canCollectPayment
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_OPERATOR = gql`
  mutation DeleteOperator($id: ID!) {
    deleteOperator(id: $id)
  }
`;

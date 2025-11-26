import { gql } from '@apollo/client/core';

export const CREATE_OPERATOR = gql`
  mutation CreateOperator(
    $name: String!
    $surname: String
    $email: String
    $phone: String
    $color: String
    $macroCategory: OperatorMacroCategory!
    $categoryId: ID
    $preferredDurations: [Int!]
    $maxConcurrentAppointments: Int
    $legacyUserId: Int
  ) {
    createOperator(
      name: $name
      surname: $surname
      email: $email
      phone: $phone
      color: $color
      macroCategory: $macroCategory
      categoryId: $categoryId
      preferredDurations: $preferredDurations
      maxConcurrentAppointments: $maxConcurrentAppointments
      legacyUserId: $legacyUserId
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

export const UPDATE_OPERATOR = gql`
  mutation UpdateOperator(
    $id: ID!
    $name: String
    $surname: String
    $email: String
    $phone: String
    $color: String
    $macroCategory: OperatorMacroCategory
    $categoryId: ID
    $preferredDurations: [Int!]
    $isActive: Boolean
    $maxConcurrentAppointments: Int
    $legacyUserId: Int
  ) {
    updateOperator(
      id: $id
      name: $name
      surname: $surname
      email: $email
      phone: $phone
      color: $color
      macroCategory: $macroCategory
      categoryId: $categoryId
      preferredDurations: $preferredDurations
      isActive: $isActive
      maxConcurrentAppointments: $maxConcurrentAppointments
      legacyUserId: $legacyUserId
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

export const DELETE_OPERATOR = gql`
  mutation DeleteOperator($id: ID!) {
    deleteOperator(id: $id)
  }
`;

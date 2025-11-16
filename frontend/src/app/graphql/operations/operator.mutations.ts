import { gql } from '@apollo/client/core';

export const CREATE_OPERATOR = gql`
  mutation CreateOperator(
    $name: String!
    $surname: String
    $email: String
    $phone: String
    $color: String
    $operatorType: OperatorType
    $maxConcurrentAppointments: Float
  ) {
    createOperator(
      name: $name
      surname: $surname
      email: $email
      phone: $phone
      color: $color
      operatorType: $operatorType
      maxConcurrentAppointments: $maxConcurrentAppointments
    ) {
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

export const UPDATE_OPERATOR = gql`
  mutation UpdateOperator(
    $id: ID!
    $name: String
    $surname: String
    $email: String
    $phone: String
    $operatorType: OperatorType
    $isActive: Boolean
    $maxConcurrentAppointments: Float
  ) {
    updateOperator(
      id: $id
      name: $name
      surname: $surname
      email: $email
      phone: $phone
      operatorType: $operatorType
      isActive: $isActive
      maxConcurrentAppointments: $maxConcurrentAppointments
    ) {
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

export const DELETE_OPERATOR = gql`
  mutation DeleteOperator($id: ID!) {
    deleteOperator(id: $id)
  }
`;
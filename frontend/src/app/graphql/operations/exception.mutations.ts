import { gql } from '@apollo/client/core';

export const CREATE_AVAILABILITY_EXCEPTION = gql`
  mutation CreateAvailabilityException(
    $operatorId: ID!
    $date: String!
    $type: String!
    $startTime: String
    $endTime: String
    $reason: String
  ) {
    createAvailabilityException(
      operatorId: $operatorId
      date: $date
      type: $type
      startTime: $startTime
      endTime: $endTime
      reason: $reason
    ) {
      id
      operatorId
      exceptionDate
      exceptionType
      startTime
      endTime
      groupExceptionId
      reason
      createdAt
    }
  }
`;

export const CREATE_GROUP_EXCEPTION = gql`
  mutation CreateGroupException(
    $name: String!
    $exceptionDate: String!
    $exceptionType: String!
    $appliesToAll: Boolean
    $operatorIds: [ID!]
    $reason: String
  ) {
    createGroupException(
      name: $name
      exceptionDate: $exceptionDate
      exceptionType: $exceptionType
      appliesToAll: $appliesToAll
      operatorIds: $operatorIds
      reason: $reason
    ) {
      id
      name
      exceptionDate
      exceptionType
      appliesToAll
      reason
      createdAt
    }
  }
`;

export const DELETE_GROUP_EXCEPTION = gql`
  mutation DeleteGroupException($id: ID!) {
    deleteGroupException(id: $id)
  }
`;
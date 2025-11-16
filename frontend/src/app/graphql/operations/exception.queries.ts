import { gql } from '@apollo/client/core';

export const GET_GROUP_EXCEPTIONS = gql`
  query GetGroupExceptions {
    groupExceptions {
      id
      name
      exceptionDate
      exceptionType
      appliesToAll
      reason
      createdAt
      exceptions {
        id
        operatorId
        exceptionDate
        exceptionType
        startTime
        endTime
        reason
      }
    }
  }
`;
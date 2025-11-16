import { gql } from '@apollo/client/core';

export const GET_AVAILABILITY_TEMPLATES = gql`
  query GetAvailabilityTemplates($operatorId: ID!, $onlyCurrent: Boolean) {
    availabilityTemplates(operatorId: $operatorId, onlyCurrent: $onlyCurrent) {
      id
      operatorId
      name
      description
      dayInPattern
      patternDuration
      patternStartDate
      startTime
      endTime
      version
      isCurrent
      validFrom
      validUntil
      createdAt
      updatedAt
    }
  }
`;
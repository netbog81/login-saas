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

export const GET_ALL_TEMPLATES = gql`
  query GetAllTemplates ($operatorId: ID!) {
    availabilityTemplates(operatorId: $operatorId) {
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

export const GET_ALL_TEMPLATE_PATTERNS = gql`
  query GetAllTemplatePatterns {
    allTemplatePatterns {
      id
      name
      description
      dayInPattern
      patternDuration
      startTime
      endTime
      createdAt
      updatedAt
    }
  }
`;
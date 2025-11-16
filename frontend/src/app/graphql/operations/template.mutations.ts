import { gql } from '@apollo/client/core';

export const CREATE_AVAILABILITY_TEMPLATE = gql`
  mutation CreateAvailabilityTemplate($input: CreateAvailabilityTemplateInput!) {
    createAvailabilityTemplate(input: $input) {
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

export const UPDATE_AVAILABILITY_TEMPLATE = gql`
  mutation UpdateAvailabilityTemplate($id: ID!, $input: CreateAvailabilityTemplateInput!) {
    updateAvailabilityTemplate(id: $id, input: $input) {
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

export const DELETE_AVAILABILITY_TEMPLATE = gql`
  mutation DeleteAvailabilityTemplate($id: ID!) {
    deleteAvailabilityTemplate(id: $id)
  }
`;

export const REBUILD_AVAILABILITY_CACHE = gql`
  mutation RebuildAvailabilityCache(
    $operatorId: ID!
    $startDate: String!
    $endDate: String!
  ) {
    rebuildAvailabilityCache(
      operatorId: $operatorId
      startDate: $startDate
      endDate: $endDate
    )
  }
`;
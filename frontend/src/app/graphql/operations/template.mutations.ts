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

export const CREATE_PATTERN_GROUP = gql`
  mutation CreatePatternGroup($input: CreatePatternGroupInput!) {
    createPatternGroup(input: $input) {
      id
      name
      description
      patternDuration
      isActive
      createdAt
      updatedAt
      patterns {
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
  }
`;

/**
 * @deprecated Use CREATE_PATTERN_GROUP instead
 */
export const CREATE_TEMPLATE_PATTERN = gql`
  mutation CreateTemplatePattern($input: CreateTemplatePatternInput!) {
    createTemplatePattern(input: $input) {
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

export const UPDATE_PATTERN_GROUP = gql`
  mutation UpdatePatternGroup(
    $id: ID!
    $name: String
    $description: String
    $patternDuration: Int
    $patterns: [PatternInput!]
  ) {
    updatePatternGroup(
      id: $id
      name: $name
      description: $description
      patternDuration: $patternDuration
      patterns: $patterns
    ) {
      id
      name
      description
      patternDuration
      isActive
      createdAt
      updatedAt
      patterns {
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
  }
`;

/**
 * @deprecated Use UPDATE_PATTERN_GROUP instead
 */
export const UPDATE_TEMPLATE_PATTERN = gql`
  mutation UpdateTemplatePattern($id: ID!, $input: CreateTemplatePatternInput!) {
    updateTemplatePattern(id: $id, input: $input) {
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

export const DELETE_PATTERN_GROUP = gql`
  mutation DeletePatternGroup($id: ID!) {
    deletePatternGroup(id: $id)
  }
`;

/**
 * @deprecated Use DELETE_PATTERN_GROUP instead
 */
export const DELETE_TEMPLATE_PATTERN = gql`
  mutation DeleteTemplatePattern($id: ID!) {
    deleteTemplatePattern(id: $id)
  }
`;

export const ASSIGN_TEMPLATE_TO_OPERATOR = gql`
  mutation AssignTemplateToOperator($input: AssignTemplateToOperatorInput!) {
    assignTemplateToOperator(input: $input) {
      id
      operatorId
      patternId
      patternStartDate
      validFrom
      validUntil
      version
      isCurrent
      createdAt
      updatedAt
    }
  }
`;
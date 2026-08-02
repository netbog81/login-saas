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
  mutation UpdatePatternGroup($id: ID!, $input: UpdatePatternGroupInput!) {
    updatePatternGroup(id: $id, input: $input) {
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

export const SET_PATTERN_GROUP_ACTIVE = gql`
  mutation SetPatternGroupActive($id: ID!, $isActive: Boolean!) {
    setPatternGroupActive(id: $id, isActive: $isActive) {
      id
      isActive
      updatedAt
    }
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
      patternGroupId
      patternStartDate
      validFrom
      validUntil
      version
      isCurrent
      createdAt
      updatedAt
      operator {
        id
        name
        surname
      }
      patternGroup {
        id
        name
        description
        patternDuration
        patterns {
          id
          name
          dayInPattern
          startTime
          endTime
        }
      }
    }
  }
`;

export const UPDATE_TEMPLATE_ASSIGNMENT = gql`
  mutation UpdateTemplateAssignment(
    $id: ID!
    $validFrom: String
    $validUntil: String
    $patternStartDate: String
    $isCurrent: Boolean
  ) {
    updateTemplateAssignment(
      id: $id
      validFrom: $validFrom
      validUntil: $validUntil
      patternStartDate: $patternStartDate
      isCurrent: $isCurrent
    ) {
      id
      operatorId
      patternGroupId
      patternStartDate
      validFrom
      validUntil
      version
      isCurrent
      createdAt
      updatedAt
      operator {
        id
        name
        surname
      }
      patternGroup {
        id
        name
        description
        patternDuration
        patterns {
          id
          name
          dayInPattern
          startTime
          endTime
        }
      }
    }
  }
`;

export const DEACTIVATE_TEMPLATE_ASSIGNMENT = gql`
  mutation DeactivateTemplateAssignment($id: ID!) {
    deactivateTemplateAssignment(id: $id) {
      id
      operatorId
      patternGroupId
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

export const DELETE_TEMPLATE_ASSIGNMENT = gql`
  mutation DeleteTemplateAssignment($id: ID!) {
    deleteTemplateAssignment(id: $id)
  }
`;

export const DEACTIVATE_ALL_TEMPLATE_ASSIGNMENTS_FOR_OPERATOR = gql`
  mutation DeactivateAllTemplateAssignmentsForOperator($operatorId: ID!) {
    deactivateAllTemplateAssignmentsForOperator(operatorId: $operatorId)
  }
`;
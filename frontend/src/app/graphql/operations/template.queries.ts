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

export const GET_ALL_PATTERN_GROUPS = gql`
  query GetAllPatternGroups {
    patternGroups {
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
 * @deprecated Use GET_ALL_PATTERN_GROUPS instead
 */
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

export const GET_TEMPLATE_ASSIGNMENTS = gql`
  query GetTemplateAssignments($operatorId: ID, $onlyCurrent: Boolean) {
    templateAssignments(operatorId: $operatorId, onlyCurrent: $onlyCurrent) {
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
        isActive
        patterns {
          id
          name
          description
          dayInPattern
          startTime
          endTime
        }
      }
    }
  }
`;

export const GET_TEMPLATE_ASSIGNMENT = gql`
  query GetTemplateAssignment($id: ID!) {
    templateAssignment(id: $id) {
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
        isActive
        patterns {
          id
          name
          description
          dayInPattern
          startTime
          endTime
        }
      }
    }
  }
`;

export const GET_TEMPLATE_ASSIGNMENTS_BY_OPERATOR = gql`
  query GetTemplateAssignmentsByOperator($operatorId: ID!, $onlyCurrent: Boolean) {
    templateAssignmentsByOperator(operatorId: $operatorId, onlyCurrent: $onlyCurrent) {
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
        isActive
        patterns {
          id
          name
          description
          dayInPattern
          startTime
          endTime
        }
      }
    }
  }
`;

export const GET_CURRENT_TEMPLATE_ASSIGNMENTS = gql`
  query GetCurrentTemplateAssignments($operatorId: ID!, $date: String) {
    currentTemplateAssignments(operatorId: $operatorId, date: $date) {
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
        isActive
        patterns {
          id
          name
          description
          dayInPattern
          startTime
          endTime
        }
      }
    }
  }
`;
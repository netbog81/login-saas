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
      roomId
      chairId
      room {
        id
        name
      }
      chair {
        id
        name
      }
      roomOverrides {
        id
        dayInPattern
        startTime
        endTime
        roomId
        chairId
        room {
          id
          name
        }
        chair {
          id
          name
        }
      }
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
    $roomId: String
    $chairId: String
  ) {
    updateTemplateAssignment(
      id: $id
      validFrom: $validFrom
      validUntil: $validUntil
      patternStartDate: $patternStartDate
      isCurrent: $isCurrent
      roomId: $roomId
      chairId: $chairId
    ) {
      id
      operatorId
      patternGroupId
      patternStartDate
      validFrom
      validUntil
      version
      isCurrent
      roomId
      chairId
      room {
        id
        name
      }
      chair {
        id
        name
      }
      roomOverrides {
        id
        dayInPattern
        startTime
        endTime
        roomId
        chairId
        room {
          id
          name
        }
        chair {
          id
          name
        }
      }
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
      roomId
      chairId
      room {
        id
        name
      }
      chair {
        id
        name
      }
      roomOverrides {
        id
        dayInPattern
        startTime
        endTime
        roomId
        chairId
        room {
          id
          name
        }
        chair {
          id
          name
        }
      }
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
export const SET_ASSIGNMENT_ROOM_OVERRIDES = gql`
  mutation SetAssignmentRoomOverrides(
    $assignmentId: ID!
    $overrides: [AssignmentRoomOverrideInput!]!
  ) {
    setAssignmentRoomOverrides(assignmentId: $assignmentId, overrides: $overrides) {
      id
      roomId
      chairId
      roomOverrides {
        id
        dayInPattern
        startTime
        endTime
        roomId
        chairId
        room {
          id
          name
        }
        chair {
          id
          name
        }
      }
    }
  }
`;

export const CHECK_ASSIGNMENT_ROOM_CONFLICTS = gql`
  query CheckAssignmentRoomConflicts(
    $input: AssignTemplateToOperatorInput!
    $excludeAssignmentId: ID
  ) {
    checkAssignmentRoomConflicts(
      input: $input
      excludeAssignmentId: $excludeAssignmentId
    ) {
      blocking
      warnings
    }
  }
`;

export const ASSIGNMENT_ROOM_AVAILABILITY = gql`
  query AssignmentRoomAvailability(
    $input: AssignTemplateToOperatorInput!
    $excludeAssignmentId: ID
  ) {
    assignmentRoomAvailability(
      input: $input
      excludeAssignmentId: $excludeAssignmentId
    ) {
      rooms {
        roomId
        roomName
        capacity
        fullyFree
        sharing
        full
        unavailableReason
        busy {
          dayInPattern
          startTime
          endTime
          freeSeats
          occupantNames
          busyChairIds
        }
        chairs {
          chairId
          name
          fullyFree
          firstConflict
        }
      }
    }
  }
`;

export const UPDATE_PATTERN_GROUP_WITH_CONFLICTS = gql`
  mutation UpdatePatternGroupWithConflicts(
    $id: ID!
    $input: UpdatePatternGroupInput!
  ) {
    updatePatternGroupWithConflicts(id: $id, input: $input) {
      patternGroup {
        id
        name
        description
        patternDuration
        isActive
        patterns {
          id
          name
          dayInPattern
          startTime
          endTime
        }
      }
      hasConflicts
      conflictsCount
      removedRoomOverridesCount
    }
  }
`;

import { gql } from '@apollo/client/core';

/**
 * Fragment per i campi comuni dei GymPatternGroup
 */
export const GYM_PATTERN_GROUP_FIELDS = gql`
  fragment GymPatternGroupFields on GymPatternGroup {
    id
    gymRoomId
    name
    description
    patternDuration
    patternStartDate
    isActive
    isCurrent
    version
    validFrom
    validUntil
    createdAt
    updatedAt
    gymRoom {
      id
      name
      maxCapacity
      slotDuration
      color
      defaultStartTime
      defaultEndTime
    }
    patterns {
      id
      operatorId
      dayInPattern
      startTime
      endTime
      createdAt
      updatedAt
      operator {
        id
        name
        surname
        color
      }
    }
  }
`;

/**
 * Query: Ottiene tutti i pattern groups per una palestra
 */
export const GET_GYM_PATTERN_GROUPS = gql`
  ${GYM_PATTERN_GROUP_FIELDS}
  query GetGymPatternGroups($gymRoomId: ID) {
    gymPatternGroups(gymRoomId: $gymRoomId) {
      ...GymPatternGroupFields
    }
  }
`;

/**
 * Query: Ottiene un singolo pattern group per ID
 */
export const GET_GYM_PATTERN_GROUP = gql`
  ${GYM_PATTERN_GROUP_FIELDS}
  query GetGymPatternGroup($id: ID!) {
    gymPatternGroup(id: $id) {
      ...GymPatternGroupFields
    }
  }
`;

/**
 * Query: Ottiene il pattern group corrente (attivo) per una palestra
 */
export const GET_CURRENT_GYM_PATTERN_GROUP = gql`
  ${GYM_PATTERN_GROUP_FIELDS}
  query GetCurrentGymPatternGroup($gymRoomId: ID!) {
    currentGymPatternGroup(gymRoomId: $gymRoomId) {
      ...GymPatternGroupFields
    }
  }
`;

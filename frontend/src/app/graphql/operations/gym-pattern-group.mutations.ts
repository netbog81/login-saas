import { gql } from '@apollo/client/core';
import { GYM_PATTERN_GROUP_FIELDS } from './gym-pattern-group.queries';

/**
 * Mutation: Crea un nuovo GymPatternGroup con i suoi patterns
 */
export const CREATE_GYM_PATTERN_GROUP = gql`
  ${GYM_PATTERN_GROUP_FIELDS}
  mutation CreateGymPatternGroup($input: CreateGymPatternGroupInput!) {
    createGymPatternGroup(input: $input) {
      ...GymPatternGroupFields
    }
  }
`;

/**
 * Mutation: Aggiorna un GymPatternGroup esistente
 */
export const UPDATE_GYM_PATTERN_GROUP = gql`
  ${GYM_PATTERN_GROUP_FIELDS}
  mutation UpdateGymPatternGroup($id: ID!, $input: UpdateGymPatternGroupInput!) {
    updateGymPatternGroup(id: $id, input: $input) {
      ...GymPatternGroupFields
    }
  }
`;

/**
 * Mutation: Elimina un GymPatternGroup
 */
export const DELETE_GYM_PATTERN_GROUP = gql`
  mutation DeleteGymPatternGroup($id: ID!) {
    deleteGymPatternGroup(id: $id)
  }
`;

/**
 * Mutation: Attiva un GymPatternGroup (imposta isCurrent = true)
 */
export const ACTIVATE_GYM_PATTERN_GROUP = gql`
  ${GYM_PATTERN_GROUP_FIELDS}
  mutation ActivateGymPatternGroup($id: ID!) {
    activateGymPatternGroup(id: $id) {
      ...GymPatternGroupFields
    }
  }
`;

/**
 * Mutation: Disattiva un GymPatternGroup (imposta isActive = false)
 */
export const DEACTIVATE_GYM_PATTERN_GROUP = gql`
  ${GYM_PATTERN_GROUP_FIELDS}
  mutation DeactivateGymPatternGroup($id: ID!) {
    deactivateGymPatternGroup(id: $id) {
      ...GymPatternGroupFields
    }
  }
`;

/**
 * Mutation: Duplica un GymPatternGroup con un nuovo nome
 */
export const DUPLICATE_GYM_PATTERN_GROUP = gql`
  ${GYM_PATTERN_GROUP_FIELDS}
  mutation DuplicateGymPatternGroup($id: ID!, $newName: String!) {
    duplicateGymPatternGroup(id: $id, newName: $newName) {
      ...GymPatternGroupFields
    }
  }
`;

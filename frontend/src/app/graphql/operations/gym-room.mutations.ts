import { gql } from '@apollo/client/core';
import { GYM_ROOM_FIELDS } from './gym-room.queries';

/**
 * Mutation: Crea una nuova palestra
 */
export const CREATE_GYM_ROOM = gql`
  ${GYM_ROOM_FIELDS}
  mutation CreateGymRoom(
    $name: String!
    $maxCapacity: Int
    $slotDuration: Int
    $color: String
    $defaultStartTime: String
    $defaultEndTime: String
  ) {
    createGymRoom(
      name: $name
      maxCapacity: $maxCapacity
      slotDuration: $slotDuration
      color: $color
      defaultStartTime: $defaultStartTime
      defaultEndTime: $defaultEndTime
    ) {
      ...GymRoomFields
    }
  }
`;

/**
 * Mutation: Aggiorna una palestra
 */
export const UPDATE_GYM_ROOM = gql`
  ${GYM_ROOM_FIELDS}
  mutation UpdateGymRoom(
    $id: ID!
    $name: String
    $maxCapacity: Int
    $slotDuration: Int
    $color: String
    $isActive: Boolean
    $defaultStartTime: String
    $defaultEndTime: String
  ) {
    updateGymRoom(
      id: $id
      name: $name
      maxCapacity: $maxCapacity
      slotDuration: $slotDuration
      color: $color
      isActive: $isActive
      defaultStartTime: $defaultStartTime
      defaultEndTime: $defaultEndTime
    ) {
      ...GymRoomFields
    }
  }
`;

/**
 * Mutation: Elimina una palestra
 */
export const DELETE_GYM_ROOM = gql`
  mutation DeleteGymRoom($id: ID!) {
    deleteGymRoom(id: $id)
  }
`;

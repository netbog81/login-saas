import { gql } from '@apollo/client/core';

/**
 * Fragment per i campi comuni delle GymRoom
 */
export const GYM_ROOM_FIELDS = gql`
  fragment GymRoomFields on GymRoom {
    id
    name
    maxCapacity
    slotDuration
    color
    defaultStartTime
    defaultEndTime
    isActive
    createdAt
    updatedAt
  }
`;

/**
 * Query: Ottiene tutte le palestre
 */
export const GET_GYM_ROOMS = gql`
  ${GYM_ROOM_FIELDS}
  query GetGymRooms($onlyActive: Boolean) {
    gymRooms(onlyActive: $onlyActive) {
      ...GymRoomFields
    }
  }
`;

/**
 * Query: Ottiene una singola palestra per ID
 */
export const GET_GYM_ROOM = gql`
  ${GYM_ROOM_FIELDS}
  query GetGymRoom($id: ID!) {
    gymRoom(id: $id) {
      ...GymRoomFields
    }
  }
`;

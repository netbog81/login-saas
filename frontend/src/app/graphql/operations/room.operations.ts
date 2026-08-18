import { gql } from 'apollo-angular';

// ==================== Studi (rooms) ====================

export const GET_ROOMS = gql`
  query GetRooms($onlyActive: Boolean) {
    rooms(onlyActive: $onlyActive) {
      id
      name
      capacity
      color
      isActive
      createdAt
      updatedAt
      chairs {
        id
        roomId
        name
        color
        isActive
      }
    }
  }
`;

export const CREATE_ROOM = gql`
  mutation CreateRoom($name: String!, $capacity: Int, $color: String) {
    createRoom(name: $name, capacity: $capacity, color: $color) {
      id
      name
      capacity
      color
      isActive
    }
  }
`;

export const UPDATE_ROOM = gql`
  mutation UpdateRoom(
    $id: ID!
    $name: String
    $capacity: Int
    $color: String
    $isActive: Boolean
  ) {
    updateRoom(
      id: $id
      name: $name
      capacity: $capacity
      color: $color
      isActive: $isActive
    ) {
      id
      name
      capacity
      color
      isActive
    }
  }
`;

export const DELETE_ROOM = gql`
  mutation DeleteRoom($id: ID!) {
    deleteRoom(id: $id)
  }
`;

// ==================== Poltrone (chairs) ====================

export const GET_CHAIRS = gql`
  query GetChairs($roomId: ID, $onlyActive: Boolean) {
    chairs(roomId: $roomId, onlyActive: $onlyActive) {
      id
      roomId
      name
      color
      isActive
      room {
        id
        name
      }
    }
  }
`;

export const CREATE_CHAIR = gql`
  mutation CreateChair($roomId: ID!, $name: String!, $color: String) {
    createChair(roomId: $roomId, name: $name, color: $color) {
      id
      roomId
      name
      color
      isActive
    }
  }
`;

export const UPDATE_CHAIR = gql`
  mutation UpdateChair(
    $id: ID!
    $name: String
    $color: String
    $isActive: Boolean
    $roomId: ID
  ) {
    updateChair(
      id: $id
      name: $name
      color: $color
      isActive: $isActive
      roomId: $roomId
    ) {
      id
      roomId
      name
      color
      isActive
    }
  }
`;

export const DELETE_CHAIR = gql`
  mutation DeleteChair($id: ID!) {
    deleteChair(id: $id)
  }
`;

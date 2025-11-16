import { gql } from '@apollo/client/core';

export const GET_AVAILABLE_SLOTS = gql`
  query GetAvailableSlots(
    $date: String!
    $operatorId: ID
    $serviceId: ID
  ) {
    availableSlots(
      date: $date
      operatorId: $operatorId
      serviceId: $serviceId
    ) {
      operatorId
      date
      startTime
      endTime
      totalCapacity
      bookedCapacity
      availableCapacity
      isAvailable
      source
      sourceId
    }
  }
`;

export const CHECK_SLOT_AVAILABILITY = gql`
  query CheckSlotAvailability(
    $operatorId: ID!
    $date: String!
    $startTime: String!
    $endTime: String!
  ) {
    checkSlotAvailability(
      operatorId: $operatorId
      date: $date
      startTime: $startTime
      endTime: $endTime
    )
  }
`;
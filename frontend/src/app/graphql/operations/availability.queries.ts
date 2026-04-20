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

export const GET_PHYSIOTHERAPIST_AVAILABLE_SLOTS = gql`
  query GetPhysiotherapistAvailableSlots($input: CheckPhysiotherapistAvailabilityInput!) {
    physiotherapistAvailableSlots(input: $input) {
      startTime
      endTime
      available
      reason
      suggestedInstruments {
        instrumentCategoryId
        categoryName
        instrumentId
        startOffsetMinutes
        endOffsetMinutes
      }
    }
  }
`;

/**
 * Query batch: Slot disponibili per più fisioterapisti in più date.
 * ~5 query DB totali.
 */
export const GET_PHYSIOTHERAPIST_AVAILABLE_SLOTS_BATCH = gql`
  query GetPhysiotherapistAvailableSlotsBatch(
    $operatorIds: [ID!]!
    $dates: [String!]!
    $durationMinutes: Int!
  ) {
    physiotherapistAvailableSlotsBatch(
      operatorIds: $operatorIds
      dates: $dates
      durationMinutes: $durationMinutes
    ) {
      operatorId
      date
      startTime
      endTime
      available
    }
  }
`;
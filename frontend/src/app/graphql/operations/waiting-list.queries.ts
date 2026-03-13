import { gql } from '@apollo/client/core';

export const WAITING_LIST_ENTRY_FIELDS = gql`
  fragment WaitingListEntryFields on WaitingListEntry {
    id
    patientId
    patientName
    phone
    operatorId
    notes
    priority
    position
    status
    createdAt
    updatedAt
    operator {
      id
      name
      surname
      color
    }
  }
`;

export const GET_WAITING_LIST_ENTRIES = gql`
  query GetWaitingListEntries($status: WaitingListStatus) {
    waitingListEntries(status: $status) {
      ...WaitingListEntryFields
    }
  }
  ${WAITING_LIST_ENTRY_FIELDS}
`;

export const GET_WAITING_LIST_ENTRY = gql`
  query GetWaitingListEntry($id: ID!) {
    waitingListEntry(id: $id) {
      ...WaitingListEntryFields
    }
  }
  ${WAITING_LIST_ENTRY_FIELDS}
`;

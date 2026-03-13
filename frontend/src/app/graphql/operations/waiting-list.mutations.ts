import { gql } from '@apollo/client/core';
import { WAITING_LIST_ENTRY_FIELDS } from './waiting-list.queries';

export const CREATE_WAITING_LIST_ENTRY = gql`
  mutation CreateWaitingListEntry($input: CreateWaitingListEntryInput!) {
    createWaitingListEntry(input: $input) {
      ...WaitingListEntryFields
    }
  }
  ${WAITING_LIST_ENTRY_FIELDS}
`;

export const UPDATE_WAITING_LIST_ENTRY = gql`
  mutation UpdateWaitingListEntry($id: ID!, $input: UpdateWaitingListEntryInput!) {
    updateWaitingListEntry(id: $id, input: $input) {
      ...WaitingListEntryFields
    }
  }
  ${WAITING_LIST_ENTRY_FIELDS}
`;

export const DELETE_WAITING_LIST_ENTRY = gql`
  mutation DeleteWaitingListEntry($id: ID!) {
    deleteWaitingListEntry(id: $id)
  }
`;

export const REORDER_WAITING_LIST = gql`
  mutation ReorderWaitingList($input: ReorderWaitingListInput!) {
    reorderWaitingList(input: $input) {
      ...WaitingListEntryFields
    }
  }
  ${WAITING_LIST_ENTRY_FIELDS}
`;

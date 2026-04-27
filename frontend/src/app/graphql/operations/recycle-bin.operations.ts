import { gql } from 'apollo-angular';

// ==================== FRAGMENT ====================

export const RECYCLE_BIN_ITEM_FIELDS = gql`
  fragment RecycleBinItemFields on RecycleBinItem {
    id
    entityType
    title
    subtitle
    deletedAt
    deletedByUserId
    deletedByName
    ownerUserId
    ownerName
    scheduledPurgeAt
    childrenCount
  }
`;

// ==================== QUERIES ====================

export const RECYCLE_BIN_QUERY = gql`
  query RecycleBin($filter: RecycleBinFilterInput) {
    recycleBin(filter: $filter) {
      ...RecycleBinItemFields
    }
  }
  ${RECYCLE_BIN_ITEM_FIELDS}
`;

export const RECYCLE_BIN_SETTINGS_QUERY = gql`
  query RecycleBinSettings {
    recycleBinSettings {
      id
      retentionDays
      updatedAt
      updatedByUserId
    }
  }
`;

// ==================== MUTATIONS ====================

export const RESTORE_FROM_RECYCLE_BIN = gql`
  mutation RestoreFromRecycleBin($entityType: RecycleBinEntityType!, $id: ID!) {
    restoreFromRecycleBin(entityType: $entityType, id: $id)
  }
`;

export const PURGE_FROM_RECYCLE_BIN = gql`
  mutation PurgeFromRecycleBin($entityType: RecycleBinEntityType!, $id: ID!) {
    purgeFromRecycleBin(entityType: $entityType, id: $id)
  }
`;

export const EMPTY_RECYCLE_BIN = gql`
  mutation EmptyRecycleBin($force: Boolean) {
    emptyRecycleBin(force: $force)
  }
`;

export const UPDATE_RECYCLE_BIN_SETTINGS = gql`
  mutation UpdateRecycleBinSettings($retentionDays: Int) {
    updateRecycleBinSettings(retentionDays: $retentionDays) {
      id
      retentionDays
      updatedAt
      updatedByUserId
    }
  }
`;

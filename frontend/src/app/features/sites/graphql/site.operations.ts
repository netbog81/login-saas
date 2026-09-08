import { gql } from '@apollo/client/core';

const SITE_FIELDS = `
  id
  name
  address
  isActive
  isDefault
  createdAt
  updatedAt
`;

export const GET_SITES = gql`
  query Sites($onlyActive: Boolean) {
    sites(onlyActive: $onlyActive) {
      ${SITE_FIELDS}
    }
  }
`;

export const CREATE_SITE = gql`
  mutation CreateSite($name: String!, $address: String) {
    createSite(name: $name, address: $address) {
      ${SITE_FIELDS}
    }
  }
`;

export const UPDATE_SITE = gql`
  mutation UpdateSite($id: ID!, $name: String, $address: String, $isActive: Boolean) {
    updateSite(id: $id, name: $name, address: $address, isActive: $isActive) {
      ${SITE_FIELDS}
    }
  }
`;

/** Restituisce l'elenco completo: la designazione ne cambia sempre due. */
export const SET_DEFAULT_SITE = gql`
  mutation SetDefaultSite($id: ID!) {
    setDefaultSite(id: $id) {
      ${SITE_FIELDS}
    }
  }
`;

export const RESYNC_SITES_TO_ACCOUNTING = gql`
  mutation ResyncSitesToAccounting {
    resyncSitesToAccounting
  }
`;

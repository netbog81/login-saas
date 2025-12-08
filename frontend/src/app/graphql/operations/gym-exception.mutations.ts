import { gql } from '@apollo/client/core';
import { GYM_EXCEPTION_FIELDS } from './gym-exception.queries';

/**
 * Mutation: Crea una nuova eccezione per la palestra
 */
export const CREATE_GYM_EXCEPTION = gql`
  ${GYM_EXCEPTION_FIELDS}
  mutation CreateGymException($input: CreateGymExceptionInput!) {
    createGymException(input: $input) {
      ...GymExceptionFields
    }
  }
`;

/**
 * Mutation: Aggiorna un'eccezione esistente
 */
export const UPDATE_GYM_EXCEPTION = gql`
  ${GYM_EXCEPTION_FIELDS}
  mutation UpdateGymException($id: ID!, $input: UpdateGymExceptionInput!) {
    updateGymException(id: $id, input: $input) {
      ...GymExceptionFields
    }
  }
`;

/**
 * Mutation: Elimina un'eccezione
 */
export const DELETE_GYM_EXCEPTION = gql`
  mutation DeleteGymException($id: ID!) {
    deleteGymException(id: $id)
  }
`;

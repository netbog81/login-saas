import { gql } from '@apollo/client/core';

export const CREATE_PATIENT = gql`
  mutation CreatePatient($input: CreatePatientInput!) {
    createPatient(input: $input) {
      id
      nome
      cognome
      codiceFiscale
      telefono
      cellulare
      email
      nomeCompleto
    }
  }
`;

export const UPDATE_PATIENT = gql`
  mutation UpdatePatient($id: ID!, $input: UpdatePatientInput!) {
    updatePatient(id: $id, input: $input) {
      id
      nome
      cognome
      codiceFiscale
      telefono
      cellulare
      email
      nomeCompleto
    }
  }
`;

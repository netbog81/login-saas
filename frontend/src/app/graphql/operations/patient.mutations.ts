import { gql } from '@apollo/client/core';

export const CREATE_PATIENT = gql`
  mutation CreatePatient($createPatientInput: CreatePatientInput!) {
    createPatient(createPatientInput: $createPatientInput) {
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
  mutation UpdatePatient($id: ID!, $updatePatientInput: UpdatePatientInput!) {
    updatePatient(id: $id, updatePatientInput: $updatePatientInput) {
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

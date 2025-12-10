import { gql } from '@apollo/client/core';

export const GET_PATIENTS = gql`
  query GetPatients($limit: Int, $offset: Int) {
    patients(limit: $limit, offset: $offset) {
      id
      nome
      cognome
      codiceFiscale
      telefono
      cellulare
      email
      dataNascita
      genere
      indirizzo
      citta
      cap
      notes
      nomeCompleto
      hasContattoTelefonico
    }
  }
`;

export const GET_PATIENT = gql`
  query GetPatient($id: ID!) {
    patient(id: $id) {
      id
      nome
      cognome
      codiceFiscale
      telefono
      cellulare
      email
      dataNascita
      genere
      indirizzo
      citta
      cap
      notes
      nomeCompleto
      hasContattoTelefonico
    }
  }
`;

export const SEARCH_PATIENTS = gql`
  query SearchPatients($searchInput: SearchPatientInput!) {
    searchPatients(searchInput: $searchInput) {
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

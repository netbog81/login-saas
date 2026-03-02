/**
 * GraphQL Queries per PatientAnamnesis (Anamnesi Paziente)
 *
 * NUOVA entità: Anamnesi semplice legata direttamente al paziente (1:1)
 * NON confondere con PatientEvaluation (ex Anamnesis) che è legata al TherapeuticPath
 */
import { gql } from 'apollo-angular';

// ==================== FRAGMENTS ====================

export const SIMPLE_PATIENT_ANAMNESIS_FRAGMENT = gql`
  fragment SimplePatientAnamnesisFields on PatientAnamnesis {
    id
    patientId
    operatorId

    # Anamnesi Patologica Remota
    patologiePregresse
    interventiChirurgici
    traumi
    terapiaFarmacologica

    # Campi aggiuntivi
    allergie
    storiaFamiliare

    # Note
    note

    # Audit
    createdAt
    updatedAt

    # Operator relation
    operator {
      id
      name
      surname
    }
  }
`;

// ==================== QUERIES ====================

/**
 * Ottiene l'anamnesi di un paziente per ID anamnesi
 */
export const GET_SIMPLE_PATIENT_ANAMNESIS = gql`
  query GetPatientAnamnesis($id: ID!) {
    patientAnamnesis(id: $id) {
      ...SimplePatientAnamnesisFields
    }
  }
  ${SIMPLE_PATIENT_ANAMNESIS_FRAGMENT}
`;

/**
 * Ottiene l'anamnesi di un paziente dato il patientId
 */
export const GET_PATIENT_ANAMNESIS_BY_PATIENT = gql`
  query GetPatientAnamnesisByPatient($patientId: ID!) {
    patientAnamnesisByPatient(patientId: $patientId) {
      ...SimplePatientAnamnesisFields
    }
  }
  ${SIMPLE_PATIENT_ANAMNESIS_FRAGMENT}
`;

/**
 * Verifica se un paziente ha un'anamnesi
 */
export const HAS_PATIENT_ANAMNESIS = gql`
  query HasPatientAnamnesis($patientId: ID!) {
    hasPatientAnamnesis(patientId: $patientId)
  }
`;

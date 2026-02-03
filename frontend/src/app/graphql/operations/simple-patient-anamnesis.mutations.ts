/**
 * GraphQL Mutations per PatientAnamnesis (Anamnesi Paziente)
 *
 * NUOVA entità: Anamnesi semplice legata direttamente al paziente (1:1)
 * NON confondere con PatientEvaluation (ex Anamnesis) che è legata al TherapeuticPath
 */
import { gql } from 'apollo-angular';
import { SIMPLE_PATIENT_ANAMNESIS_FRAGMENT } from './simple-patient-anamnesis.queries';

// ==================== MUTATIONS ====================

/**
 * Crea una nuova anamnesi per un paziente
 */
export const CREATE_PATIENT_ANAMNESIS = gql`
  mutation CreatePatientAnamnesis($input: CreatePatientAnamnesisInput!) {
    createPatientAnamnesis(input: $input) {
      ...SimplePatientAnamnesisFields
    }
  }
  ${SIMPLE_PATIENT_ANAMNESIS_FRAGMENT}
`;

/**
 * Aggiorna un'anamnesi esistente
 */
export const UPDATE_PATIENT_ANAMNESIS = gql`
  mutation UpdatePatientAnamnesis($id: ID!, $input: UpdatePatientAnamnesisInput!) {
    updatePatientAnamnesis(id: $id, input: $input) {
      ...SimplePatientAnamnesisFields
    }
  }
  ${SIMPLE_PATIENT_ANAMNESIS_FRAGMENT}
`;

/**
 * Upsert: crea o aggiorna l'anamnesi per un paziente
 * Utile quando non si sa se esiste già o meno
 */
export const UPSERT_PATIENT_ANAMNESIS = gql`
  mutation UpsertPatientAnamnesis($patientId: Int!, $input: UpdatePatientAnamnesisInput!) {
    upsertPatientAnamnesis(patientId: $patientId, input: $input) {
      ...SimplePatientAnamnesisFields
    }
  }
  ${SIMPLE_PATIENT_ANAMNESIS_FRAGMENT}
`;

/**
 * Elimina un'anamnesi paziente
 */
export const DELETE_PATIENT_ANAMNESIS = gql`
  mutation DeletePatientAnamnesis($id: ID!) {
    deletePatientAnamnesis(id: $id)
  }
`;

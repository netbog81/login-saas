import { gql } from '@apollo/client/core';

import { PATIENT_FIELDS } from './patient.queries';

export const CREATE_PATIENT = gql`
  mutation CreatePatient($input: CreatePatientInput!) {
    createPatient(input: $input) {
      ...PatientFields
    }
  }
  ${PATIENT_FIELDS}
`;

export const UPDATE_PATIENT_REGISTRY = gql`
  mutation UpdatePatientRegistry($id: ID!, $input: UpdateRegistryIndividualInput!) {
    updatePatientRegistry(id: $id, input: $input) {
      ...PatientFields
    }
  }
  ${PATIENT_FIELDS}
`;

export const UPDATE_PATIENT_ANAMNESIS = gql`
  mutation UpdatePatientAnamnesis($subjectId: ID!, $input: UpdatePatientAnamnesisInput!) {
    updatePatientAnamnesis(subjectId: $subjectId, input: $input) {
      id
      subjectId
      gruppoSanguigno
      medicoBase
      patologieCroniche
      allergie
      terapiaFarmacologica
      patologiePregresse
      interventiChirurgici
      traumi
      storiaFamiliare
      note
      updatedAt
    }
  }
`;

export const SET_PATIENT_PRIVACY_CONSENT = gql`
  mutation SetPatientPrivacyConsent($id: ID!, $given: Boolean!, $documentRef: String) {
    setPatientPrivacyConsent(id: $id, given: $given, documentRef: $documentRef) {
      ...PatientFields
    }
  }
  ${PATIENT_FIELDS}
`;

export const DEACTIVATE_PATIENT = gql`
  mutation DeactivatePatient($id: ID!) {
    deactivatePatient(id: $id)
  }
`;

export const RECORD_PATIENT_ATTENDANCE = gql`
  mutation RecordPatientAttendance(
    $subjectId: ID!
    $eventType: String!
    $reason: String
    $appointmentId: ID
  ) {
    recordPatientAttendance(
      subjectId: $subjectId
      eventType: $eventType
      reason: $reason
      appointmentId: $appointmentId
    )
  }
`;

// Alias retro-compat: il vecchio updatePatient è splittato in due mutation.
// I componenti che lo usano vanno migrati a UPDATE_PATIENT_REGISTRY (PII) o
// UPDATE_PATIENT_ANAMNESIS (dati clinici).
export const UPDATE_PATIENT = UPDATE_PATIENT_REGISTRY;

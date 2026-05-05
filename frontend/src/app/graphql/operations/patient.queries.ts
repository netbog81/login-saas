import { gql } from '@apollo/client/core';

/**
 * Fragment col subset di campi del subject del registry usati dalla UI clinica.
 * Tutti i campi PII vivono ora dentro `subject` (vedi backend `Patient` GraphQL).
 */
export const REGISTRY_SUBJECT_FIELDS = gql`
  fragment RegistrySubjectFields on RegistrySubject {
    id
    subjectType
    isActive
    firstName
    lastName
    taxCode
    birthDate
    birthPlace
    birthCountry
    gender
    legalCapacity
    vatNumber
    notes
    addresses {
      id
      addressType
      street
      city
      zipCode
      province
      countryCode
      isPrimary
    }
    contacts {
      id
      contactType
      value
      label
      isPrimary
      verified
    }
    privacyGeneralConsent {
      given
      givenAt
      revokedAt
      documentRef
    }
    displayName
    primaryEmail
    primaryPhone
  }
`;

export const PATIENT_ANAMNESIS_FIELDS = gql`
  fragment PatientAnamnesisFields on PatientAnamnesis {
    id
    subjectId
    operatorId
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
    createdAt
    updatedAt
  }
`;

export const ATTENDANCE_FIELDS = gql`
  fragment AttendanceFields on AttendanceStats {
    noShowsByYear
    cancellationsByYear
    totalNoShows
    totalCancellations
  }
`;

export const PATIENT_FIELDS = gql`
  fragment PatientFields on Patient {
    id
    displayName
    isActive
    lastSyncedAt
    subject {
      ...RegistrySubjectFields
    }
    anamnesis {
      ...PatientAnamnesisFields
    }
    attendance {
      ...AttendanceFields
    }
  }
  ${REGISTRY_SUBJECT_FIELDS}
  ${PATIENT_ANAMNESIS_FIELDS}
  ${ATTENDANCE_FIELDS}
`;

// ==================== QUERIES ====================

export const GET_PATIENT = gql`
  query GetPatient($id: ID!) {
    patient(id: $id) {
      ...PatientFields
    }
  }
  ${PATIENT_FIELDS}
`;

/**
 * Ricerca paginata dei pazienti via global-search del registry.
 * NOTA: la query precedente `patients(limit, offset)` è stata sostituita da
 * `searchPatients(input)` che mappa direttamente a `POST /subjects/global-search`.
 * Per compatibilità, GET_PATIENTS chiama searchPatients con un filtro vuoto.
 */
export const SEARCH_PATIENTS = gql`
  query SearchPatients($input: SearchPatientInput!) {
    searchPatients(input: $input) {
      data {
        ...PatientFields
      }
      total
      page
      pageSize
      totalPages
    }
  }
  ${PATIENT_FIELDS}
`;

// Alias retro-compat per chi usa GET_PATIENTS (ora delega a searchPatients).
export const GET_PATIENTS = SEARCH_PATIENTS;

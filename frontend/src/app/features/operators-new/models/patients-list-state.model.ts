/**
 * Patients List State Models
 * Layer 5: TypeScript Interfaces per la lista pazienti
 */

import { Patient } from '../../../models/patient.model';

export interface PatientsListUIState {
  loading: boolean;
  searching: boolean;
  error: string | null;
  searchTerm: string;
  selectedPatientId: string | null;
}

export interface PatientsListData {
  patients: Patient[];
  filteredPatients: Patient[];
  totalCount: number;
}

export interface PatientSearchEvent {
  searchTerm: string;
}

export interface PatientSelectEvent {
  patient: Patient;
}

/**
 * Factory function per creare lo stato iniziale
 */
export function createInitialPatientsListState(): PatientsListUIState {
  return {
    loading: false,
    searching: false,
    error: null,
    searchTerm: '',
    selectedPatientId: null
  };
}

/**
 * Factory function per creare dati vuoti
 */
export function createEmptyPatientsListData(): PatientsListData {
  return {
    patients: [],
    filteredPatients: [],
    totalCount: 0
  };
}

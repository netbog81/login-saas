/**
 * Modelli per lo stato della Scheda Paziente (Patient Folder)
 * Layer: Models
 */

import { Patient } from '../../../models/patient.model';
import { TherapeuticPath, PathTreatment, Anamnesis, PathDocument } from '../../../models/therapeutic-path.model';

/**
 * Tab disponibili nella scheda paziente
 */
export type PatientFolderTab = 'treatments' | 'anamnesis' | 'documents';

/**
 * Stato UI della Scheda Paziente
 */
export interface PatientFolderUIState {
  // Sidebar percorsi
  sidebarCollapsed: boolean;

  // Selezione
  selectedPathId: string | null;
  activeTab: PatientFolderTab;

  // Trattamento selezionato (per dettaglio)
  selectedTreatmentId: string | null;
  showTreatmentDetail: boolean;

  // Loading states
  loadingPatient: boolean;
  loadingPaths: boolean;
  loadingTreatments: boolean;
  loadingAnamnesis: boolean;
  loadingDocuments: boolean;

  // Errori
  error: string | null;
}

/**
 * Dati aggregati per la cartella paziente
 */
export interface PatientFolderData {
  patient: Patient | null;
  paths: TherapeuticPath[];
  selectedPath: TherapeuticPath | null;
}

/**
 * Evento selezione percorso
 */
export interface PathSelectEvent {
  path: TherapeuticPath;
  previousPathId: string | null;
}

/**
 * Evento doppio click su trattamento
 */
export interface TreatmentDetailEvent {
  treatment: PathTreatment;
  pathId: string;
}

/**
 * Evento cambio tab
 */
export interface TabChangeEvent {
  tab: PatientFolderTab;
  previousTab: PatientFolderTab;
}

/**
 * Configurazione responsive
 */
export interface ResponsiveConfig {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  sidebarWidth: number;
}

/**
 * Factory per stato iniziale UI
 */
export function createInitialPatientFolderUIState(): PatientFolderUIState {
  return {
    sidebarCollapsed: false,
    selectedPathId: null,
    activeTab: 'treatments',
    selectedTreatmentId: null,
    showTreatmentDetail: false,
    loadingPatient: false,
    loadingPaths: false,
    loadingTreatments: false,
    loadingAnamnesis: false,
    loadingDocuments: false,
    error: null
  };
}

/**
 * Factory per dati iniziali
 */
export function createInitialPatientFolderData(): PatientFolderData {
  return {
    patient: null,
    paths: [],
    selectedPath: null
  };
}

/**
 * Factory per configurazione responsive iniziale
 */
export function createInitialResponsiveConfig(): ResponsiveConfig {
  return {
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    sidebarWidth: 280
  };
}

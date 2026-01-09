/**
 * Modelli per lo stato del Workspace Operatore
 * Layer: Models
 */

import { Operator, AvailabilityAppointment } from '../../../graphql/generated/types';
import { Patient } from '../../../models/patient.model';

/**
 * Stato UI globale del Workspace Operatore
 */
export interface WorkspaceUIState {
  // Selezione
  selectedOperatorId: string | null;
  selectedDate: Date;
  selectedAppointmentId: string | null;

  // Sidebar
  sidebarCollapsed: boolean;

  // Loading states
  loadingOperators: boolean;
  loadingAppointments: boolean;
  loadingPatient: boolean;

  // Errori
  error: string | null;
}

/**
 * Dati aggregati del workspace
 */
export interface WorkspaceData {
  operators: Operator[];
  selectedOperator: Operator | null;
  appointments: AvailabilityAppointment[];
  selectedAppointment: AvailabilityAppointment | null;
  selectedPatient: Patient | null;
}

/**
 * Evento cambio operatore
 */
export interface OperatorChangeEvent {
  operator: Operator;
  previousOperatorId: string | null;
}

/**
 * Evento cambio data
 */
export interface DateChangeEvent {
  date: Date;
  previousDate: Date;
}

/**
 * Evento selezione appuntamento
 */
export interface AppointmentSelectEvent {
  appointment: AvailabilityAppointment;
  previousAppointmentId: string | null;
}

/**
 * Factory per stato iniziale
 */
export function createInitialWorkspaceUIState(): WorkspaceUIState {
  return {
    selectedOperatorId: null,
    selectedDate: new Date(),
    selectedAppointmentId: null,
    sidebarCollapsed: false,
    loadingOperators: false,
    loadingAppointments: false,
    loadingPatient: false,
    error: null
  };
}

/**
 * Factory per dati iniziali
 */
export function createInitialWorkspaceData(): WorkspaceData {
  return {
    operators: [],
    selectedOperator: null,
    appointments: [],
    selectedAppointment: null,
    selectedPatient: null
  };
}

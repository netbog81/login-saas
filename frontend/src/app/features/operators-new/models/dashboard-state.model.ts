/**
 * Dashboard State Models
 * Layer 5: TypeScript Interfaces per la Dashboard
 */

export interface DashboardStats {
  appointmentsToday: number;
  appointmentsWeek: number;
  patientsTotal: number;
  treatmentsPending: number;
}

export interface DashboardUIState {
  loadingStats: boolean;
  error: string | null;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  route?: string;
  action?: string;
}

/**
 * Factory function per creare lo stato iniziale
 */
export function createInitialDashboardState(): DashboardUIState {
  return {
    loadingStats: false,
    error: null
  };
}

/**
 * Factory function per creare statistiche vuote
 */
export function createEmptyStats(): DashboardStats {
  return {
    appointmentsToday: 0,
    appointmentsWeek: 0,
    patientsTotal: 0,
    treatmentsPending: 0
  };
}

/**
 * Azioni rapide predefinite
 */
export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'new-appointment',
    label: 'Nuovo Appuntamento',
    icon: 'add_circle',
    route: '/calendar'
  },
  {
    id: 'search-patient',
    label: 'Cerca Paziente',
    icon: 'person_search',
    route: '/operatori-new/pazienti'
  },
  {
    id: 'view-appointments',
    label: 'Appuntamenti Oggi',
    icon: 'today',
    route: '/operatori-new/appuntamenti'
  }
];

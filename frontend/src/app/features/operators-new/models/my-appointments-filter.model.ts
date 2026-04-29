import { MyAppointmentStatus } from './my-appointments.model';

/**
 * Filtri per la vista "I miei appuntamenti" della dashboard operatore.
 *
 * Tutti opzionali: il container applica un default ampio per la query
 * backend (range storico esteso) quando non viene fornito un periodo.
 */
export interface MyAppointmentsFilters {
  /** Filtro range data (incluso). Default: 1900-01-01. */
  dateFrom?: string;
  /** Filtro range data (incluso). Default: 2100-12-31. */
  dateTo?: string;
  /** Subset di booking status da includere. */
  statuses?: MyAppointmentStatus[];
  /** Filtro per paziente specifico (autocomplete). */
  patientId?: string;
}

/**
 * Modalità di visualizzazione (analogo a /trattamenti):
 *  - flat: tabella piatta ordinata per data
 *  - byPatient: raggruppato per paziente
 */
export type MyAppointmentsViewMode = 'flat' | 'byPatient';

/**
 * Default safe per range data: copre tutto lo storico realistico
 * fino al 2100. Usato quando l'utente non specifica un range.
 */
export const MY_APPOINTMENTS_DEFAULT_RANGE = {
  dateFrom: '1900-01-01',
  dateTo: '2100-12-31',
} as const;

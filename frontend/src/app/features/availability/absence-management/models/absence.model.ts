/**
 * Modelli domain-level della gestione assenze operatori/medici.
 * NON re-esportare i generated types (riduce coupling al codegen).
 */

export interface AbsenceOperatorRef {
  id: string;
  name: string;
  surname?: string;
  macroCategory?: string;
}

export interface OperatorAbsence {
  id: string;
  operatorId: string;
  operator?: AbsenceOperatorRef;
  /** YYYY-MM-DD (il backend può restituire ISO datetime: normalizzare) */
  exceptionDate: string;
  exceptionType: string;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
  absenceTypeId?: string | null;
  absenceTypeSnapshot?: { id: string; name: string; description?: string } | null;
  sourceGroupId?: string | null;
  createdAt: string;
}

export interface ImpactedAppointment {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  clientName: string;
  patientId?: string | null;
  bookingStatus: string;
  operatorId?: string | null;
  operator?: AbsenceOperatorRef | null;
  service?: { id: string; name: string } | null;
}

export interface AbsenceImpactPreview {
  conflicts: ImpactedAppointment[];
  attendedWithoutTreatment: ImpactedAppointment[];
  /** Disponibilità straordinarie che l'assenza rimuoverebbe (ha la precedenza). */
  removedAvailabilityCount: number;
}

export interface CreateOperatorAbsencesInput {
  operatorIds: string[];
  dateFrom: string;
  dateTo: string;
  startTime?: string;
  endTime?: string;
  absenceTypeId?: string;
  reason?: string;
  /** 0=Lun … 6=Dom. Vuoto/assente = tutti i giorni del range. */
  weekdays?: number[];
}

export interface OperatorAbsencesResult {
  exceptions: OperatorAbsence[];
  conflictCount: number;
  skippedOverlaps: number;
  removedAvailabilityCount: number;
  sourceGroupId: string;
}

// ==================== DISPONIBILITÀ STRAORDINARIE ====================

/**
 * Le disponibilità straordinarie vivono nella stessa entità delle assenze
 * (AvailabilityException con exceptionType 'EXTRA'): stessa lista, stessi
 * gruppi, stessa cancellazione. Cambia il segno — aggiungono ore invece di
 * toglierle — e di conseguenza l'effetto sui conflitti.
 */
export const EXTRA_AVAILABILITY_TYPE = 'EXTRA';

export interface CreateOperatorAvailabilityInput {
  operatorIds: string[];
  dateFrom: string;
  dateTo: string;
  startTime: string;
  endTime: string;
  reason?: string;
  /** 0=Lun … 6=Dom. Vuoto/assente = tutti i giorni del range. */
  weekdays?: number[];
}

export interface AvailabilityBlocker {
  operatorId: string;
  operatorName: string;
  date: string;
  reason: string;
}

export interface AvailabilityAlreadyCovered {
  operatorId: string;
  operatorName: string;
  date: string;
  /** Fasce già coperte dal template, es. "14:00–16:00". */
  windows: string[];
}

export interface AvailabilityImpactPreview {
  creatableCount: number;
  blockers: AvailabilityBlocker[];
  alreadyCovered: AvailabilityAlreadyCovered[];
}

export interface ExtraAvailabilityResult {
  exceptions: OperatorAbsence[];
  createdCount: number;
  blockers: AvailabilityBlocker[];
  alreadyCovered: AvailabilityAlreadyCovered[];
  sourceGroupId: string;
}

export interface AvailabilityRemovalResult {
  deleted: number;
  conflictCount: number;
}

// ==================== CAMBIO ORARIO ====================

/**
 * Il cambio orario è un `AvailabilityException` di tipo 'MODIFIED': per quel
 * giorno il nuovo orario SOSTITUISCE quello da template. Più righe con lo
 * stesso `sourceGroupId` e la stessa data = turno spezzato (es. 07–15 e
 * 16–20): valgono tutte insieme.
 */
export const SCHEDULE_CHANGE_TYPE = 'MODIFIED';

export interface ScheduleWindow {
  startTime: string;
  endTime: string;
}

export interface CreateScheduleChangeInput {
  operatorIds: string[];
  dateFrom: string;
  dateTo: string;
  windows: ScheduleWindow[];
  reason?: string;
  /** 0=Lun … 6=Dom. Vuoto/assente = tutti i giorni del range. */
  weekdays?: number[];
}

export interface ScheduleChangePreviewDay {
  operatorId: string;
  operatorName: string;
  date: string;
  /** Orario abituale da template; vuoto = quel giorno non lavorerebbe. */
  currentWindows: string[];
  lostWindows: string[];
  gainedWindows: string[];
}

export interface ScheduleChangeImpactPreview {
  creatableCount: number;
  blockers: AvailabilityBlocker[];
  days: ScheduleChangePreviewDay[];
  conflicts: ImpactedAppointment[];
}

export interface ScheduleChangeResult {
  exceptions: OperatorAbsence[];
  createdCount: number;
  conflictCount: number;
  blockers: AvailabilityBlocker[];
  sourceGroupId: string;
}

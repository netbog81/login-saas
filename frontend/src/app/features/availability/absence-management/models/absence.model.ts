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
}

export interface CreateOperatorAbsencesInput {
  operatorIds: string[];
  dateFrom: string;
  dateTo: string;
  startTime?: string;
  endTime?: string;
  absenceTypeId?: string;
  reason?: string;
}

export interface OperatorAbsencesResult {
  exceptions: OperatorAbsence[];
  conflictCount: number;
  skippedOverlaps: number;
  sourceGroupId: string;
}

import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  Treatment,
  CompleteTreatmentInput,
  CloseTreatmentInput,
  RecordPaymentInput,
  TreatmentInstrumentInput,
  CancelAppointmentInput,
} from '../models/treatment.model';
import { Appointment } from '../models/appointment.model';
import { BaseGraphQLService } from '../core/services/base-graphql.service';

// Queries
import {
  GET_TREATMENT,
  GET_TREATMENT_BY_APPOINTMENT,
  GET_TREATMENTS_BY_OPERATOR,
  GET_TREATMENTS_PENDING_CLOSURE,
  GET_TREATMENTS_BY_PATIENT,
  GET_TREATMENTS_NOT_INVOICED_TO_PATIENT,
  GET_TREATMENTS_NOT_INVOICED_BY_OPERATOR,
} from '../graphql/operations/treatment.queries';

// Mutations
import {
  CREATE_TREATMENT,
  COMPLETE_TREATMENT,
  CLOSE_TREATMENT,
  REOPEN_TREATMENT,
  RECORD_TREATMENT_PAYMENT,
  MARK_TREATMENT_INVOICED_TO_PATIENT,
  MARK_TREATMENT_INVOICED_BY_OPERATOR,
  UPDATE_TREATMENT_INSTRUMENTS,
  UPDATE_TREATMENT,
  DELETE_TREATMENT,
} from '../graphql/operations/treatment.mutations';

// Appointment mutations (for status changes)
import {
  CANCEL_APPOINTMENT_WITH_NOTICE,
  MARK_APPOINTMENT_ATTENDED,
} from '../graphql/operations/availability-appointment.mutations';

import {
  MARK_APPOINTMENT_AS_NO_SHOW,
} from '../graphql/operations/availability-appointment.mutations';

@Injectable({
  providedIn: 'root',
})
export class TreatmentService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  // ==================== QUERIES ====================

  /**
   * Get a treatment by ID
   */
  getTreatment(id: string): Observable<Treatment | null> {
    return this.query<{ treatment: Treatment | null }>(GET_TREATMENT, { id })
      .pipe(map((result) => result.treatment));
  }

  /**
   * Get treatment by appointment ID
   */
  getTreatmentByAppointment(appointmentId: string): Observable<Treatment | null> {
    return this.query<{ treatmentByAppointment: Treatment | null }>(
      GET_TREATMENT_BY_APPOINTMENT,
      { appointmentId }
    ).pipe(map((result) => result.treatmentByAppointment));
  }

  /**
   * Get active treatments by operator
   */
  getTreatmentsByOperator(operatorId: string, date?: string): Observable<Treatment[]> {
    return this.query<{ treatmentsByOperator: Treatment[] }>(
      GET_TREATMENTS_BY_OPERATOR,
      { operatorId, date }
    ).pipe(map((result) => result.treatmentsByOperator));
  }

  /**
   * Get treatments pending closure by secretary
   */
  getTreatmentsPendingClosure(): Observable<Treatment[]> {
    return this.query<{ treatmentsPendingClosure: Treatment[] }>(GET_TREATMENTS_PENDING_CLOSURE)
      .pipe(map((result) => result.treatmentsPendingClosure));
  }

  /**
   * Get treatments by patient
   */
  getTreatmentsByPatient(
    patientId: string,
    limit?: number,
    offset?: number
  ): Observable<Treatment[]> {
    console.log('[TreatmentService] getTreatmentsByPatient called for patientId:', patientId);
    return this.query<{ treatmentsByPatient: Treatment[] }>(
      GET_TREATMENTS_BY_PATIENT,
      { patientId, limit, offset }
    ).pipe(
      tap(result => console.log('[TreatmentService] raw result:', result)),
      map((result) => result?.treatmentsByPatient || [])
    );
  }

  /**
   * Get treatments not invoiced to patient
   */
  getTreatmentsNotInvoicedToPatient(
    dateFrom?: string,
    dateTo?: string
  ): Observable<Treatment[]> {
    return this.query<{ treatmentsNotInvoicedToPatient: Treatment[] }>(
      GET_TREATMENTS_NOT_INVOICED_TO_PATIENT,
      { dateFrom, dateTo }
    ).pipe(map((result) => result.treatmentsNotInvoicedToPatient));
  }

  /**
   * Get treatments not invoiced by operator
   */
  getTreatmentsNotInvoicedByOperator(
    operatorId?: string,
    dateFrom?: string,
    dateTo?: string
  ): Observable<Treatment[]> {
    return this.query<{ treatmentsNotInvoicedByOperator: Treatment[] }>(
      GET_TREATMENTS_NOT_INVOICED_BY_OPERATOR,
      { operatorId, dateFrom, dateTo }
    ).pipe(map((result) => result.treatmentsNotInvoicedByOperator));
  }

  // ==================== TREATMENT MUTATIONS ====================

  /**
   * Create treatment from appointment (when patient arrives)
   */
  createTreatment(
    appointmentId: string,
    therapeuticPathId: string,
    scontoFE: boolean = false
  ): Observable<Treatment> {
    return this.mutate<{ createTreatment: Treatment }>(CREATE_TREATMENT, {
      appointmentId,
      therapeuticPathId,
      scontoFE
    }).pipe(map((result) => result.createTreatment));
  }

  /**
   * Operator completes treatment
   */
  completeTreatment(id: string, input: CompleteTreatmentInput): Observable<Treatment> {
    return this.mutate<{ completeTreatment: Treatment }>(COMPLETE_TREATMENT, { id, input })
      .pipe(map((result) => result.completeTreatment));
  }

  /**
   * Secretary closes treatment
   */
  closeTreatment(id: string, input: CloseTreatmentInput): Observable<Treatment> {
    return this.mutate<{ closeTreatment: Treatment }>(CLOSE_TREATMENT, { id, input })
      .pipe(map((result) => result.closeTreatment));
  }

  /**
   * Reopen a completed treatment (back to in_progress)
   */
  reopenTreatment(id: string): Observable<Treatment> {
    return this.mutate<{ reopenTreatment: Treatment }>(REOPEN_TREATMENT, { id })
      .pipe(map((result) => result.reopenTreatment));
  }

  /**
   * Record payment for treatment
   */
  recordPayment(id: string, input: RecordPaymentInput): Observable<Treatment> {
    return this.mutate<{ recordTreatmentPayment: Treatment }>(RECORD_TREATMENT_PAYMENT, { id, input })
      .pipe(map((result) => result.recordTreatmentPayment));
  }

  /**
   * Mark treatment as invoiced to patient
   */
  markInvoicedToPatient(id: string, invoiceNumber?: string): Observable<Treatment> {
    return this.mutate<{ markTreatmentInvoicedToPatient: Treatment }>(
      MARK_TREATMENT_INVOICED_TO_PATIENT,
      { id, invoiceNumber }
    ).pipe(map((result) => result.markTreatmentInvoicedToPatient));
  }

  /**
   * Mark treatment as invoiced by operator to studio
   */
  markInvoicedByOperator(id: string, invoiceNumber?: string): Observable<Treatment> {
    return this.mutate<{ markTreatmentInvoicedByOperator: Treatment }>(
      MARK_TREATMENT_INVOICED_BY_OPERATOR,
      { id, invoiceNumber }
    ).pipe(map((result) => result.markTreatmentInvoicedByOperator));
  }

  /**
   * Update treatment instruments
   */
  updateInstruments(id: string, instruments: TreatmentInstrumentInput[]): Observable<Treatment> {
    return this.mutate<{ updateTreatmentInstruments: Treatment }>(
      UPDATE_TREATMENT_INSTRUMENTS,
      { id, instruments }
    ).pipe(map((result) => result.updateTreatmentInstruments));
  }

  /**
   * Update an in-progress treatment
   */
  updateTreatment(input: {
    id: string;
    therapeuticPathId?: string;
    serviceId?: string;  // @deprecated - usa treatmentServices
    clinicalNotes?: string;
    secretaryNotes?: string;
    patientNotes?: string;
    price?: number;
    scontoFE?: boolean;
    painLevel?: number;
    painBefore?: number;
    painAfter?: number;
    rescheduleRequested?: boolean;
    reschedulingType?: string;
    suggestInDays?: number;
    suggestDateRangeStart?: string;
    suggestDateRangeEnd?: string;
    reschedulingNotes?: string;
    isPaid?: boolean; // Se false, resetta lo stato di pagamento
    // Nuovo: servizi multipli del trattamento
    treatmentServices?: {
      serviceId: string;
      price?: number;
      duration?: number;
      orderPosition?: number;
    }[];
    instruments?: {
      instrumentId: string;
      instrumentCategoryId?: string;
      quantity?: number;
      wasUsed?: boolean;
      startOffsetMinutes?: number;
      endOffsetMinutes?: number;
      notes?: string;
    }[];
  }): Observable<Treatment> {
    return this.mutate<{ updateTreatment: Treatment }>(UPDATE_TREATMENT, { input })
      .pipe(map((result) => result.updateTreatment));
  }

  /**
   * Delete a treatment (for cancelling in-progress treatments)
   */
  deleteTreatment(id: string): Observable<boolean> {
    return this.mutate<{ deleteTreatment: boolean }>(DELETE_TREATMENT, { id })
      .pipe(map((result) => result.deleteTreatment));
  }

  // ==================== APPOINTMENT STATUS MUTATIONS ====================

  /**
   * Cancel appointment with notice tracking
   */
  cancelAppointment(id: string, input: CancelAppointmentInput): Observable<Appointment> {
    return this.mutate<{ cancelAppointmentWithNotice: Appointment }>(
      CANCEL_APPOINTMENT_WITH_NOTICE,
      { id, input }
    ).pipe(map((result) => result.cancelAppointmentWithNotice));
  }

  /**
   * Mark appointment as no-show
   */
  markAppointmentNoShow(id: string): Observable<Appointment> {
    return this.mutate<{ markAppointmentAsNoShow: Appointment }>(MARK_APPOINTMENT_AS_NO_SHOW, { id })
      .pipe(map((result) => result.markAppointmentAsNoShow));
  }

  /**
   * Mark appointment as attended (patient arrived)
   */
  markAppointmentAttended(id: string): Observable<Appointment> {
    return this.mutate<{ markAppointmentAttended: Appointment }>(MARK_APPOINTMENT_ATTENDED, { id })
      .pipe(map((result) => result.markAppointmentAttended));
  }
}

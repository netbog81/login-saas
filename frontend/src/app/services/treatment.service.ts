import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import {
  Treatment,
  CompleteTreatmentInput,
  CloseTreatmentInput,
  RecordPaymentInput,
  TreatmentInstrumentInput,
  CancelAppointmentInput,
} from '../models/treatment.model';
import { Appointment } from '../models/appointment.model';

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
  RECORD_TREATMENT_PAYMENT,
  MARK_TREATMENT_INVOICED_TO_PATIENT,
  MARK_TREATMENT_INVOICED_BY_OPERATOR,
  UPDATE_TREATMENT_INSTRUMENTS,
  CANCEL_APPOINTMENT_WITH_NOTICE,
  MARK_APPOINTMENT_NO_SHOW,
  MARK_APPOINTMENT_ATTENDED,
} from '../graphql/operations/treatment.mutations';

@Injectable({
  providedIn: 'root',
})
export class TreatmentService {
  constructor(private apollo: Apollo) {}

  // ==================== QUERIES ====================

  /**
   * Get a treatment by ID
   */
  getTreatment(id: string): Observable<Treatment | null> {
    return this.apollo
      .query<{ treatment: Treatment | null }>({
        query: GET_TREATMENT,
        variables: { id },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data.treatment));
  }

  /**
   * Get treatment by appointment ID
   */
  getTreatmentByAppointment(appointmentId: string): Observable<Treatment | null> {
    return this.apollo
      .query<{ treatmentByAppointment: Treatment | null }>({
        query: GET_TREATMENT_BY_APPOINTMENT,
        variables: { appointmentId },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data.treatmentByAppointment));
  }

  /**
   * Get active treatments by operator
   */
  getTreatmentsByOperator(operatorId: string, date?: string): Observable<Treatment[]> {
    return this.apollo
      .query<{ treatmentsByOperator: Treatment[] }>({
        query: GET_TREATMENTS_BY_OPERATOR,
        variables: { operatorId, date },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data.treatmentsByOperator));
  }

  /**
   * Get treatments pending closure by secretary
   */
  getTreatmentsPendingClosure(): Observable<Treatment[]> {
    return this.apollo
      .query<{ treatmentsPendingClosure: Treatment[] }>({
        query: GET_TREATMENTS_PENDING_CLOSURE,
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data.treatmentsPendingClosure));
  }

  /**
   * Get treatments by patient
   */
  getTreatmentsByPatient(
    patientId: number,
    limit?: number,
    offset?: number
  ): Observable<Treatment[]> {
    return this.apollo
      .query<{ treatmentsByPatient: Treatment[] }>({
        query: GET_TREATMENTS_BY_PATIENT,
        variables: { patientId, limit, offset },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data.treatmentsByPatient));
  }

  /**
   * Get treatments not invoiced to patient
   */
  getTreatmentsNotInvoicedToPatient(
    dateFrom?: string,
    dateTo?: string
  ): Observable<Treatment[]> {
    return this.apollo
      .query<{ treatmentsNotInvoicedToPatient: Treatment[] }>({
        query: GET_TREATMENTS_NOT_INVOICED_TO_PATIENT,
        variables: { dateFrom, dateTo },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data.treatmentsNotInvoicedToPatient));
  }

  /**
   * Get treatments not invoiced by operator
   */
  getTreatmentsNotInvoicedByOperator(
    operatorId?: string,
    dateFrom?: string,
    dateTo?: string
  ): Observable<Treatment[]> {
    return this.apollo
      .query<{ treatmentsNotInvoicedByOperator: Treatment[] }>({
        query: GET_TREATMENTS_NOT_INVOICED_BY_OPERATOR,
        variables: { operatorId, dateFrom, dateTo },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data.treatmentsNotInvoicedByOperator));
  }

  // ==================== TREATMENT MUTATIONS ====================

  /**
   * Create treatment from appointment (when patient arrives)
   */
  createTreatment(appointmentId: string): Observable<Treatment> {
    return this.apollo
      .mutate<{ createTreatment: Treatment }>({
        mutation: CREATE_TREATMENT,
        variables: { appointmentId },
      })
      .pipe(map((result) => result.data!.createTreatment));
  }

  /**
   * Operator completes treatment
   */
  completeTreatment(id: string, input: CompleteTreatmentInput): Observable<Treatment> {
    return this.apollo
      .mutate<{ completeTreatment: Treatment }>({
        mutation: COMPLETE_TREATMENT,
        variables: { id, input },
      })
      .pipe(map((result) => result.data!.completeTreatment));
  }

  /**
   * Secretary closes treatment
   */
  closeTreatment(id: string, input: CloseTreatmentInput): Observable<Treatment> {
    return this.apollo
      .mutate<{ closeTreatment: Treatment }>({
        mutation: CLOSE_TREATMENT,
        variables: { id, input },
      })
      .pipe(map((result) => result.data!.closeTreatment));
  }

  /**
   * Record payment for treatment
   */
  recordPayment(id: string, input: RecordPaymentInput): Observable<Treatment> {
    return this.apollo
      .mutate<{ recordTreatmentPayment: Treatment }>({
        mutation: RECORD_TREATMENT_PAYMENT,
        variables: { id, input },
      })
      .pipe(map((result) => result.data!.recordTreatmentPayment));
  }

  /**
   * Mark treatment as invoiced to patient
   */
  markInvoicedToPatient(id: string, invoiceNumber?: string): Observable<Treatment> {
    return this.apollo
      .mutate<{ markTreatmentInvoicedToPatient: Treatment }>({
        mutation: MARK_TREATMENT_INVOICED_TO_PATIENT,
        variables: { id, invoiceNumber },
      })
      .pipe(map((result) => result.data!.markTreatmentInvoicedToPatient));
  }

  /**
   * Mark treatment as invoiced by operator to studio
   */
  markInvoicedByOperator(id: string, invoiceNumber?: string): Observable<Treatment> {
    return this.apollo
      .mutate<{ markTreatmentInvoicedByOperator: Treatment }>({
        mutation: MARK_TREATMENT_INVOICED_BY_OPERATOR,
        variables: { id, invoiceNumber },
      })
      .pipe(map((result) => result.data!.markTreatmentInvoicedByOperator));
  }

  /**
   * Update treatment instruments
   */
  updateInstruments(
    id: string,
    instruments: TreatmentInstrumentInput[]
  ): Observable<Treatment> {
    return this.apollo
      .mutate<{ updateTreatmentInstruments: Treatment }>({
        mutation: UPDATE_TREATMENT_INSTRUMENTS,
        variables: { id, instruments },
      })
      .pipe(map((result) => result.data!.updateTreatmentInstruments));
  }

  // ==================== APPOINTMENT STATUS MUTATIONS ====================

  /**
   * Cancel appointment with notice tracking
   */
  cancelAppointment(id: string, input: CancelAppointmentInput): Observable<Appointment> {
    return this.apollo
      .mutate<{ cancelAppointmentWithNotice: Appointment }>({
        mutation: CANCEL_APPOINTMENT_WITH_NOTICE,
        variables: { id, input },
      })
      .pipe(map((result) => result.data!.cancelAppointmentWithNotice));
  }

  /**
   * Mark appointment as no-show
   */
  markAppointmentNoShow(id: string): Observable<Appointment> {
    return this.apollo
      .mutate<{ markAppointmentNoShow: Appointment }>({
        mutation: MARK_APPOINTMENT_NO_SHOW,
        variables: { id },
      })
      .pipe(map((result) => result.data!.markAppointmentNoShow));
  }

  /**
   * Mark appointment as attended (patient arrived)
   */
  markAppointmentAttended(id: string): Observable<Appointment> {
    return this.apollo
      .mutate<{ markAppointmentAttended: Appointment }>({
        mutation: MARK_APPOINTMENT_ATTENDED,
        variables: { id },
      })
      .pipe(map((result) => result.data!.markAppointmentAttended));
  }
}

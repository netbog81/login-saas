import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AvailabilityAppointment, BookingStatus } from '../graphql/generated/types';
import {
  GET_AVAILABILITY_APPOINTMENT,
  GET_AVAILABILITY_APPOINTMENTS,
  GET_AVAILABILITY_APPOINTMENTS_BY_OPERATOR,
  GET_AVAILABILITY_APPOINTMENTS_BY_PATIENT,
  GET_RECURRING_SERIES,
  IS_INSTRUMENT_AVAILABLE,
} from '../graphql/operations/availability-appointment.queries';
import {
  CREATE_AVAILABILITY_APPOINTMENT,
  UPDATE_AVAILABILITY_APPOINTMENT,
  CANCEL_AVAILABILITY_APPOINTMENT,
  DELETE_AVAILABILITY_APPOINTMENT,
  CONFIRM_AVAILABILITY_APPOINTMENT,
  MARK_APPOINTMENT_AS_NO_SHOW,
  CANCEL_APPOINTMENT_WITH_NOTICE,
  MARK_APPOINTMENT_ATTENDED,
  REVERT_APPOINTMENT_ATTENDED,
  SEND_APPOINTMENT_RECAP,
  CANCEL_RECURRING_SERIES,
  DELETE_RECURRING_SERIES,
} from '../graphql/operations/availability-appointment.mutations';
import { BaseGraphQLService } from '../core/services/base-graphql.service';

export interface AppointmentInstrumentInput {
  instrumentCategoryId: string;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
  orderPosition?: number;
}

/**
 * Input per un singolo servizio nell'appuntamento (multi-servizio)
 */
export interface ServiceInputItem {
  serviceId: string;
  customDuration?: number;
  customPrice?: number;
  orderPosition?: number;
}

export interface RepeatConfigInput {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
  selectedDays?: number[];
  endType: 'never' | 'after' | 'until';
  occurrences?: number;
  untilDate?: string;
}

export interface CreateAvailabilityAppointmentInput {
  operatorId: string;
  /** @deprecated Usa services invece */
  serviceId?: string;
  /** Lista dei servizi da associare all'appuntamento (nuovo sistema multi-servizio) */
  services?: ServiceInputItem[];
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  patientId?: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  notes?: string;
  instrumentOrderMatters?: boolean;
  instruments?: AppointmentInstrumentInput[];
  repeatConfig?: RepeatConfigInput;
  nonRetribuito?: boolean;
}

export interface UpdateAvailabilityAppointmentInput {
  /** @deprecated Usa services invece */
  serviceId?: string;
  /** Lista dei servizi da associare all'appuntamento (nuovo sistema multi-servizio) */
  services?: ServiceInputItem[];
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  patientId?: string;
  appointmentDate?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  bookingStatus?: BookingStatus;
  cancellationReason?: string;
  operatorNotes?: string;
  instrumentOrderMatters?: boolean;
  instruments?: AppointmentInstrumentInput[];
  nonRetribuito?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AvailabilityAppointmentService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Ottiene un singolo appuntamento per ID
   */
  getAppointment(id: string): Observable<AvailabilityAppointment | null> {
    return this.query<{ availabilityAppointment: AvailabilityAppointment | null }>(
      GET_AVAILABILITY_APPOINTMENT,
      { id }
    ).pipe(map((result) => result.availabilityAppointment || null));
  }

  /**
   * Ottiene appuntamenti per operatore e range di date.
   */
  getAppointmentsByOperator(
    operatorId: string,
    startDate: string,
    endDate: string
  ): Observable<AvailabilityAppointment[]> {
    return this.query<{ availabilityAppointmentsByOperator: AvailabilityAppointment[] }>(
      GET_AVAILABILITY_APPOINTMENTS_BY_OPERATOR,
      { operatorId, startDate, endDate }
    ).pipe(map((result) => result.availabilityAppointmentsByOperator || []));
  }

  /**
   * Ottiene appuntamenti per range di date
   */
  getAppointments(
    startDate: string,
    endDate: string,
    operatorIds?: string[]
  ): Observable<AvailabilityAppointment[]> {
    return this.query<{ availabilityAppointments: AvailabilityAppointment[] }>(
      GET_AVAILABILITY_APPOINTMENTS,
      { startDate, endDate, operatorIds },
      'no-cache'
    ).pipe(map((result) => result.availabilityAppointments || []));
  }

  /**
   * Crea un nuovo appuntamento
   */
  createAppointment(
    input: CreateAvailabilityAppointmentInput
  ): Observable<AvailabilityAppointment> {
    return this.mutate<{ createAvailabilityAppointment: AvailabilityAppointment }>(
      CREATE_AVAILABILITY_APPOINTMENT,
      { input }
    ).pipe(map((result) => result.createAvailabilityAppointment));
  }

  /**
   * Aggiorna un appuntamento esistente
   */
  updateAppointment(
    id: string,
    input: UpdateAvailabilityAppointmentInput
  ): Observable<AvailabilityAppointment> {
    return this.mutate<{ updateAvailabilityAppointment: AvailabilityAppointment }>(
      UPDATE_AVAILABILITY_APPOINTMENT,
      { id, input }
    ).pipe(map((result) => result.updateAvailabilityAppointment));
  }

  /**
   * Cancella un appuntamento (soft delete)
   */
  cancelAppointment(
    id: string,
    cancellationReason?: string
  ): Observable<AvailabilityAppointment> {
    return this.mutate<{ cancelAvailabilityAppointment: AvailabilityAppointment }>(
      CANCEL_AVAILABILITY_APPOINTMENT,
      { id, cancellationReason }
    ).pipe(map((result) => result.cancelAvailabilityAppointment));
  }

  /**
   * Elimina definitivamente un appuntamento
   */
  deleteAppointment(id: string): Observable<boolean> {
    return this.mutate<{ deleteAvailabilityAppointment: boolean }>(
      DELETE_AVAILABILITY_APPOINTMENT,
      { id }
    ).pipe(map((result) => result.deleteAvailabilityAppointment));
  }

  /**
   * Conferma un appuntamento
   */
  confirmAppointment(id: string): Observable<AvailabilityAppointment> {
    return this.mutate<{ confirmAvailabilityAppointment: AvailabilityAppointment }>(
      CONFIRM_AVAILABILITY_APPOINTMENT,
      { id }
    ).pipe(map((result) => result.confirmAvailabilityAppointment));
  }

  /**
   * Segna come no-show
   */
  markAsNoShow(id: string): Observable<AvailabilityAppointment> {
    return this.mutate<{ markAppointmentAsNoShow: AvailabilityAppointment }>(
      MARK_APPOINTMENT_AS_NO_SHOW,
      { id }
    ).pipe(map((result) => result.markAppointmentAsNoShow));
  }

  /**
   * Cancella con calcolo automatico del preavviso
   * - >24h → cancelled_early
   * - <24h → cancelled_late (incrementa contatore paziente)
   */
  cancelWithNotice(
    id: string,
    reason: string,
    cancelledBy: string
  ): Observable<AvailabilityAppointment> {
    return this.mutate<{ cancelAppointmentWithNotice: AvailabilityAppointment }>(
      CANCEL_APPOINTMENT_WITH_NOTICE,
      { id, reason, cancelledBy }
    ).pipe(map((result) => result.cancelAppointmentWithNotice));
  }

  /**
   * Segna paziente come presentato (abilita creazione trattamento)
   */
  markAsAttended(id: string): Observable<AvailabilityAppointment> {
    return this.mutate<{ markAppointmentAttended: AvailabilityAppointment }>(
      MARK_APPOINTMENT_ATTENDED,
      { id }
    ).pipe(map((result) => result.markAppointmentAttended));
  }

  /**
   * Annulla stato attended e ripristina a confirmed
   * Utile per correggere click accidentali
   */
  revertAttended(id: string): Observable<AvailabilityAppointment> {
    return this.mutate<{ revertAppointmentAttended: AvailabilityAppointment }>(
      REVERT_APPOINTMENT_ATTENDED,
      { id }
    ).pipe(map((result) => result.revertAppointmentAttended));
  }

  /**
   * Verifica se uno strumento è disponibile per un dato slot
   */
  isInstrumentAvailable(
    instrumentId: string,
    appointmentDate: string,
    startTime: string,
    startOffsetMinutes: number,
    endOffsetMinutes: number,
    excludeAppointmentId?: string
  ): Observable<boolean> {
    return this.query<{ isInstrumentAvailable: boolean }>(
      IS_INSTRUMENT_AVAILABLE,
      {
        instrumentId,
        appointmentDate,
        startTime,
        startOffsetMinutes,
        endOffsetMinutes,
        excludeAppointmentId,
      }
    ).pipe(map((result) => result.isInstrumentAvailable ?? false));
  }

  /**
   * Ottiene appuntamenti futuri di un paziente a partire da una data
   */
  getAppointmentsByPatient(
    patientId: string,
    startDate: string
  ): Observable<AvailabilityAppointment[]> {
    return this.query<{ availabilityAppointmentsByPatient: AvailabilityAppointment[] }>(
      GET_AVAILABILITY_APPOINTMENTS_BY_PATIENT,
      { patientId, startDate }
    ).pipe(map((result) => result.availabilityAppointmentsByPatient || []));
  }

  /**
   * Re-invia il messaggio WhatsApp di recap per un appuntamento
   */
  sendRecap(appointmentId: string): Observable<boolean> {
    return this.mutate<{ sendAppointmentRecap: boolean }>(
      SEND_APPOINTMENT_RECAP,
      { appointmentId }
    ).pipe(map((result) => result.sendAppointmentRecap));
  }

  // ==================== RECURRING SERIES ====================

  /**
   * Ottiene tutti gli appuntamenti di una serie ricorrente
   */
  getRecurringSeries(recurringGroupId: string): Observable<AvailabilityAppointment[]> {
    return this.query<{ recurringSeries: AvailabilityAppointment[] }>(
      GET_RECURRING_SERIES,
      { recurringGroupId },
      'no-cache'
    ).pipe(map((result) => result.recurringSeries || []));
  }

  /**
   * Cancella (soft) appuntamenti di una serie ricorrente
   */
  cancelRecurringSeries(
    appointmentId: string,
    fromDate: string,
    scope: 'THIS_AND_FOLLOWING' | 'ALL',
    reason: string,
    cancelledBy: string,
  ): Observable<number> {
    return this.mutate<{ cancelRecurringSeries: number }>(
      CANCEL_RECURRING_SERIES,
      { appointmentId, fromDate, scope, reason, cancelledBy }
    ).pipe(map((result) => result.cancelRecurringSeries));
  }

  /**
   * Elimina (hard delete) appuntamenti di una serie ricorrente
   */
  deleteRecurringSeries(
    appointmentId: string,
    fromDate: string,
    scope: 'THIS_AND_FOLLOWING' | 'ALL',
  ): Observable<number> {
    return this.mutate<{ deleteRecurringSeries: number }>(
      DELETE_RECURRING_SERIES,
      { appointmentId, fromDate, scope }
    ).pipe(map((result) => result.deleteRecurringSeries));
  }
}

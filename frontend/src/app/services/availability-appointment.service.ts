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
  RECURRING_SERIES_PREVIEW,
  CAN_MARK_ATTENDANCE,
} from '../graphql/operations/availability-appointment.queries';
import {
  CREATE_AVAILABILITY_APPOINTMENT,
  UPDATE_AVAILABILITY_APPOINTMENT,
  CANCEL_AVAILABILITY_APPOINTMENT,
  DELETE_AVAILABILITY_APPOINTMENT,
  CONFIRM_AVAILABILITY_APPOINTMENT,
  MARK_APPOINTMENT_AS_NO_SHOW,
  MARK_APPOINTMENT_LATE_ARRIVAL,
  CLEAR_APPOINTMENT_LATE_ARRIVAL,
  CANCEL_APPOINTMENT_WITH_NOTICE,
  MARK_APPOINTMENT_ATTENDED,
  REVERT_APPOINTMENT_ATTENDED,
  SEND_APPOINTMENT_RECAP,
  SEND_APPOINTMENTS_RECAP,
  MAKE_APPOINTMENT_RECURRING,
  CANCEL_RECURRING_SERIES,
  DELETE_RECURRING_SERIES,
  UPDATE_RECURRING_SERIES_TIME,
  UPDATE_RECURRING_SERIES,
} from '../graphql/operations/availability-appointment.mutations';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
import {
  RecurringOccurrencePreview, ResolvedOccurrenceInput,
} from '../features/calendar-v3/models/recurring-resolution.model';

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
  /** Enum GraphQL: va inviato come nome ('DAY_OF_MONTH' | 'DAY_OF_WEEK'). */
  monthlyMode?: string;
  /** Fasce mensili "il <ordinal> <weekday>" per monthlyMode = DAY_OF_WEEK. */
  monthlyRules?: { ordinal: number; weekday: number }[];
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
  /**
   * Piano risolto nel riquadro conflitti: le occorrenze da creare davvero,
   * spostamenti compresi. Quando c'è, il backend non rigenera le date.
   */
  occurrences?: ResolvedOccurrenceInput[];
  nonRetribuito?: boolean;
  /** Forza il salvataggio anche fuori dalla disponibilità dell'operatore. */
  forceOutsideAvailability?: boolean;
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
  /** Forza il salvataggio anche fuori dalla disponibilità dell'operatore. */
  forceOutsideAvailability?: boolean;
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
    /** Omesso = intervallo aperto: da `startDate` in poi, senza limite. */
    endDate?: string
  ): Observable<AvailabilityAppointment[]> {
    return this.query<{ availabilityAppointmentsByOperator: AvailabilityAppointment[] }>(
      GET_AVAILABILITY_APPOINTMENTS_BY_OPERATOR,
      { operatorId, startDate, endDate: endDate ?? null }
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
   * Registra a posteriori l'arrivo in ritardo del paziente.
   *
   * Serve quando il cambio automatico di stato ha già portato
   * l'appuntamento a "presentato" all'orario previsto: senza questo gesto
   * il ritardo non verrebbe mai misurato. Se `lateMinutes` non è passato,
   * il backend lo calcola sull'ora corrente.
   */
  markLateArrival(id: string, lateMinutes?: number): Observable<AvailabilityAppointment> {
    return this.mutate<{ markAppointmentLateArrival: AvailabilityAppointment }>(
      MARK_APPOINTMENT_LATE_ARRIVAL,
      { id, lateMinutes: lateMinutes ?? null }
    ).pipe(map((result) => result.markAppointmentLateArrival));
  }

  /**
   * Annulla la registrazione del ritardo (click sbagliato).
   */
  clearLateArrival(id: string): Observable<AvailabilityAppointment> {
    return this.mutate<{ clearAppointmentLateArrival: AvailabilityAppointment }>(
      CLEAR_APPOINTMENT_LATE_ARRIVAL,
      { id }
    ).pipe(map((result) => result.clearAppointmentLateArrival));
  }

  /**
   * Cancella con calcolo automatico del preavviso
   * - >24h → cancelled_early
   * - <24h → cancelled_late (incrementa contatore paziente)
   */
  /**
   * Chi ha disdetto NON si manda dal client: lo ricava il backend dal JWT.
   * I chiamanti passavano etichette di ruolo ('secretary', 'system') su una
   * colonna `uuid`, e ogni disdetta finiva in "invalid input syntax for type
   * uuid".
   */
  cancelWithNotice(
    id: string,
    reason: string,
  ): Observable<AvailabilityAppointment> {
    return this.mutate<{ cancelAppointmentWithNotice: AvailabilityAppointment }>(
      CANCEL_APPOINTMENT_WITH_NOTICE,
      { id, reason }
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
   * Esegue l'azione di presenza chiesta dal dialog appuntamento.
   *
   * Sta qui e non nei container perche' e' la stessa identica mappatura per
   * tutti e tre i calendari (v3, v2, cdk): duplicarla significava — ed e'
   * successo — che uno dei tre si dimenticasse di gestire un'azione e i
   * pulsanti restassero muti senza dare errore.
   */
  runAttendanceAction(
    action: 'mark-attended' | 'mark-no-show' | 'cancel-with-notice' | 'revert-attended',
    appointmentId: string,
  ): Observable<AvailabilityAppointment> {
    switch (action) {
      case 'mark-attended':
        return this.markAsAttended(appointmentId);
      case 'mark-no-show':
        return this.markAsNoShow(appointmentId);
      case 'revert-attended':
        return this.revertAttended(appointmentId);
      case 'cancel-with-notice':
        return this.cancelWithNotice(appointmentId, 'Annullato da segreteria');
    }
  }

  /**
   * L'utente collegato puo' marcare presenze e assenze?
   * Regola decisa dal backend (ruolo + impostazione `noShow.operatorsCanMark`),
   * cosi' la UI non la duplica e non puo' andare fuori sincrono.
   */
  canMarkAttendance(): Observable<boolean> {
    return this.query<{ canMarkAttendance: boolean }>(
      CAN_MARK_ATTENDANCE,
      {},
      'network-only',
    ).pipe(map((result) => result.canMarkAttendance === true));
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

  /**
   * Invia un unico messaggio WhatsApp con il riepilogo degli appuntamenti
   * indicati (invio istantaneo via chat, niente code del gateway).
   */
  sendAppointmentsRecap(patientId: string, appointmentIds: string[]): Observable<boolean> {
    return this.mutate<{ sendAppointmentsRecap: boolean }>(
      SEND_APPOINTMENTS_RECAP,
      { patientId, appointmentIds }
    ).pipe(map((result) => result.sendAppointmentsRecap));
  }

  /**
   * Trasforma un appuntamento singolo esistente in serie ricorrente:
   * l'appuntamento diventa il master, le occorrenze successive vengono
   * create dal backend copiando servizi e strumenti.
   */
  makeRecurring(
    appointmentId: string,
    repeatConfig: unknown,
    force?: boolean,
    /**
     * Piano risolto. Le occorrenze palestra possono portare anche `gymRoomId`
     * quando lo spostamento cambia sala: è l'asse alternativo della palestra,
     * come `operatorId` lo è per gli appuntamenti standard.
     */
    occurrences?: (ResolvedOccurrenceInput & { gymRoomId?: string })[],
  ): Observable<AvailabilityAppointment> {
    return this.mutate<{ makeAppointmentRecurring: AvailabilityAppointment }>(
      MAKE_APPOINTMENT_RECURRING,
      { appointmentId, repeatConfig, force, occurrences: occurrences ?? null }
    ).pipe(map((result) => result.makeAppointmentRecurring));
  }

  /**
   * Piano di una serie ricorrente prima di crearla: date generate e conflitti,
   * senza scrivere niente. Alimenta il riquadro di risoluzione.
   */
  previewRecurringSeries(input: {
    /** Serie standard: l'operatore su cui validare disponibilità e sovrapposizioni. */
    operatorId?: string;
    /**
     * Serie palestra: la sala. Se valorizzata, il backend valuta le occorrenze
     * con i predicati della palestra (fascia chiusa, istruttore assegnato dal
     * template, capienza) invece che con quelli dell'operatore.
     */
    gymRoomId?: string;
    /** Paziente della serie: segnala le date in cui è già prenotato. */
    patientId?: string;
    startDate: string;
    startTime: string;
    endTime: string;
    repeatConfig: RepeatConfigInput;
    excludeAppointmentId?: string;
  }): Observable<RecurringOccurrencePreview[]> {
    return this.query<{ recurringSeriesPreview: RecurringOccurrencePreview[] }>(
      RECURRING_SERIES_PREVIEW,
      { input },
      'no-cache',
    ).pipe(map((result) => result.recurringSeriesPreview ?? []));
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
   * Elimina (hard delete) appuntamenti di una serie ricorrente.
   * Scope: CURRENT_ONLY / THIS_AND_FOLLOWING / ALL / DATE_RANGE.
   */
  deleteRecurringSeries(
    appointmentId: string,
    fromDate: string,
    scope: RecurringSeriesScope,
    opts?: { rangeFrom?: string; rangeTo?: string; includeCurrent?: boolean },
  ): Observable<number> {
    return this.mutate<{ deleteRecurringSeries: number }>(
      DELETE_RECURRING_SERIES,
      {
        appointmentId, fromDate, scope,
        rangeFrom: opts?.rangeFrom ?? null,
        rangeTo: opts?.rangeTo ?? null,
        includeCurrent: opts?.includeCurrent ?? null,
      }
    ).pipe(map((result) => result.deleteRecurringSeries));
  }

  /**
   * Modifica orario/durata delle occorrenze di una serie ricorrente nello
   * scope scelto. Se la risposta contiene conflitti, NULLA è stato applicato.
   */
  updateRecurringSeriesTime(input: {
    appointmentId: string;
    scope: RecurringSeriesScope;
    startTime: string;
    endTime: string;
    rangeFrom?: string;
    rangeTo?: string;
    includeCurrent?: boolean;
    /** Piano risolto nel riquadro conflitti; assente = comportamento storico. */
    occurrences?: ResolvedOccurrenceInput[];
  }): Observable<RecurringSeriesOperationResult> {
    return this.mutate<{ updateRecurringSeriesTime: RecurringSeriesOperationResult }>(
      UPDATE_RECURRING_SERIES_TIME,
      { input },
    ).pipe(map((result) => result.updateRecurringSeriesTime));
  }

  /**
   * Modifica COMPLETA di una serie ricorrente nello scope scelto: propaga tutti
   * i campi modificabili (orario, operatore, paziente, servizi, strumenti, note,
   * non-retribuito) ed un eventuale spostamento di data (`newDate`). Se la
   * risposta contiene conflitti, NULLA è stato applicato (avvisa-e-blocca).
   */
  updateRecurringSeries(input: {
    appointmentId: string;
    scope: RecurringSeriesScope;
    startTime: string;
    endTime: string;
    newDate?: string;
    operatorId?: string;
    /**
     * Sala di destinazione per una serie palestra. È l'asse alternativo della
     * palestra, come `operatorId` lo è per le serie standard: ogni occorrenza
     * viene validata contro chiusure, istruttore e capienza della sala nuova.
     */
    gymRoomId?: string;
    patientId?: string;
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    notes?: string;
    nonRetribuito?: boolean;
    instrumentOrderMatters?: boolean;
    services?: { serviceId: string; customPrice?: number; customDuration?: number; orderPosition?: number }[];
    instruments?: { instrumentCategoryId: string; startOffsetMinutes: number; endOffsetMinutes: number; orderPosition?: number }[];
    rangeFrom?: string;
    rangeTo?: string;
    includeCurrent?: boolean;
    /** Occorrenze lasciate intatte, decise nel riquadro conflitti. */
    skipAppointmentIds?: string[];
    /**
     * Destinazioni decise a mano per singole occorrenze. In palestra possono
     * portare anche `gymRoomId`, quando una singola data va in un'altra sala.
     */
    occurrenceOverrides?: (ResolvedOccurrenceInput & { gymRoomId?: string })[];
  }): Observable<RecurringSeriesOperationResult> {
    return this.mutate<{ updateRecurringSeries: RecurringSeriesOperationResult }>(
      UPDATE_RECURRING_SERIES,
      { input },
    ).pipe(map((result) => result.updateRecurringSeries));
  }
}

export type RecurringSeriesScope = 'CURRENT_ONLY' | 'THIS_AND_FOLLOWING' | 'ALL' | 'DATE_RANGE';

export interface RecurringOccurrenceConflict {
  appointmentId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  type: string; // 'overlap' | 'unavailable'
  reason: string;
  conflictingStartTime?: string | null;
  conflictingEndTime?: string | null;
}

export interface RecurringSeriesOperationResult {
  applied: boolean;
  affectedCount: number;
  conflicts: RecurringOccurrenceConflict[];
}

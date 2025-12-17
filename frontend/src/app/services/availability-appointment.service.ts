import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import { AvailabilityAppointment, BookingStatus } from '../graphql/generated/types';
import {
  GET_AVAILABILITY_APPOINTMENT,
  GET_AVAILABILITY_APPOINTMENTS,
  GET_AVAILABILITY_APPOINTMENTS_BY_OPERATOR,
  IS_INSTRUMENT_AVAILABLE,
  CHECK_SLOT_AVAILABILITY,
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
} from '../graphql/operations/availability-appointment.mutations';

export interface AppointmentInstrumentInput {
  instrumentCategoryId: string;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
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
  serviceId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  patientId?: number;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  notes?: string;
  instrumentOrderMatters?: boolean;
  instruments?: AppointmentInstrumentInput[];
  repeatConfig?: RepeatConfigInput;
}

export interface UpdateAvailabilityAppointmentInput {
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  patientId?: number;
  appointmentDate?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  bookingStatus?: BookingStatus;
  cancellationReason?: string;
  operatorNotes?: string;
  instrumentOrderMatters?: boolean;
  instruments?: AppointmentInstrumentInput[];
}

@Injectable({
  providedIn: 'root',
})
export class AvailabilityAppointmentService {
  constructor(private apollo: Apollo) {}

  /**
   * Ottiene un singolo appuntamento per ID
   */
  getAppointment(id: string): Observable<AvailabilityAppointment | null> {
    return this.apollo
      .query<{ availabilityAppointment: AvailabilityAppointment | null }>({
        query: GET_AVAILABILITY_APPOINTMENT,
        variables: { id },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.availabilityAppointment || null));
  }

  /**
   * Ottiene appuntamenti per operatore e range di date
   */
  getAppointmentsByOperator(
    operatorId: string,
    startDate: string,
    endDate: string
  ): Observable<AvailabilityAppointment[]> {
    return this.apollo
      .query<{ availabilityAppointmentsByOperator: AvailabilityAppointment[] }>({
        query: GET_AVAILABILITY_APPOINTMENTS_BY_OPERATOR,
        variables: { operatorId, startDate, endDate },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => result.data?.availabilityAppointmentsByOperator || [])
      );
  }

  /**
   * Ottiene appuntamenti per range di date
   */
  getAppointments(
    startDate: string,
    endDate: string,
    operatorIds?: string[]
  ): Observable<AvailabilityAppointment[]> {
    return this.apollo
      .query<{ availabilityAppointments: AvailabilityAppointment[] }>({
        query: GET_AVAILABILITY_APPOINTMENTS,
        variables: { startDate, endDate, operatorIds },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.availabilityAppointments || []));
  }

  /**
   * Crea un nuovo appuntamento
   */
  createAppointment(
    input: CreateAvailabilityAppointmentInput
  ): Observable<AvailabilityAppointment> {
    return this.apollo
      .mutate<{ createAvailabilityAppointment: AvailabilityAppointment }>({
        mutation: CREATE_AVAILABILITY_APPOINTMENT,
        variables: { input },
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to create appointment');
          }
          return result.data.createAvailabilityAppointment;
        })
      );
  }

  /**
   * Aggiorna un appuntamento esistente
   */
  updateAppointment(
    id: string,
    input: UpdateAvailabilityAppointmentInput
  ): Observable<AvailabilityAppointment> {
    return this.apollo
      .mutate<{ updateAvailabilityAppointment: AvailabilityAppointment }>({
        mutation: UPDATE_AVAILABILITY_APPOINTMENT,
        variables: { id, input },
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to update appointment');
          }
          return result.data.updateAvailabilityAppointment;
        })
      );
  }

  /**
   * Cancella un appuntamento (soft delete)
   */
  cancelAppointment(
    id: string,
    cancellationReason?: string
  ): Observable<AvailabilityAppointment> {
    return this.apollo
      .mutate<{ cancelAvailabilityAppointment: AvailabilityAppointment }>({
        mutation: CANCEL_AVAILABILITY_APPOINTMENT,
        variables: { id, cancellationReason },
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to cancel appointment');
          }
          return result.data.cancelAvailabilityAppointment;
        })
      );
  }

  /**
   * Elimina definitivamente un appuntamento
   */
  deleteAppointment(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteAvailabilityAppointment: boolean }>({
        mutation: DELETE_AVAILABILITY_APPOINTMENT,
        variables: { id },
      })
      .pipe(
        map((result) => {
          if (result.data === undefined) {
            throw new Error('Failed to delete appointment');
          }
          return result.data.deleteAvailabilityAppointment;
        })
      );
  }

  /**
   * Conferma un appuntamento
   */
  confirmAppointment(id: string): Observable<AvailabilityAppointment> {
    return this.apollo
      .mutate<{ confirmAvailabilityAppointment: AvailabilityAppointment }>({
        mutation: CONFIRM_AVAILABILITY_APPOINTMENT,
        variables: { id },
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to confirm appointment');
          }
          return result.data.confirmAvailabilityAppointment;
        })
      );
  }

  /**
   * Segna come no-show
   */
  markAsNoShow(id: string): Observable<AvailabilityAppointment> {
    return this.apollo
      .mutate<{ markAppointmentAsNoShow: AvailabilityAppointment }>({
        mutation: MARK_APPOINTMENT_AS_NO_SHOW,
        variables: { id },
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to mark appointment as no-show');
          }
          return result.data.markAppointmentAsNoShow;
        })
      );
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
    return this.apollo
      .mutate<{ cancelAppointmentWithNotice: AvailabilityAppointment }>({
        mutation: CANCEL_APPOINTMENT_WITH_NOTICE,
        variables: { id, reason, cancelledBy },
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to cancel appointment');
          }
          return result.data.cancelAppointmentWithNotice;
        })
      );
  }

  /**
   * Segna paziente come presentato (abilita creazione trattamento)
   */
  markAsAttended(id: string): Observable<AvailabilityAppointment> {
    return this.apollo
      .mutate<{ markAppointmentAttended: AvailabilityAppointment }>({
        mutation: MARK_APPOINTMENT_ATTENDED,
        variables: { id },
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to mark appointment as attended');
          }
          return result.data.markAppointmentAttended;
        })
      );
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
    return this.apollo
      .query<{ isInstrumentAvailable: boolean }>({
        query: IS_INSTRUMENT_AVAILABLE,
        variables: {
          instrumentId,
          appointmentDate,
          startTime,
          startOffsetMinutes,
          endOffsetMinutes,
          excludeAppointmentId,
        },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.isInstrumentAvailable ?? false));
  }

  /**
   * Verifica disponibilità slot con strumenti multipli
   * Usato per validazione real-time nel modal di prenotazione
   */
  checkSlotAvailability(input: CheckSlotAvailabilityInput): Observable<SlotAvailabilityResult> {
    console.log('[checkSlotAvailability] Input:', JSON.stringify(input, null, 2));

    return this.apollo
      .query<{ physiotherapistAvailableSlots: PhysiotherapistSlotOutput[] }>({
        query: CHECK_SLOT_AVAILABILITY,
        variables: { input },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          const slots = result.data?.physiotherapistAvailableSlots || [];
          console.log('[checkSlotAvailability] Backend returned slots:', slots.length, slots.map(s => `${s.startTime} (available: ${s.available})`));

          // Trova lo slot che corrisponde al nostro startTime
          const matchingSlot = slots.find(slot => slot.startTime === input.startTime);
          console.log('[checkSlotAvailability] Looking for startTime:', input.startTime, '| Found:', !!matchingSlot);

          if (!matchingSlot) {
            // Se slots è vuoto, probabilmente mancano strumenti attivi per le categorie richieste
            if (slots.length === 0) {
              console.log('[checkSlotAvailability] No slots returned - likely missing active instruments for categories');
              return {
                available: false,
                reason: 'Nessuno strumento disponibile per una delle categorie selezionate'
              };
            }

            // Se non troviamo lo slot specifico, verifichiamo se c'è almeno uno slot disponibile
            const anyAvailable = slots.find(slot => slot.available);
            if (anyAvailable) {
              console.log('[checkSlotAvailability] Slot not found at exact time, but other available slots exist');
              return { available: true };
            }
            return { available: false, reason: 'Slot non disponibile per questo orario' };
          }

          console.log('[checkSlotAvailability] Matching slot found:', matchingSlot);
          return {
            available: matchingSlot.available,
            reason: matchingSlot.reason,
            suggestedInstruments: matchingSlot.suggestedInstruments,
          };
        })
      );
  }
}

// Interfaces for slot availability check
export interface InstrumentSlotInput {
  instrumentCategoryId: string;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
}

export interface CheckSlotAvailabilityInput {
  operatorId: string;
  date: string;
  startTime?: string; // Per filtrare il risultato
  durationMinutes: number;
  customInstrumentSlots?: InstrumentSlotInput[];
  instrumentOrderMatters?: boolean; // Se false, backend prova anche ordine inverso
}

export interface InstrumentSlotOutput {
  instrumentCategoryId: string;
  categoryName: string;
  instrumentId?: string;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
}

export interface PhysiotherapistSlotOutput {
  startTime: string;
  endTime: string;
  available: boolean;
  reason?: string;
  suggestedInstruments?: InstrumentSlotOutput[];
}

export interface SlotAvailabilityResult {
  available: boolean;
  reason?: string;
  suggestedInstruments?: InstrumentSlotOutput[];
}

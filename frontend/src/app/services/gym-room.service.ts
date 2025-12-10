import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import {
  GET_GYM_ROOMS,
  GET_GYM_ROOM,
} from '../graphql/operations/gym-room.queries';
import {
  GET_GYM_ROOM_APPOINTMENTS,
  GET_GYM_ROOMS_APPOINTMENTS,
  GET_GYM_ROOM_AVAILABLE_SLOTS,
  CREATE_GYM_APPOINTMENT,
} from '../graphql/operations/gym-appointment.queries';
import {
  UPDATE_AVAILABILITY_APPOINTMENT,
  DELETE_AVAILABILITY_APPOINTMENT,
} from '../graphql/operations/availability-appointment.mutations';
import {
  CREATE_GYM_ROOM,
  UPDATE_GYM_ROOM,
  DELETE_GYM_ROOM,
} from '../graphql/operations/gym-room.mutations';

/**
 * Rappresentazione di una GymRoom
 */
export interface GymRoom {
  id: string;
  name: string;
  maxCapacity: number;
  slotDuration: number;
  color?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input per creare una nuova GymRoom
 */
export interface CreateGymRoomInput {
  name: string;
  maxCapacity?: number;
  slotDuration?: number;
  color?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
}

/**
 * Input per aggiornare una GymRoom
 */
export interface UpdateGymRoomInput {
  name?: string;
  maxCapacity?: number;
  slotDuration?: number;
  color?: string;
  isActive?: boolean;
  defaultStartTime?: string;
  defaultEndTime?: string;
}

/**
 * Informazioni su uno slot della palestra
 */
export interface GymSlotInfo {
  startTime: string;
  endTime: string;
  operator?: {
    id: string;
    name: string;
    surname?: string;
  };
  currentCount: number;
  maxCapacity: number;
  isAvailable: boolean;
  isClosed: boolean;
}

/**
 * Appuntamento palestra
 */
export interface GymAppointment {
  id: string;
  operatorId: string;
  gymRoomId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  patientId?: number;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  treatmentStatus?: string;
  notes?: string;
  participantCount?: number;
  maxParticipants?: number;
  isRecurring: boolean;
  recurringGroupId?: string;
  operator?: {
    id: string;
    name: string;
    surname?: string;
    color?: string;
  };
  gymRoom?: {
    id: string;
    name: string;
    color?: string;
    maxCapacity: number;
  };
}

/**
 * Input per creare un appuntamento palestra
 */
export interface CreateGymAppointmentInput {
  gymRoomId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  patientId?: number;
  notes?: string;
  isRecurring?: boolean;
  repeatConfig?: {
    type: 'daily' | 'weekly' | 'monthly';
    interval: number;
    selectedDays?: number[];
    endType: 'after' | 'until';
    occurrences?: number;
    untilDate?: string;
  };
}

/**
 * Input per aggiornare un appuntamento palestra
 */
export interface UpdateGymAppointmentInput {
  appointmentDate?: string;
  startTime?: string;
  endTime?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  patientId?: number;
  notes?: string;
  gymRoomId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GymRoomService {
  constructor(private apollo: Apollo) {}

  /**
   * Ottiene tutte le palestre
   */
  getAll(onlyActive: boolean = false): Observable<GymRoom[]> {
    return this.apollo
      .query<{ gymRooms: GymRoom[] }>({
        query: GET_GYM_ROOMS,
        variables: { onlyActive },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.gymRooms || []));
  }

  /**
   * Ottiene una singola palestra per ID
   */
  getById(id: string): Observable<GymRoom | null> {
    return this.apollo
      .query<{ gymRoom: GymRoom | null }>({
        query: GET_GYM_ROOM,
        variables: { id },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.gymRoom || null));
  }

  /**
   * Crea una nuova palestra
   */
  create(input: CreateGymRoomInput): Observable<GymRoom> {
    return this.apollo
      .mutate<{ createGymRoom: GymRoom }>({
        mutation: CREATE_GYM_ROOM,
        variables: {
          name: input.name,
          maxCapacity: input.maxCapacity,
          slotDuration: input.slotDuration,
          color: input.color,
          defaultStartTime: input.defaultStartTime,
          defaultEndTime: input.defaultEndTime,
        },
        refetchQueries: [{ query: GET_GYM_ROOMS }],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Errore nella creazione della palestra');
          }
          return result.data.createGymRoom;
        })
      );
  }

  /**
   * Aggiorna una palestra esistente
   */
  update(id: string, input: UpdateGymRoomInput): Observable<GymRoom> {
    return this.apollo
      .mutate<{ updateGymRoom: GymRoom }>({
        mutation: UPDATE_GYM_ROOM,
        variables: {
          id,
          name: input.name,
          maxCapacity: input.maxCapacity,
          slotDuration: input.slotDuration,
          color: input.color,
          isActive: input.isActive,
          defaultStartTime: input.defaultStartTime,
          defaultEndTime: input.defaultEndTime,
        },
        refetchQueries: [
          { query: GET_GYM_ROOMS },
          { query: GET_GYM_ROOM, variables: { id } },
        ],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Errore nell\'aggiornamento della palestra');
          }
          return result.data.updateGymRoom;
        })
      );
  }

  /**
   * Elimina una palestra
   */
  delete(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteGymRoom: boolean }>({
        mutation: DELETE_GYM_ROOM,
        variables: { id },
        refetchQueries: [{ query: GET_GYM_ROOMS }],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Errore nell\'eliminazione della palestra');
          }
          return result.data.deleteGymRoom;
        })
      );
  }

  // ==========================================
  // METODI PER SLOT E APPUNTAMENTI PALESTRA
  // ==========================================

  /**
   * Ottiene gli appuntamenti per una GymRoom in una data specifica
   */
  getAppointments(gymRoomId: string, date: string): Observable<GymAppointment[]> {
    return this.apollo
      .query<{ gymRoomAppointments: GymAppointment[] }>({
        query: GET_GYM_ROOM_APPOINTMENTS,
        variables: { gymRoomId, date },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.gymRoomAppointments || []));
  }

  /**
   * Ottiene gli appuntamenti per più GymRoom in un range di date
   */
  getAppointmentsForRooms(
    gymRoomIds: string[],
    startDate: string,
    endDate: string
  ): Observable<GymAppointment[]> {
    return this.apollo
      .query<{ gymRoomsAppointments: GymAppointment[] }>({
        query: GET_GYM_ROOMS_APPOINTMENTS,
        variables: { gymRoomIds, startDate, endDate },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.gymRoomsAppointments || []));
  }

  /**
   * Ottiene gli slot disponibili per una GymRoom in una data
   */
  getAvailableSlots(gymRoomId: string, date: string): Observable<GymSlotInfo[]> {
    return this.apollo
      .query<{ gymRoomAvailableSlots: GymSlotInfo[] }>({
        query: GET_GYM_ROOM_AVAILABLE_SLOTS,
        variables: { gymRoomId, date },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.gymRoomAvailableSlots || []));
  }

  /**
   * Crea un appuntamento palestra
   */
  createAppointment(input: CreateGymAppointmentInput): Observable<GymAppointment> {
    return this.apollo
      .mutate<{ createGymAppointment: GymAppointment }>({
        mutation: CREATE_GYM_APPOINTMENT,
        variables: { input },
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Errore nella creazione dell\'appuntamento');
          }
          return result.data.createGymAppointment;
        })
      );
  }

  /**
   * Aggiorna un appuntamento palestra esistente
   */
  updateAppointment(id: string, input: UpdateGymAppointmentInput): Observable<GymAppointment> {
    return this.apollo
      .mutate<{ updateAvailabilityAppointment: GymAppointment }>({
        mutation: UPDATE_AVAILABILITY_APPOINTMENT,
        variables: { id, input },
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Errore nell\'aggiornamento dell\'appuntamento');
          }
          return result.data.updateAvailabilityAppointment;
        })
      );
  }

  /**
   * Elimina un appuntamento palestra
   */
  deleteAppointment(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteAvailabilityAppointment: boolean }>({
        mutation: DELETE_AVAILABILITY_APPOINTMENT,
        variables: { id },
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Errore nell\'eliminazione dell\'appuntamento');
          }
          return result.data.deleteAvailabilityAppointment;
        })
      );
  }
}

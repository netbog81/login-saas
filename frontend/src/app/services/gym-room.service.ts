import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  GET_GYM_ROOMS,
  GET_GYM_ROOM,
} from '../graphql/operations/gym-room.queries';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
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
    color?: string;
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
  /** @deprecated Usa appointmentServices invece */
  serviceId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  patientId?: string;
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
  /** @deprecated Usa appointmentServices invece */
  service?: {
    id: string;
    name: string;
  };
  /** Servizi multipli associati all'appuntamento */
  appointmentServices?: {
    id: string;
    serviceId: string;
    customDuration?: number;
    customPrice?: number;
    orderPosition: number;
    service?: {
      id: string;
      name: string;
      defaultPrice?: number;
      discountFE?: number;
      defaultDuration?: number;
    };
  }[];
}

/**
 * Input per un singolo servizio nell'appuntamento
 */
export interface ServiceInputItem {
  serviceId: string;
  customDuration?: number;
  customPrice?: number;
  orderPosition?: number;
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
  patientId?: string;
  /** @deprecated Usa services invece */
  serviceId?: string;
  /** Lista dei servizi associati all'appuntamento */
  services?: ServiceInputItem[];
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
  patientId?: string;
  /** @deprecated Usa services invece */
  serviceId?: string;
  /** Lista dei servizi associati all'appuntamento */
  services?: ServiceInputItem[];
  notes?: string;
  gymRoomId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GymRoomService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Ottiene tutte le palestre
   */
  getAll(onlyActive: boolean = false): Observable<GymRoom[]> {
    return this.query<{ gymRooms: GymRoom[] }>(GET_GYM_ROOMS, { onlyActive })
      .pipe(map((result) => result.gymRooms || []));
  }

  /**
   * Ottiene una singola palestra per ID
   */
  getById(id: string): Observable<GymRoom | null> {
    return this.query<{ gymRoom: GymRoom | null }>(GET_GYM_ROOM, { id })
      .pipe(map((result) => result.gymRoom || null));
  }

  /**
   * Crea una nuova palestra
   */
  create(input: CreateGymRoomInput): Observable<GymRoom> {
    return this.mutate<{ createGymRoom: GymRoom }>(
      CREATE_GYM_ROOM,
      {
        name: input.name,
        maxCapacity: input.maxCapacity,
        slotDuration: input.slotDuration,
        color: input.color,
        defaultStartTime: input.defaultStartTime,
        defaultEndTime: input.defaultEndTime,
      },
      [{ query: GET_GYM_ROOMS }]
    ).pipe(map((result) => result.createGymRoom));
  }

  /**
   * Aggiorna una palestra esistente
   */
  update(id: string, input: UpdateGymRoomInput): Observable<GymRoom> {
    return this.mutate<{ updateGymRoom: GymRoom }>(
      UPDATE_GYM_ROOM,
      {
        id,
        name: input.name,
        maxCapacity: input.maxCapacity,
        slotDuration: input.slotDuration,
        color: input.color,
        isActive: input.isActive,
        defaultStartTime: input.defaultStartTime,
        defaultEndTime: input.defaultEndTime,
      },
      [{ query: GET_GYM_ROOMS }, { query: GET_GYM_ROOM, variables: { id } }]
    ).pipe(map((result) => result.updateGymRoom));
  }

  /**
   * Elimina una palestra
   */
  delete(id: string): Observable<boolean> {
    return this.mutate<{ deleteGymRoom: boolean }>(
      DELETE_GYM_ROOM,
      { id },
      [{ query: GET_GYM_ROOMS }]
    ).pipe(map((result) => result.deleteGymRoom));
  }

  // ==========================================
  // METODI PER SLOT E APPUNTAMENTI PALESTRA
  // ==========================================

  /**
   * Ottiene gli appuntamenti per una GymRoom in una data specifica
   */
  getAppointments(gymRoomId: string, date: string): Observable<GymAppointment[]> {
    return this.query<{ gymRoomAppointments: GymAppointment[] }>(
      GET_GYM_ROOM_APPOINTMENTS,
      { gymRoomId, date }
    ).pipe(map((result) => result.gymRoomAppointments || []));
  }

  /**
   * Ottiene gli appuntamenti per più GymRoom in un range di date
   */
  getAppointmentsForRooms(
    gymRoomIds: string[],
    startDate: string,
    endDate: string
  ): Observable<GymAppointment[]> {
    return this.query<{ gymRoomsAppointments: GymAppointment[] }>(
      GET_GYM_ROOMS_APPOINTMENTS,
      { gymRoomIds, startDate, endDate }
    ).pipe(map((result) => result.gymRoomsAppointments || []));
  }

  /**
   * Ottiene gli slot disponibili per una GymRoom in una data
   */
  getAvailableSlots(gymRoomId: string, date: string): Observable<GymSlotInfo[]> {
    return this.query<{ gymRoomAvailableSlots: GymSlotInfo[] }>(
      GET_GYM_ROOM_AVAILABLE_SLOTS,
      { gymRoomId, date }
    ).pipe(map((result) => result.gymRoomAvailableSlots || []));
  }

  /**
   * Crea un appuntamento palestra
   */
  createAppointment(input: CreateGymAppointmentInput): Observable<GymAppointment> {
    return this.mutate<{ createGymAppointment: GymAppointment }>(
      CREATE_GYM_APPOINTMENT,
      { input }
    ).pipe(map((result) => result.createGymAppointment));
  }

  /**
   * Aggiorna un appuntamento palestra esistente
   */
  updateAppointment(id: string, input: UpdateGymAppointmentInput): Observable<GymAppointment> {
    return this.mutate<{ updateAvailabilityAppointment: GymAppointment }>(
      UPDATE_AVAILABILITY_APPOINTMENT,
      { id, input }
    ).pipe(map((result) => result.updateAvailabilityAppointment));
  }

  /**
   * Elimina un appuntamento palestra
   */
  deleteAppointment(id: string): Observable<boolean> {
    return this.mutate<{ deleteAvailabilityAppointment: boolean }>(
      DELETE_AVAILABILITY_APPOINTMENT,
      { id }
    ).pipe(map((result) => result.deleteAvailabilityAppointment));
  }
}

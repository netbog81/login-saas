import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import {
  GET_GYM_ROOMS,
  GET_GYM_ROOM,
} from '../graphql/operations/gym-room.queries';
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
}

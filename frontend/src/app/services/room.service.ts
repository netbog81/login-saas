import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
import {
  GET_ROOMS,
  CREATE_ROOM,
  UPDATE_ROOM,
  DELETE_ROOM,
  GET_CHAIRS,
  CREATE_CHAIR,
  UPDATE_CHAIR,
  DELETE_CHAIR,
} from '../graphql/operations/room.operations';

export interface Chair {
  id: string;
  roomId: string;
  name: string;
  color?: string;
  isActive: boolean;
  room?: { id: string; name: string };
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  color?: string;
  isActive: boolean;
  chairs?: Chair[];
}

/**
 * Servizio per gli studi (rooms) e le poltrone (chairs) usati nelle
 * assegnazioni template degli operatori. Da non confondere con le palestre
 * (GymRoomService), che hanno un modello a template inverso.
 */
@Injectable({
  providedIn: 'root',
})
export class RoomService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  // ==================== Studi ====================

  getRooms(onlyActive: boolean = false): Observable<Room[]> {
    return this.query<{ rooms: Room[] }>(GET_ROOMS, { onlyActive })
      .pipe(map((result) => result?.rooms || []));
  }

  createRoom(input: { name: string; capacity?: number; color?: string }): Observable<Room> {
    return this.mutate<{ createRoom: Room }>(
      CREATE_ROOM,
      input,
      [{ query: GET_ROOMS }]
    ).pipe(map((result) => result.createRoom));
  }

  updateRoom(
    id: string,
    input: { name?: string; capacity?: number; color?: string; isActive?: boolean }
  ): Observable<Room> {
    return this.mutate<{ updateRoom: Room }>(
      UPDATE_ROOM,
      { id, ...input },
      [{ query: GET_ROOMS }]
    ).pipe(map((result) => result.updateRoom));
  }

  deleteRoom(id: string): Observable<boolean> {
    return this.mutate<{ deleteRoom: boolean }>(
      DELETE_ROOM,
      { id },
      [{ query: GET_ROOMS }]
    ).pipe(map((result) => result.deleteRoom));
  }

  // ==================== Poltrone ====================

  getChairs(roomId?: string, onlyActive: boolean = false): Observable<Chair[]> {
    return this.query<{ chairs: Chair[] }>(GET_CHAIRS, { roomId, onlyActive })
      .pipe(map((result) => result?.chairs || []));
  }

  createChair(input: { roomId: string; name: string; color?: string }): Observable<Chair> {
    return this.mutate<{ createChair: Chair }>(
      CREATE_CHAIR,
      input,
      [{ query: GET_ROOMS }]
    ).pipe(map((result) => result.createChair));
  }

  updateChair(
    id: string,
    input: { name?: string; color?: string; isActive?: boolean; roomId?: string }
  ): Observable<Chair> {
    return this.mutate<{ updateChair: Chair }>(
      UPDATE_CHAIR,
      { id, ...input },
      [{ query: GET_ROOMS }]
    ).pipe(map((result) => result.updateChair));
  }

  deleteChair(id: string): Observable<boolean> {
    return this.mutate<{ deleteChair: boolean }>(
      DELETE_CHAIR,
      { id },
      [{ query: GET_ROOMS }]
    ).pipe(map((result) => result.deleteChair));
  }
}

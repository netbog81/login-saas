import { Injectable, Injector } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { gql } from 'apollo-angular';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import { RoomService, Room } from '../../../services/room.service';
import { RoomDayOccupancy, RoomViewAppointment } from '../models/rooms-view.model';

// Re-export per i consumer esistenti (i modelli vivono in models/rooms-view.model.ts)
export type { RoomOccupancyBand, RoomAbsenceBand, RoomDayOccupancy, RoomViewAppointment } from '../models/rooms-view.model';

const GET_ROOMS_OCCUPANCY = gql`
  query GetRoomsOccupancy($startDate: String!, $endDate: String!) {
    roomsOccupancy(startDate: $startDate, endDate: $endDate) {
      roomId
      date
      bands {
        startTime
        endTime
        operatorId
        operatorName
        operatorColor
        chairId
        chairName
      }
      absences {
        startTime
        endTime
        operatorId
        operatorName
        reason
      }
    }
  }
`;

const GET_ROOMS_VIEW_APPOINTMENTS = gql`
  query GetRoomsViewAppointments($startDate: String!, $endDate: String!) {
    availabilityAppointments(startDate: $startDate, endDate: $endDate) {
      id
      appointmentDate
      startTime
      endTime
      bookingStatus
      roomId
      chairId
      operatorId
      operator {
        id
        name
        surname
        color
      }
    }
  }
`;

/**
 * Assegnazioni slim per calcolare il ciclo massimo (in settimane) dei
 * template applicati con studi: pilota la durata automatica della vista.
 */
const GET_ROOMS_VIEW_CYCLES = gql`
  query GetRoomsViewCycles {
    templateAssignments(onlyCurrent: true) {
      id
      validFrom
      validUntil
      roomId
      patternGroup {
        id
        patternDuration
      }
      roomOverrides {
        id
      }
    }
  }
`;

export interface RoomsViewData {
  rooms: Room[];
  occupancy: RoomDayOccupancy[];
  appointments: RoomViewAppointment[];
  /** Ciclo massimo (settimane, 1-4) tra i template con studi attivi nel range. */
  maxCycleWeeks: number;
}

/**
 * Dati per la vista calendario "Studi": studi attivi, occupazione pianificata
 * dalle assegnazioni template (eccezioni applicate), appuntamenti reali con
 * snapshot roomId e ciclo massimo per la durata automatica della vista.
 */
@Injectable({
  providedIn: 'root',
})
export class RoomsViewDataService extends BaseGraphQLService {
  constructor(
    injector: Injector,
    private roomService: RoomService,
  ) {
    super(injector);
  }

  loadRoomsView(startDate: string, endDate: string): Observable<RoomsViewData> {
    return forkJoin({
      rooms: this.roomService.getRooms(true),
      occupancy: this.query<{ roomsOccupancy: RoomDayOccupancy[] }>(
        GET_ROOMS_OCCUPANCY,
        { startDate, endDate }
      ).pipe(map((r) => r?.roomsOccupancy || [])),
      appointments: this.query<{ availabilityAppointments: RoomViewAppointment[] }>(
        GET_ROOMS_VIEW_APPOINTMENTS,
        { startDate, endDate }
      ).pipe(
        map((r) =>
          (r?.availabilityAppointments || []).filter((a) => !!a.roomId)
        )
      ),
      cycles: this.query<{
        templateAssignments: {
          validFrom: string;
          validUntil?: string;
          roomId?: string;
          patternGroup?: { patternDuration: number };
          roomOverrides?: { id: string }[];
        }[];
      }>(GET_ROOMS_VIEW_CYCLES).pipe(map((r) => r?.templateAssignments || [])),
    }).pipe(
      map(({ rooms, occupancy, appointments, cycles }) => {
        // Ciclo massimo tra le assegnazioni con studi che toccano il range
        let maxCycleWeeks = 1;
        for (const a of cycles) {
          const usesRooms = !!a.roomId || (a.roomOverrides?.length || 0) > 0;
          if (!usesRooms) continue;
          const from = String(a.validFrom).slice(0, 10);
          const until = a.validUntil ? String(a.validUntil).slice(0, 10) : null;
          if (from > endDate || (until && until < startDate)) continue;
          const weeks = Math.ceil((a.patternGroup?.patternDuration || 7) / 7);
          if (weeks > maxCycleWeeks) maxCycleWeeks = Math.min(weeks, 4);
        }
        return { rooms, occupancy, appointments, maxCycleWeeks };
      })
    );
  }
}

/**
 * Gym Rebooking Service
 * Layer 3: Business logic + GraphQL
 *
 * Ricerca di slot palestra liberi e spostamento di una prenotazione, anche
 * in un'altra sala.
 *
 * APPROACH: GraphQL Fragments — `gymRoomsAvailableSlots` è già una query
 * batch multi-sala e multi-data che ritorna capienza, istruttore e stato di
 * chiusura in un colpo solo. Interrogare sala per sala e giorno per giorno
 * (service composition) significherebbe una raffica di round-trip per
 * riempire un pannello che deve aprirsi subito.
 *
 * Il filtro "slot davvero prenotabile" sta QUI e non nel dumb component: è
 * una regola di dominio (chiuso / senza istruttore / pieno), non una
 * questione di rendering.
 */

import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';

import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import { GET_GYM_ROOMS_AVAILABLE_SLOTS } from '../../../graphql/operations/gym-appointment.queries';
import { UPDATE_AVAILABILITY_APPOINTMENT } from '../../../graphql/operations/availability-appointment.mutations';
import { GymSlotInfo } from '../../../services/gym-room.service';
import { GymMoveSlot, GymMoveInput } from '../models/gym-move.model';

/** Sala da interrogare, con i dati che servono a etichettare gli slot. */
export interface GymRoomLookup {
  id: string;
  name: string;
  color?: string;
}

type RawSlot = GymSlotInfo & { gymRoomId: string; date: string };

@Injectable({ providedIn: 'root' })
export class GymRebookingService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Slot liberi delle sale indicate nell'intervallo di date.
   *
   * Esclude gli slot chiusi, quelli senza istruttore assegnato dal template
   * e quelli a capienza esaurita: sono esattamente i tre casi in cui il
   * backend rifiuterebbe lo spostamento, e proporli sarebbe un invito a
   * sbatterci contro.
   */
  getAvailableSlots(
    rooms: GymRoomLookup[],
    startDate: string,
    endDate: string,
    originalRoomId: string,
    /** Slot da escludere: la posizione attuale dell'appuntamento. */
    exclude?: { gymRoomId: string; date: string; startTime: string },
  ): Observable<GymMoveSlot[]> {
    const roomById = new Map(rooms.map((r) => [r.id, r]));

    return this.query<{ gymRoomsAvailableSlots: RawSlot[] }>(
      GET_GYM_ROOMS_AVAILABLE_SLOTS,
      { gymRoomIds: rooms.map((r) => r.id), startDate, endDate },
      // no-cache: la capienza cambia sotto i piedi mentre il pannello è
      // aperto, e uno slot mostrato libero ma già pieno è peggio di uno
      // slot mancante.
      'no-cache',
    ).pipe(
      map((res) =>
        (res.gymRoomsAvailableSlots || [])
          .filter((s) => !s.isClosed && !!s.operator)
          .filter((s) => s.maxCapacity - s.currentCount > 0)
          .filter(
            (s) =>
              !exclude ||
              !(
                s.gymRoomId === exclude.gymRoomId &&
                s.date === exclude.date &&
                this.hhmm(s.startTime) === this.hhmm(exclude.startTime)
              ),
          )
          .map((s) => {
            const room = roomById.get(s.gymRoomId);
            const freeSpots = Math.max(0, s.maxCapacity - s.currentCount);
            return {
              gymRoomId: s.gymRoomId,
              gymRoomName: room?.name ?? 'Sala',
              gymRoomColor: room?.color,
              date: s.date,
              startTime: this.hhmm(s.startTime),
              endTime: this.hhmm(s.endTime),
              operatorName: s.operator
                ? `${s.operator.name} ${s.operator.surname || ''}`.trim()
                : undefined,
              operatorColor: s.operator?.color,
              currentCount: s.currentCount,
              maxCapacity: s.maxCapacity,
              freeSpots,
              isOriginalRoom: s.gymRoomId === originalRoomId,
            } satisfies GymMoveSlot;
          })
          .sort(
            (a, b) =>
              a.date.localeCompare(b.date) ||
              a.startTime.localeCompare(b.startTime) ||
              // A parità di orario la sala di partenza per prima: è la
              // destinazione meno sorprendente per il paziente.
              Number(b.isOriginalRoom) - Number(a.isOriginalRoom),
          ),
      ),
    );
  }

  /**
   * Sposta la prenotazione. Solo ID per le foreign key (regola "UPDATE CON
   * FOREIGN KEYS" dell'architettura): la sala è un id, mai un oggetto.
   *
   * Non tocca paziente, servizi e note: non passandoli, il backend li lascia
   * come sono.
   */
  moveAppointment(input: GymMoveInput): Observable<{ id: string }> {
    return this.mutate<{ updateAvailabilityAppointment: { id: string } }>(
      UPDATE_AVAILABILITY_APPOINTMENT,
      {
        id: input.appointmentId,
        input: {
          appointmentDate: input.appointmentDate,
          startTime: input.startTime,
          endTime: input.endTime,
          ...(input.gymRoomId ? { gymRoomId: input.gymRoomId } : {}),
        },
      },
    ).pipe(map((res) => res.updateAvailabilityAppointment));
  }

  private hhmm(t: string | undefined | null): string {
    return (t ?? '').slice(0, 5);
  }
}

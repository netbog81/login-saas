/**
 * Rebooking Service — Calendario V3
 * Layer 3: Business + GraphQL
 *
 * Supporta il flusso "Sposta appuntamento": ricerca slot disponibili
 * (con verifica strumenti) e riprenotazione dell'appuntamento, anche
 * su un operatore diverso.
 *
 * Isolato in features/calendar-v3 per non toccare i service condivisi.
 */

import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { gql } from 'apollo-angular';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import { RebookingSlot } from '../models/rebooking.model';
import { RebookingInput } from '../models/rebooking-input.model';

const GET_AVAILABLE_SLOTS_FOR_REBOOKING = gql`
  query GetAvailableSlotsForRebooking(
    $operatorIds: [ID!]!
    $dates: [String!]!
    $durationMinutes: Int!
    $serviceId: ID
  ) {
    availableSlotsForRebooking(
      operatorIds: $operatorIds
      dates: $dates
      durationMinutes: $durationMinutes
      serviceId: $serviceId
    ) {
      operatorId
      date
      startTime
      endTime
    }
  }
`;

/**
 * Mutation di riprenotazione: aggiorna operatore (opzionale), data e
 * orario. Servizi/strumenti/note non vengono toccati se non passati →
 * l'appuntamento mantiene i suoi vincoli.
 */
const REBOOK_APPOINTMENT = gql`
  mutation RebookAppointment($id: ID!, $input: UpdateAvailabilityAppointmentInput!) {
    updateAvailabilityAppointment(id: $id, input: $input) {
      id
      operatorId
      appointmentDate
      startTime
      endTime
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class RebookingService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Cerca slot disponibili per riprenotare un appuntamento.
   * @param operatorIds operatori da considerare (originale + altri scelti)
   * @param dates date YYYY-MM-DD da esplorare
   * @param durationMinutes durata richiesta
   * @param serviceId servizio (per il check strumenti); opzionale
   */
  findAvailableSlots(
    operatorIds: string[],
    dates: string[],
    durationMinutes: number,
    serviceId?: string,
  ): Observable<RebookingSlot[]> {
    return this.query<{ availableSlotsForRebooking: RebookingSlot[] }>(
      GET_AVAILABLE_SLOTS_FOR_REBOOKING,
      { operatorIds, dates, durationMinutes, serviceId: serviceId ?? null },
      'no-cache',
    ).pipe(map((r) => r?.availableSlotsForRebooking ?? []));
  }

  /**
   * Riprenota un appuntamento. L'input contiene solo ID (foreign keys):
   * `operatorId` e' presente solo se l'operatore cambia. Servizi,
   * strumenti e note restano invariati perche' non inviati.
   */
  rebook(input: RebookingInput): Observable<{ id: string }> {
    const mutationInput: Record<string, unknown> = {
      appointmentDate: input.appointmentDate,
      startTime: input.startTime,
      endTime: input.endTime,
      forceOutsideAvailability: input.forceOutsideAvailability ?? false,
    };
    if (input.operatorId) mutationInput['operatorId'] = input.operatorId;

    return this.mutate<{ updateAvailabilityAppointment: { id: string } }>(
      REBOOK_APPOINTMENT,
      { id: input.appointmentId, input: mutationInput },
    ).pipe(map((r) => r.updateAvailabilityAppointment));
  }
}

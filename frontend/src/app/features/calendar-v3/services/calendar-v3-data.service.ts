/**
 * Calendar V3 Data Service
 * Layer 3: Business Logic — specifico per il Calendario V3.
 *
 * Esiste separato da CalendarV2DataService per isolare la logica di
 * disponibilita' V3 senza toccare il calendario V2.
 *
 * Differenza chiave: la disponibilita' viene letta dalla query
 * `operatorsAvailabilityV3`, che restituisce i "free block" REALI
 * (fasce di template gia' decurtate degli appuntamenti). Risolve il bug
 * per cui un appuntamento che tocca l'inizio di una fascia faceva
 * sparire l'intera fascia dalla disponibilita'.
 *
 * Gli appuntamenti continuano a essere caricati da CalendarV2DataService:
 * quel flusso non e' affetto dal bug.
 */

import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { gql } from 'apollo-angular';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';

/** Free-block grezzo come arriva dal backend. */
interface OperatorAvailabilityV3Raw {
  operatorId: string;
  days: {
    date: string;
    freeBlocks: { startTime: string; endTime: string }[];
  }[];
}

const GET_OPERATORS_AVAILABILITY_V3 = gql`
  query GetOperatorsAvailabilityV3($operatorIds: [ID!]!, $startDate: String!, $endDate: String!) {
    operatorsAvailabilityV3(operatorIds: $operatorIds, startDate: $startDate, endDate: $endDate) {
      operatorId
      days {
        date
        freeBlocks {
          startTime
          endTime
        }
      }
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class CalendarV3DataService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Carica la disponibilita' V3 per piu' operatori e la restituisce nella
   * struttura attesa da CalendarV2GridService.computeOperatorGrid:
   *   operatorId -> date -> { startTime, endTime }[]
   */
  loadOperatorsAvailability(
    operatorIds: string[],
    startDate: string,
    endDate: string,
  ): Observable<Map<string, Map<string, { startTime: string; endTime: string }[]>>> {
    if (operatorIds.length === 0) {
      return new Observable(s => { s.next(new Map()); s.complete(); });
    }

    return this.query<{ operatorsAvailabilityV3: OperatorAvailabilityV3Raw[] }>(
      GET_OPERATORS_AVAILABILITY_V3,
      { operatorIds, startDate, endDate },
      'no-cache',
    ).pipe(
      map((result) => {
        const byOperator = new Map<string, Map<string, { startTime: string; endTime: string }[]>>();
        for (const op of result?.operatorsAvailabilityV3 ?? []) {
          const dateMap = new Map<string, { startTime: string; endTime: string }[]>();
          for (const day of op.days) {
            dateMap.set(
              day.date,
              day.freeBlocks.map(b => ({ startTime: b.startTime, endTime: b.endTime })),
            );
          }
          byOperator.set(op.operatorId, dateMap);
        }
        return byOperator;
      }),
    );
  }
}

import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import {
  NoShowDecision,
  NoShowEventPage,
  NoShowFilter,
  NoShowPatientPage,
  NoShowReview,
  NoShowSummary,
} from '../models/no-show.model';
import {
  DELETE_NO_SHOW_REVIEW,
  NO_SHOW_BY_PATIENT,
  NO_SHOW_EVENTS,
  NO_SHOW_SUMMARY,
  UPSERT_NO_SHOW_REVIEW,
} from '../graphql/no-show.operations';

interface Paging {
  limit?: number;
  offset?: number;
}

/**
 * Servizio della sezione Statistiche → No Show.
 * Sola lettura + la decisione dello staff su ogni evento.
 */
@Injectable({ providedIn: 'root' })
export class NoShowService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  summary(filter: NoShowFilter): Observable<NoShowSummary> {
    return this.query<{ noShowSummary: NoShowSummary }>(NO_SHOW_SUMMARY, {
      filter: NoShowService.clean(filter),
    }).pipe(map((r) => r.noShowSummary));
  }

  byPatient(filter: NoShowFilter, paging?: Paging): Observable<NoShowPatientPage> {
    return this.query<{ noShowByPatient: NoShowPatientPage }>(NO_SHOW_BY_PATIENT, {
      filter: NoShowService.clean(filter),
      paging: paging ?? null,
    }).pipe(map((r) => r.noShowByPatient));
  }

  events(filter: NoShowFilter, paging?: Paging): Observable<NoShowEventPage> {
    return this.query<{ noShowEvents: NoShowEventPage }>(NO_SHOW_EVENTS, {
      filter: NoShowService.clean(filter),
      paging: paging ?? null,
    }).pipe(map((r) => r.noShowEvents));
  }

  upsertReview(input: {
    appointmentId: string;
    decision: NoShowDecision;
    notes?: string | null;
    chargedAmount?: number | null;
  }): Observable<NoShowReview> {
    return this.mutate<{ upsertNoShowReview: NoShowReview }>(
      UPSERT_NO_SHOW_REVIEW,
      {
        input: {
          appointmentId: input.appointmentId,
          decision: input.decision,
          notes: input.notes || null,
          chargedAmount: input.chargedAmount ?? null,
        },
      },
    ).pipe(map((r) => r.upsertNoShowReview));
  }

  deleteReview(appointmentId: string): Observable<boolean> {
    return this.mutate<{ deleteNoShowReview: boolean }>(DELETE_NO_SHOW_REVIEW, {
      appointmentId,
    }).pipe(map((r) => r.deleteNoShowReview));
  }

  /**
   * Rimuove chiavi vuote/undefined: il backend ha default sensati e un
   * array vuoto significherebbe "nessuna tipologia" invece di "tutte".
   */
  private static clean(filter: NoShowFilter): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(filter)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value) && value.length === 0) continue;
      out[key] = value;
    }
    return out;
  }
}

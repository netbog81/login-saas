/**
 * Patient Calendar Feed Service
 * Layer 3: business logic + GraphQL
 *
 * Estende BaseGraphQLService (NgZone): nessuna chiamata Apollo diretta.
 */

import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import {
  PatientCalendarFeedRow,
  PatientCalendarFeedStatus,
} from '../models/patient-calendar-feed.model';
import {
  GET_PATIENT_CALENDAR_FEED,
  GET_PATIENT_CALENDAR_FEEDS,
  SEND_PATIENT_CALENDAR_FEED_LINK,
  REVOKE_PATIENT_CALENDAR_FEED,
  REVOKE_ALL_PATIENT_CALENDAR_FEEDS,
  REVOKE_STALE_PATIENT_CALENDAR_FEEDS,
} from '../graphql/patient-calendar-feed.operations';

@Injectable({ providedIn: 'root' })
export class PatientCalendarFeedService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /** `no-cache`: lo stato cambia da fuori (il paziente si disiscrive da solo). */
  getStatus(patientId: string): Observable<PatientCalendarFeedStatus> {
    return this.query<{ patientCalendarFeed: PatientCalendarFeedStatus }>(
      GET_PATIENT_CALENDAR_FEED,
      { patientId },
      'no-cache',
    ).pipe(map((r) => r.patientCalendarFeed));
  }

  /**
   * Manda (o rimanda) al paziente la mail col link.
   *
   * `email` serve solo per mandarlo a un indirizzo diverso da quello in
   * anagrafica; omesso, si usa quello del registry.
   */
  sendLink(patientId: string, email?: string): Observable<boolean> {
    return this.mutate<{ sendPatientCalendarFeedLink: boolean }>(
      SEND_PATIENT_CALENDAR_FEED_LINK,
      { patientId, email: email || null },
    ).pipe(map((r) => r.sendPatientCalendarFeedLink));
  }

  revoke(patientId: string): Observable<boolean> {
    return this.mutate<{ revokePatientCalendarFeed: boolean }>(
      REVOKE_PATIENT_CALENDAR_FEED,
      { patientId },
    ).pipe(map((r) => r.revokePatientCalendarFeed));
  }

  // ==================== AMMINISTRAZIONE ====================

  listAll(): Observable<PatientCalendarFeedRow[]> {
    return this.query<{ patientCalendarFeeds: PatientCalendarFeedRow[] }>(
      GET_PATIENT_CALENDAR_FEEDS,
      {},
      'no-cache',
    ).pipe(map((r) => r.patientCalendarFeeds ?? []));
  }

  /** Revoca ogni sottoscrizione attiva. Torna quante ne ha chiuse. */
  revokeAll(): Observable<number> {
    return this.mutate<{ revokeAllPatientCalendarFeeds: number }>(
      REVOKE_ALL_PATIENT_CALENDAR_FEEDS,
    ).pipe(map((r) => r.revokeAllPatientCalendarFeeds));
  }

  /** Revoca solo chi non ha più appuntamenti futuri: la pulizia periodica. */
  revokeStale(): Observable<number> {
    return this.mutate<{ revokeStalePatientCalendarFeeds: number }>(
      REVOKE_STALE_PATIENT_CALENDAR_FEEDS,
    ).pipe(map((r) => r.revokeStalePatientCalendarFeeds));
  }
}

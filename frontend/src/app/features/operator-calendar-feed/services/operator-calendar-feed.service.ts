/**
 * Operator Calendar Feed Service
 * Layer 3: business logic + GraphQL
 *
 * Estende BaseGraphQLService (NgZone): nessuna chiamata Apollo diretta.
 */

import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import { OperatorCalendarFeedStatus } from '../models/operator-calendar-feed.model';
import {
  GET_OPERATOR_CALENDAR_FEED,
  GENERATE_OPERATOR_CALENDAR_FEED,
  REVOKE_OPERATOR_CALENDAR_FEED,
  SET_OPERATOR_CALENDAR_FEED_PATIENT_NAME,
  SET_OPERATOR_CALENDAR_FEED_PATIENT_PHONE,
  SEND_OPERATOR_CALENDAR_FEED_LINK,
} from '../graphql/operator-calendar-feed.operations';

@Injectable({ providedIn: 'root' })
export class OperatorCalendarFeedService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getStatus(operatorId: string): Observable<OperatorCalendarFeedStatus> {
    return this.query<{ operatorCalendarFeed: OperatorCalendarFeedStatus }>(
      GET_OPERATOR_CALENDAR_FEED,
      { operatorId },
      'no-cache',
    ).pipe(map(r => r.operatorCalendarFeed));
  }

  /** Genera o rigenera il link. Rigenerare invalida il precedente. */
  generate(operatorId: string): Observable<OperatorCalendarFeedStatus> {
    return this.mutate<{ generateOperatorCalendarFeed: OperatorCalendarFeedStatus }>(
      GENERATE_OPERATOR_CALENDAR_FEED,
      { operatorId },
    ).pipe(map(r => r.generateOperatorCalendarFeed));
  }

  revoke(operatorId: string): Observable<OperatorCalendarFeedStatus> {
    return this.mutate<{ revokeOperatorCalendarFeed: OperatorCalendarFeedStatus }>(
      REVOKE_OPERATOR_CALENDAR_FEED,
      { operatorId },
    ).pipe(map(r => r.revokeOperatorCalendarFeed));
  }

  setShowPatientName(operatorId: string, show: boolean): Observable<OperatorCalendarFeedStatus> {
    return this.mutate<{ setOperatorCalendarFeedPatientName: OperatorCalendarFeedStatus }>(
      SET_OPERATOR_CALENDAR_FEED_PATIENT_NAME,
      { operatorId, show },
    ).pipe(map(r => r.setOperatorCalendarFeedPatientName));
  }

  /**
   * Manda all'operatore un link usa-e-getta per sottoscrivere l'agenda.
   * `channel`: 'whatsapp' | 'email'.
   */
  sendLink(operatorId: string, channel: 'whatsapp' | 'email', recipient: string): Observable<boolean> {
    return this.mutate<{ sendOperatorCalendarFeedLink: boolean }>(
      SEND_OPERATOR_CALENDAR_FEED_LINK, { operatorId, channel, recipient },
    ).pipe(map(r => r.sendOperatorCalendarFeedLink));
  }

  setShowPatientPhone(operatorId: string, show: boolean): Observable<OperatorCalendarFeedStatus> {
    return this.mutate<{ setOperatorCalendarFeedPatientPhone: OperatorCalendarFeedStatus }>(
      SET_OPERATOR_CALENDAR_FEED_PATIENT_PHONE,
      { operatorId, show },
    ).pipe(map(r => r.setOperatorCalendarFeedPatientPhone));
  }
}

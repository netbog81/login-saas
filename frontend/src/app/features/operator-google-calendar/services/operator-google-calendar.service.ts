/**
 * Operator Google Calendar Service
 * Layer 3: business logic + GraphQL (BaseGraphQLService, NgZone).
 */

import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import {
  OperatorGoogleCalendarStatus, CalendarSyncSettings, OperatorSyncSummary,
} from '../models/operator-google-calendar.model';
import {
  GET_OPERATOR_GOOGLE_CALENDAR,
  START_GOOGLE_CALENDAR_CONNECT,
  DISCONNECT_GOOGLE_CALENDAR,
  SET_OPERATOR_GOOGLE_EMAIL,
  RENAME_GOOGLE_CALENDAR,
  SYNC_GOOGLE_CALENDAR,
  SET_OPERATOR_GOOGLE_ALERT_CHANNEL,
  SEND_OPERATOR_GOOGLE_RENEW_LINK,
  GET_MY_GOOGLE_CALENDAR,
  START_MY_GOOGLE_CALENDAR_CONNECT,
  SET_MY_GOOGLE_ALERT_CHANNEL,
  SEND_MY_GOOGLE_RENEW_LINK,
  DISCONNECT_MY_GOOGLE_CALENDAR,
  GET_CALENDAR_SYNC_SETTINGS,
  UPDATE_CALENDAR_SYNC_SETTINGS,
  GET_OPERATORS_SYNC_SUMMARY,
} from '../graphql/operator-google-calendar.operations';

@Injectable({ providedIn: 'root' })
export class OperatorGoogleCalendarService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getStatus(operatorId: string): Observable<OperatorGoogleCalendarStatus> {
    return this.query<{ operatorGoogleCalendar: OperatorGoogleCalendarStatus }>(
      GET_OPERATOR_GOOGLE_CALENDAR, { operatorId }, 'no-cache',
    ).pipe(map(r => r.operatorGoogleCalendar));
  }

  /** Torna l'URL a cui mandare l'utente: la finestra la apre il container. */
  startConnect(operatorId: string, calendarName?: string): Observable<string> {
    return this.mutate<{ startOperatorGoogleCalendarConnect: string }>(
      START_GOOGLE_CALENDAR_CONNECT, { operatorId, calendarName: calendarName ?? null },
    ).pipe(map(r => r.startOperatorGoogleCalendarConnect));
  }

  disconnect(operatorId: string): Observable<OperatorGoogleCalendarStatus> {
    return this.mutate<{ disconnectOperatorGoogleCalendar: OperatorGoogleCalendarStatus }>(
      DISCONNECT_GOOGLE_CALENDAR, { operatorId },
    ).pipe(map(r => r.disconnectOperatorGoogleCalendar));
  }

  /** Rinomina il calendario già creato, su Google e da noi. */
  renameCalendar(operatorId: string, calendarName: string): Observable<OperatorGoogleCalendarStatus> {
    return this.mutate<{ renameOperatorGoogleCalendar: OperatorGoogleCalendarStatus }>(
      RENAME_GOOGLE_CALENDAR, { operatorId, calendarName },
    ).pipe(map(r => r.renameOperatorGoogleCalendar));
  }

  /** Riversa subito gli appuntamenti sul calendario, senza aspettare il giro automatico. */
  syncNow(operatorId: string): Observable<OperatorGoogleCalendarStatus> {
    return this.mutate<{ syncOperatorGoogleCalendar: OperatorGoogleCalendarStatus }>(
      SYNC_GOOGLE_CALENDAR, { operatorId },
    ).pipe(map(r => r.syncOperatorGoogleCalendar));
  }

  setDeclaredEmail(operatorId: string, email: string | null): Observable<OperatorGoogleCalendarStatus> {
    return this.mutate<{ setOperatorGoogleAccountEmail: OperatorGoogleCalendarStatus }>(
      SET_OPERATOR_GOOGLE_EMAIL, { operatorId, email },
    ).pipe(map(r => r.setOperatorGoogleAccountEmail));
  }

  /** Accende o spegne l'avviso di scadenza su un canale. */
  setAlertChannel(
    operatorId: string,
    channel: 'whatsapp' | 'email',
    enabled: boolean,
  ): Observable<OperatorGoogleCalendarStatus> {
    return this.mutate<{ setOperatorGoogleAlertChannel: OperatorGoogleCalendarStatus }>(
      SET_OPERATOR_GOOGLE_ALERT_CHANNEL,
      { operatorId, channel, enabled },
    ).pipe(map(r => r.setOperatorGoogleAlertChannel));
  }

  /** Manda subito il link di rinnovo, senza aspettare il controllo periodico. */
  sendRenewLink(
    operatorId: string,
    channel: 'whatsapp' | 'email',
    recipient: string,
  ): Observable<boolean> {
    return this.mutate<{ sendOperatorGoogleRenewLink: boolean }>(
      SEND_OPERATOR_GOOGLE_RENEW_LINK,
      { operatorId, channel, recipient },
    ).pipe(map(r => r.sendOperatorGoogleRenewLink));
  }

  // ── Il proprio collegamento (dashboard) ─────────────────────────────
  // Senza operatorId: la persona si ricava dal token. Servono perche' le
  // versioni "per operatorId" richiedono `operator_calendar_manage`, che un
  // operatore non ha — e il riquadro serve proprio a lui.

  getMyStatus(): Observable<OperatorGoogleCalendarStatus | null> {
    return this.query<{ myGoogleCalendar: OperatorGoogleCalendarStatus | null }>(
      GET_MY_GOOGLE_CALENDAR, {}, 'no-cache',
    ).pipe(map(r => r.myGoogleCalendar));
  }

  startMyConnect(): Observable<string> {
    return this.mutate<{ startMyGoogleCalendarConnect: string }>(
      START_MY_GOOGLE_CALENDAR_CONNECT, {},
    ).pipe(map(r => r.startMyGoogleCalendarConnect));
  }

  setMyAlertChannel(
    channel: 'whatsapp' | 'email',
    enabled: boolean,
  ): Observable<OperatorGoogleCalendarStatus> {
    return this.mutate<{ setMyGoogleAlertChannel: OperatorGoogleCalendarStatus }>(
      SET_MY_GOOGLE_ALERT_CHANNEL, { channel, enabled },
    ).pipe(map(r => r.setMyGoogleAlertChannel));
  }

  sendMyRenewLink(channel: 'whatsapp' | 'email'): Observable<boolean> {
    return this.mutate<{ sendMyGoogleRenewLink: boolean }>(
      SEND_MY_GOOGLE_RENEW_LINK, { channel },
    ).pipe(map(r => r.sendMyGoogleRenewLink));
  }

  disconnectMine(): Observable<OperatorGoogleCalendarStatus> {
    return this.mutate<{ disconnectMyGoogleCalendar: OperatorGoogleCalendarStatus }>(
      DISCONNECT_MY_GOOGLE_CALENDAR, {},
    ).pipe(map(r => r.disconnectMyGoogleCalendar));
  }

  // ── Impostazioni di sincronizzazione dello studio ───────────────────

  getSyncSettings(): Observable<CalendarSyncSettings> {
    return this.query<{ calendarSyncSettings: CalendarSyncSettings }>(
      GET_CALENDAR_SYNC_SETTINGS, {}, 'no-cache',
    ).pipe(map(r => r.calendarSyncSettings));
  }

  updateSyncSettings(input: {
    keepPastAppointments?: boolean;
    keepCalendarOnDisconnect?: boolean;
  }): Observable<CalendarSyncSettings> {
    return this.mutate<{ updateCalendarSyncSettings: CalendarSyncSettings }>(
      UPDATE_CALENDAR_SYNC_SETTINGS, input,
    ).pipe(map(r => r.updateCalendarSyncSettings));
  }

  /** Stato di tutti gli operatori in una chiamata sola, per l'elenco. */
  getSyncSummary(): Observable<OperatorSyncSummary[]> {
    return this.query<{ operatorsSyncSummary: OperatorSyncSummary[] }>(
      GET_OPERATORS_SYNC_SUMMARY, {}, 'no-cache',
    ).pipe(map(r => r.operatorsSyncSummary));
  }
}

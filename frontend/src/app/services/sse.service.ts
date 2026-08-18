import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { OAuthService } from 'angular-oauth2-oidc';
import { environment } from '../../environments/environment';
import { TenantResolverService } from '../core/auth/tenant-resolver.service';

/**
 * Tipi di evento supportati dal sistema SSE
 */
export type CalendarEventType =
  | 'appointment_status_changed'
  | 'appointment_changed'
  | 'treatment_created'
  | 'treatment_status_changed'
  | 'treatment_deleted'
  | 'task_message_changed'
  | 'availability_changed'
  | 'whatsapp_chat_changed'
  | 'stream_connected'
  | 'heartbeat';

/**
 * Interfaccia unificata per tutti gli eventi realtime.
 * `stream_connected` è sintetico lato client: viene emesso a ogni
 * (ri)connessione riuscita, così i consumer possono rifare il fetch dello
 * stato che potrebbero aver perso durante la disconnessione.
 */
export interface CalendarEvent {
  type: CalendarEventType;
  // Per eventi appuntamenti
  appointmentIds?: string[];
  // Per eventi trattamenti
  treatmentId?: string;
  operatorId?: string;
  // Per la chat WhatsApp: quale conversazione va rinfrescata
  conversationId?: string;
  // Comune
  newStatus?: string;
  timestamp: Date;
}

// Alias per retrocompatibilità
export type AppointmentEvent = CalendarEvent;

/** Backoff riconnessione: parte da 1s, raddoppia fino a 30s. */
const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
/**
 * Watchdog inattività: il backend manda un heartbeat ogni 30s; se non
 * arrivano byte per 90s (3 heartbeat persi) la connessione è considerata
 * morta e viene riaperta. Copre i casi in cui il socket muore senza
 * errore (sospensione del laptop, NAT/proxy che scarta il flusso).
 */
const IDLE_TIMEOUT_MS = 90_000;

/**
 * Service per la gestione di Server-Sent Events (SSE).
 *
 * Riscritto 2026-07-28: l'endpoint `/events/stream` ora è autenticato
 * (Bearer + X-Tenant-Alias, scoping per tenant/utente lato backend), e
 * l'EventSource nativo non può mandare header — quindi il client usa
 * fetch() in streaming, con riconnessione a backoff esponenziale, refresh
 * del token su 401 e watchdog sull'inattività.
 *
 * La connessione è UNICA e condivisa fra tutti i consumer (prima ogni
 * subscribe apriva un EventSource che sovrascriveva il precedente): parte
 * alla prima subscribe e resta viva per la vita dell'app.
 */
@Injectable({ providedIn: 'root' })
export class SseService {
  private readonly events$ = new Subject<CalendarEvent>();
  private started = false;
  private stopped = false;
  private abortController: AbortController | null = null;
  private reconnectDelayMs = RECONNECT_MIN_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private ngZone: NgZone,
    private oauthService: OAuthService,
    private tenantResolver: TenantResolverService,
  ) {}

  /**
   * Stream condiviso di tutti gli eventi realtime (heartbeat inclusi).
   * La connessione parte alla prima subscribe.
   */
  getEvents(): Observable<CalendarEvent> {
    this.ensureStarted();
    return this.events$.asObservable();
  }

  /**
   * Alias storico usato dai container calendario/trattamenti.
   * Stesso stream condiviso di getEvents().
   */
  getAppointmentEvents(): Observable<CalendarEvent> {
    return this.getEvents();
  }

  /**
   * Chiude definitivamente la connessione (es. logout).
   */
  disconnect(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearIdleTimer();
    this.abortController?.abort();
    this.abortController = null;
  }

  // ───────────────────────── Internals ─────────────────────────

  private ensureStarted(): void {
    if (this.started) return;
    this.started = true;
    this.stopped = false;
    // Il loop di lettura gira fuori da Angular per non innescare change
    // detection a ogni chunk; gli eventi rientrano in zona in deliver().
    this.ngZone.runOutsideAngular(() => void this.connect());
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;

    const token = this.oauthService.getAccessToken();
    if (!token) {
      // Pre-login o token perso: riprova senza contare come errore.
      this.scheduleReconnect();
      return;
    }

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    };
    const tenantAlias = this.tenantResolver.getTenantAlias();
    if (tenantAlias) {
      headers['X-Tenant-Alias'] = tenantAlias;
    }

    this.abortController = new AbortController();

    try {
      const response = await fetch(`${environment.apiUrl}/events/stream`, {
        headers,
        signal: this.abortController.signal,
        cache: 'no-store',
      });

      if (response.status === 401) {
        // Token scaduto: un solo tentativo di refresh, poi backoff.
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          this.reconnectDelayMs = RECONNECT_MIN_MS;
          void this.connect();
          return;
        }
        this.scheduleReconnect();
        return;
      }

      if (!response.ok || !response.body) {
        console.warn(`[SSE] Connessione rifiutata: HTTP ${response.status}`);
        this.scheduleReconnect();
        return;
      }

      // Connessione stabilita: reset backoff e segnala ai consumer di
      // rifare il fetch dello stato (eventi persi durante la disconnessione).
      this.reconnectDelayMs = RECONNECT_MIN_MS;
      this.deliver({ type: 'stream_connected', timestamp: new Date() });

      await this.readStream(response.body);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('[SSE] Errore di connessione:', err?.message ?? err);
      }
    } finally {
      this.clearIdleTimer();
    }

    // Stream terminato (chiusura server, rete, abort del watchdog): riconnetti.
    this.scheduleReconnect();
  }

  private async readStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    this.armIdleTimer();

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      this.armIdleTimer();

      buffer += decoder.decode(value, { stream: true });

      // I frame SSE sono separati da riga vuota ("\n\n").
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        this.handleFrame(frame);
      }
    }
  }

  private handleFrame(frame: string): void {
    const dataLines = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());
    if (dataLines.length === 0) return;

    try {
      const event = JSON.parse(dataLines.join('\n')) as CalendarEvent;
      this.deliver(event);
    } catch (e) {
      console.error('[SSE] Errore parsing evento:', e);
    }
  }

  private deliver(event: CalendarEvent): void {
    this.ngZone.run(() => this.events$.next(event));
  }

  private async tryRefreshToken(): Promise<boolean> {
    try {
      if (!this.oauthService.getRefreshToken()) return false;
      await this.oauthService.refreshToken();
      return true;
    } catch (e) {
      console.warn('[SSE] Refresh token fallito:', e);
      return false;
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, RECONNECT_MAX_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private armIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      console.warn(`[SSE] Nessun dato da ${IDLE_TIMEOUT_MS / 1000}s, riconnessione`);
      this.abortController?.abort();
    }, IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}

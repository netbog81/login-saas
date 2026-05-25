import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios, { AxiosError } from 'axios';

import { ClinicalEventsConfig } from './clinical-events.config';

/**
 * Stato di una singola coda DLQ rilevante.
 */
export interface DlqQueueStatus {
  /** Nome della coda (es. q.clinical.accounting-feedback.dlq). */
  name: string;
  /** Messaggi attualmente in coda (ready + unacked). */
  messageCount: number;
  /** True se la coda è raggiungibile e siamo riusciti a leggere il count. */
  reachable: boolean;
  /** Errore se reachable=false. */
  errorMessage?: string;
}

/**
 * Stato aggregato del sistema di messaggistica per il widget admin
 * "Sistema sano / N messaggi in DLQ".
 */
export interface DlqStatus {
  /** True se TUTTE le code DLQ sono vuote e raggiungibili. */
  healthy: boolean;
  /** Totale messaggi sommati su tutte le DLQ. */
  totalMessages: number;
  /** Stato per singola coda. */
  queues: DlqQueueStatus[];
  /** Quando questa snapshot è stata calcolata. */
  checkedAt: Date;
}

/**
 * Sessione 7 — Monitor DLQ accounting↔clinico via RabbitMQ Management API
 * (HTTP, NON AMQP). Funzionalità:
 *
 *  1. Cron @5min: GET dello stato delle DLQ rilevanti, log warning se
 *     ci sono messaggi (è un segnale forte di incident in corso).
 *  2. Endpoint GraphQL `dlqStatus`: ritorna lo snapshot per il widget
 *     admin in frontend ("Sistema sano / N messaggi pending").
 *
 * Code monitorate:
 *  - `q.clinical.accounting-feedback.dlq` — fallimenti consumer clinico
 *    su eventi accounting→clinico.
 *  - `q.accounting.clinical-events.dlq` — fallimenti consumer accounting
 *    su eventi clinico→accounting (è la coda che ha causato l'incident
 *    osservato 2026-05-25).
 *
 * NOTA SICUREZZA: l'endpoint GraphQL è esposto via resolver con permesso
 * dedicato (vedi `dlq-monitor.resolver.ts`). Le credenziali Management API
 * sono lette da .env (`RABBITMQ_MANAGEMENT_USER/PASS`) e MAI esposte al
 * frontend.
 */
@Injectable()
export class DlqMonitorService {
  private readonly logger = new Logger(DlqMonitorService.name);

  /** Liste delle code DLQ monitorate. Estendibile se aggiungiamo altre code. */
  private static readonly MONITORED_QUEUES: ReadonlyArray<string> = [
    'q.clinical.accounting-feedback.dlq',
    'q.accounting.clinical-events.dlq',
  ];

  constructor(private readonly config: ClinicalEventsConfig) {}

  /**
   * Endpoint GraphQL / health check: snapshot dello stato DLQ correnti.
   * Mai cachato — letto sempre live dal broker per essere veritiero.
   */
  async getStatus(): Promise<DlqStatus> {
    if (!this.config.enabled) {
      return {
        healthy: true,
        totalMessages: 0,
        queues: [],
        checkedAt: new Date(),
      };
    }

    const results = await Promise.all(
      DlqMonitorService.MONITORED_QUEUES.map((q) => this.fetchQueueStatus(q)),
    );

    const totalMessages = results.reduce(
      (sum, r) => sum + (r.reachable ? r.messageCount : 0),
      0,
    );
    const allReachable = results.every((r) => r.reachable);

    return {
      // healthy: tutte le code raggiungibili E zero messaggi totali.
      // Se anche una è unreachable, healthy=false (segnale che qualcosa
      // non va: broker giù, credenziali sbagliate, vhost mancante).
      healthy: allReachable && totalMessages === 0,
      totalMessages,
      queues: results,
      checkedAt: new Date(),
    };
  }

  /**
   * Cron job @5min: logga warning se ci sono messaggi nelle DLQ.
   * Niente alert/notification: solo log strutturato, l'admin può vedere
   * il widget frontend per i dettagli operativi.
   */
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'dlqMonitor' })
  async monitorCron(): Promise<void> {
    if (!this.config.enabled) return;
    try {
      const status = await this.getStatus();
      if (!status.healthy) {
        const summary = status.queues
          .map((q) =>
            q.reachable
              ? `${q.name}=${q.messageCount}`
              : `${q.name}=UNREACHABLE(${q.errorMessage ?? '?'})`,
          )
          .join(', ');
        this.logger.warn(
          `[DLQ-MONITOR] Sistema non sano: total=${status.totalMessages}, ${summary}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `[DLQ-MONITOR] Errore lettura stato DLQ: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Recupera lo stato di UNA coda via GET /api/queues/{vhost}/{name}.
   * Ritorna oggetto con messageCount o errore di raggiungibilità.
   */
  private async fetchQueueStatus(name: string): Promise<DlqQueueStatus> {
    const url =
      `${this.config.managementUrl.replace(/\/$/, '')}/api/queues/` +
      `${encodeURIComponent(this.config.managementVhost)}/${encodeURIComponent(name)}`;

    try {
      const response = await axios.get(url, {
        auth: { username: this.config.managementUser, password: this.config.managementPass },
        timeout: 5000,
        validateStatus: () => true, // gestiamo manualmente sotto.
      });

      if (response.status === 200 && response.data) {
        const messages =
          typeof response.data.messages === 'number'
            ? response.data.messages
            : (response.data.messages_ready ?? 0) + (response.data.messages_unacknowledged ?? 0);
        return { name, messageCount: messages, reachable: true };
      }

      if (response.status === 404) {
        // Coda non esistente: la consideriamo "ok" (count 0) — può capitare
        // su clinico subito dopo deploy se la DLQ controparte (accounting)
        // non è ancora stata creata. Niente warn.
        return { name, messageCount: 0, reachable: true };
      }

      return {
        name,
        messageCount: 0,
        reachable: false,
        errorMessage: `HTTP ${response.status}: ${JSON.stringify(response.data)?.slice(0, 100)}`,
      };
    } catch (err) {
      const axErr = err as AxiosError;
      return {
        name,
        messageCount: 0,
        reachable: false,
        errorMessage: axErr.code ?? axErr.message,
      };
    }
  }
}

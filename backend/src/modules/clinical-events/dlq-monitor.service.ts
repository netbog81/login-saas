import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios, { AxiosError } from 'axios';

import { TenantDataSourceManager } from '@curandis/tenant-datasource';

import { ClinicalEventsConfig } from './clinical-events.config';
import { EventOutboxService } from './event-outbox.service';

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
 *  - `q.accounting.dlq.subjects` — fallimenti consumer accounting sugli
 *    eventi del registry.
 *  - `q.{clinical,accounting,registry}.unrouted` — eventi che il broker non
 *    ha saputo instradare, raccolti dalle policy alternate-exchange invece
 *    di essere scartati (2026-09-02).
 *
 * Perché il monitor sta QUI e non in ognuno dei moduli: usa la Management
 * API con `curandis-monitor-svc` (tag `monitoring`), che vede tutte le code
 * a prescindere dai permessi AMQP. I service account dei singoli moduli
 * possono ispezionare via AMQP solo il proprio prefisso, quindi un monitor
 * per modulo vedrebbe metà del problema.
 *
 * NOTA SICUREZZA: l'endpoint GraphQL è esposto via resolver con permesso
 * dedicato (vedi `dlq-monitor.resolver.ts`). Le credenziali Management API
 * sono lette da .env (`RABBITMQ_MANAGEMENT_USER/PASS`) e MAI esposte al
 * frontend.
 */
@Injectable()
export class DlqMonitorService {
  private readonly logger = new Logger(DlqMonitorService.name);

  /** Liste delle code monitorate. Estendibile se aggiungiamo altre code. */
  private static readonly MONITORED_QUEUES: ReadonlyArray<string> = [
    'q.clinical.accounting-feedback.dlq',
    'q.accounting.clinical-events.dlq',
    // 2026-09-02 — Mancava: fallimenti del consumer accounting sugli eventi
    // del registry. Al primo controllo aveva un messaggio fermo da tempo
    // imprecisato, che nessuno aveva mai visto.
    'q.accounting.dlq.subjects',
    // 2026-09-02 — Code "non instradato", alimentate dalle policy
    // alternate-exchange (`ae-clinical`, `ae-accounting`, `ae-registry`).
    // Raccolgono gli eventi pubblicati con una routing key che nessun
    // binding lega: prima venivano scartati dal broker in silenzio, con un
    // "Publish OK" nei log del produttore. Il caso tipico è il produttore
    // deployato prima del consumatore, o un evento nuovo di cui ci si
    // dimentica il binding. Qui i messaggi si CONSERVANO: vanno rigiocati
    // sull'exchange una volta creato il binding, non svuotati.
    'q.clinical.unrouted',
    'q.accounting.unrouted',
    'q.registry.unrouted',
    // 2026-09-02 — Parcheggi: qui finisce ciò che il recupero automatico ha
    // provato a rigiocare per un'ora senza riuscirci. Un messaggio qui NON
    // si sblocca da solo: è il segnale che serve una persona.
    'q.clinical.stuck',
    'q.accounting.stuck',
  ];

  constructor(
    private readonly config: ClinicalEventsConfig,
    private readonly outbox: EventOutboxService,
    private readonly tenantDsManager: TenantDataSourceManager,
  ) {}

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

    // L'outbox non è una coda del broker ma risponde alla stessa domanda —
    // "c'è qualcosa fermo?" — quindi entra nello stesso elenco come voce
    // sintetica: nessun cambio di schema GraphQL, e il widget la mostra
    // insieme alle code.
    results.push(...(await this.outboxStatuses()));

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
   * Stato dell'outbox eventi, sommato su tutti i tenant noti:
   *  - "in ritardo": eventi che il broker non ha ancora accettato, ma che il
   *    worker sta ancora ritentando (si sbloccano da soli);
   *  - "richiede intervento": eventi che hanno esaurito i tentativi.
   */
  private async outboxStatuses(): Promise<DlqQueueStatus[]> {
    try {
      const aliases = await this.tenantDsManager.listKnownTenantAliases();
      let pending = 0;
      let failed = 0;
      for (const alias of aliases) {
        const counts = await this.outbox.countStuck(alias);
        pending += counts.pending;
        failed += counts.failed;
      }
      return [
        { name: 'outbox eventi · in ritardo (ritenta da solo)', messageCount: pending, reachable: true },
        { name: 'outbox eventi · richiede intervento', messageCount: failed, reachable: true },
      ];
    } catch (err) {
      return [
        {
          name: 'outbox eventi',
          messageCount: 0,
          reachable: false,
          errorMessage: (err as Error).message,
        },
      ];
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

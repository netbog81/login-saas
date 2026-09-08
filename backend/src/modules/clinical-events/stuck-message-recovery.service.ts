import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as amqp from 'amqplib';
import { ClinicalEventsConfig } from './clinical-events.config';

/** Header con cui teniamo il conto dei tentativi di recupero. */
const ATTEMPTS_HEADER = 'x-replay-attempts';
/** Oltre questa soglia il messaggio smette di girare e va in parcheggio. */
const MAX_ATTEMPTS = 12;
/** Quanti messaggi per coda per giro. */
const BATCH_SIZE = 100;

const PARKING_QUEUE = 'q.clinical.stuck';
const REPLAY_EXCHANGE = 'ex.clinical.replay';
const FEEDBACK_QUEUE = 'q.clinical.accounting-feedback';

interface WatchedQueue {
  queue: string;
  target: { kind: 'origin' } | { kind: 'replay'; routingKey: string };
  hint: string;
}

/**
 * Recupero automatico dei messaggi bloccati (gemello di quello in
 * accounting: ogni modulo recupera le PROPRIE code, perché i permessi del
 * broker sono per prefisso e nessuno può rigiocare quelle dell'altro).
 *
 * Chiude il cerchio lasciato aperto dagli alternate exchange: trattenere un
 * messaggio non instradato serve solo se poi qualcuno lo rigioca, e finché
 * quel qualcuno era "un umano che si ricorda", la protezione era teorica.
 *
 *  - `q.clinical.unrouted` → rispediti su `ex.clinical.events`. Se nel
 *    frattempo il binding è comparso (consumer deployato dopo il
 *    produttore) arrivano a destinazione da soli; altrimenti tornano qui e
 *    si riprova più tardi.
 *  - `q.clinical.accounting-feedback.dlq` → rimessi nella coda del consumer.
 *    I fallimenti transitori si risolvono da sé.
 *
 * Dopo `MAX_ATTEMPTS` giri (≈1 ora) il messaggio va in `q.clinical.stuck`,
 * dove resta finché una persona non decide: è ciò che il monitor segnala
 * come "richiede intervento". Il parcheggio serve a non far girare
 * all'infinito un messaggio avvelenato.
 */
@Injectable()
export class StuckMessageRecoveryService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(StuckMessageRecoveryService.name);
  private connection?: amqp.ChannelModel;

  private static readonly WATCHED: ReadonlyArray<WatchedQueue> = [
    {
      queue: 'q.clinical.unrouted',
      target: { kind: 'origin' },
      hint: 'nessuna coda lega questa routing key: manca un binding lato consumer.',
    },
    {
      queue: 'q.clinical.accounting-feedback.dlq',
      target: { kind: 'replay', routingKey: 'replay.accounting-feedback' },
      hint: 'il consumer del feedback accounting continua a fallire su questo messaggio.',
    },
  ];

  constructor(private readonly config: ClinicalEventsConfig) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.enabled) return;
    try {
      await this.ensureTopology();
    } catch (err) {
      this.logger.warn(
        `Topologia di recupero non pronta: ${(err as Error).message}. Riprovo al primo giro.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try { await this.connection?.close(); } catch { /* noop */ }
  }

  /** Exchange di rigioco + parcheggio + binding. Idempotente. */
  private async ensureTopology(): Promise<void> {
    const conn = await this.getConnection();
    const ch = await conn.createChannel();
    await ch.assertExchange(REPLAY_EXCHANGE, 'topic', { durable: true });
    await ch.assertQueue(PARKING_QUEUE, { durable: true });
    await ch.bindQueue(FEEDBACK_QUEUE, REPLAY_EXCHANGE, 'replay.accounting-feedback');
    await ch.close();
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'stuckMessageRecovery' })
  async recover(): Promise<void> {
    if (!this.config.enabled) return;

    for (const watched of StuckMessageRecoveryService.WATCHED) {
      try {
        await this.drainQueue(watched);
      } catch (err) {
        this.logger.warn(
          `Recupero di ${watched.queue} non riuscito: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Svuota una coda rigiocandone i messaggi. L'ACK arriva solo DOPO la
   * conferma del broker sulla ripubblicazione: se il publish fallisce, il
   * nack rimette il messaggio dov'era e ci si riprova al giro dopo.
   */
  private async drainQueue(watched: WatchedQueue): Promise<void> {
    const conn = await this.getConnection();
    const ch = await conn.createConfirmChannel();
    let replayed = 0;
    let parked = 0;

    try {
      for (let i = 0; i < BATCH_SIZE; i += 1) {
        const msg = await ch.get(watched.queue, { noAck: false });
        if (!msg) break;

        const attempts = Number(msg.properties.headers?.[ATTEMPTS_HEADER] ?? 0) + 1;
        const headers = { ...msg.properties.headers, [ATTEMPTS_HEADER]: attempts };
        const options: amqp.Options.Publish = {
          persistent: true,
          contentType: msg.properties.contentType ?? 'application/json',
          messageId: msg.properties.messageId,
          headers,
        };

        if (attempts > MAX_ATTEMPTS) {
          ch.publish('', PARKING_QUEUE, msg.content, {
            ...options,
            headers: {
              ...headers,
              'x-parked-from': watched.queue,
              'x-parked-at': new Date().toISOString(),
            },
          });
          await ch.waitForConfirms();
          ch.ack(msg);
          parked += 1;
          this.logger.error(
            `[STUCK] Messaggio da ${watched.queue} parcheggiato in ${PARKING_QUEUE} dopo `
              + `${attempts - 1} tentativi (messageId=${msg.properties.messageId ?? 'n/d'}): ${watched.hint}`,
          );
          continue;
        }

        const [exchange, routingKey] =
          watched.target.kind === 'origin'
            ? [this.config.clinicalExchange, msg.fields.routingKey]
            : [REPLAY_EXCHANGE, watched.target.routingKey];

        try {
          ch.publish(exchange, routingKey, msg.content, options);
          await ch.waitForConfirms();
          ch.ack(msg);
          replayed += 1;
        } catch (err) {
          ch.nack(msg, false, true);
          throw err;
        }
      }
    } finally {
      try { await ch.close(); } catch { /* noop */ }
    }

    if (replayed > 0 || parked > 0) {
      this.logger.log(
        `[STUCK] ${watched.queue}: ${replayed} rigiocati, ${parked} parcheggiati.`,
      );
    }
  }

  private async getConnection(): Promise<amqp.ChannelModel> {
    if (this.connection) return this.connection;
    this.connection = await amqp.connect(this.config.url);
    this.connection.on('close', () => { this.connection = undefined; });
    this.connection.on('error', () => { this.connection = undefined; });
    return this.connection;
  }
}

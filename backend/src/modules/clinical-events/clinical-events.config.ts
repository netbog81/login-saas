import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Config del publisher clinico (`ex.clinical.events`) e del consumer
 * accounting → clinico (`ex.accounting.events`).
 *
 * .env:
 *   RABBITMQ_URL=amqp://curandis-clinico-svc:clinico_dev_2024@localhost:5676/curandis
 *   RABBITMQ_MANAGEMENT_URL=http://localhost:15672    (HTTP API per DLQ monitor)
 *   RABBITMQ_MANAGEMENT_USER=admin                    (default: stesso user AMQP)
 *   RABBITMQ_MANAGEMENT_PASS=...                      (default: stesso pass AMQP)
 *   RABBITMQ_MANAGEMENT_VHOST=curandis                (default: stesso vhost AMQP)
 *   RABBITMQ_CLINICAL_EXCHANGE=ex.clinical.events
 *   RABBITMQ_ACCOUNTING_EXCHANGE=ex.accounting.events
 *   RABBITMQ_QUEUE_ACCOUNTING_FEEDBACK=q.clinical.accounting-feedback
 *   RABBITMQ_BINDING_PATTERN_BILLABLE=billable.*.*
 *   RABBITMQ_PREFETCH=10                          (ereditato da consumer registry)
 *   RABBITMQ_ENABLED=true                         (ereditato da consumer registry)
 *   PRODUCER_VERSION=1.0.0                        (override; default = package.json version)
 *
 * NOTA: condivide `RABBITMQ_URL` e `RABBITMQ_ENABLED` con il consumer
 * registry (RegistryEventsConfig). Sono variabili globali, non cambiamo
 * convenzione. `RABBITMQ_PREFETCH` è solo del consumer accounting (uguale).
 */
@Injectable()
export class ClinicalEventsConfig {
  private readonly logger = new Logger(ClinicalEventsConfig.name);

  readonly enabled: boolean;
  readonly url: string;
  readonly clinicalExchange: string;
  readonly accountingExchange: string;
  readonly accountingFeedbackQueue: string;
  readonly billableBindingPattern: string;
  readonly prefetch: number;
  readonly producerVersion: string;
  // Sessione 7 — RabbitMQ Management API (HTTP) per DLQ monitor.
  readonly managementUrl: string;
  readonly managementUser: string;
  readonly managementPass: string;
  readonly managementVhost: string;

  constructor(config: ConfigService) {
    this.enabled =
      (config.get<string>('RABBITMQ_ENABLED', 'true') ?? 'true').toLowerCase() !== 'false';
    this.url = config.get<string>(
      'RABBITMQ_URL',
      'amqp://curandis-clinico-svc:clinico_dev_2024@localhost:5676/curandis',
    );
    this.clinicalExchange = config.get<string>(
      'RABBITMQ_CLINICAL_EXCHANGE',
      'ex.clinical.events',
    );
    this.accountingExchange = config.get<string>(
      'RABBITMQ_ACCOUNTING_EXCHANGE',
      'ex.accounting.events',
    );
    this.accountingFeedbackQueue = config.get<string>(
      'RABBITMQ_QUEUE_ACCOUNTING_FEEDBACK',
      'q.clinical.accounting-feedback',
    );
    this.billableBindingPattern = config.get<string>(
      'RABBITMQ_BINDING_PATTERN_BILLABLE',
      'billable.*.*',
    );
    this.prefetch = parseInt(config.get<string>('RABBITMQ_PREFETCH', '10'), 10);

    // producerVersion: override esplicito via env, altrimenti versione del
    // backend clinico (importata via require dinamico per evitare problemi
    // bundling). Se entrambi mancano, fallback "0.0.0-dev".
    let pkgVersion = '0.0.0-dev';
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkg = require('../../../package.json') as { version?: string };
      if (pkg?.version) pkgVersion = pkg.version;
    } catch {
      // Ignoring: fallback to default
    }
    this.producerVersion = config.get<string>('PRODUCER_VERSION', pkgVersion);

    // Sessione 7 — Management API: deriva default da RABBITMQ_URL parsato.
    // CONVENZIONE PORTE: RabbitMQ Management è esposto sulla porta AMQP+10000
    // (es. AMQP 5672 → Mgmt 15672; AMQP 5676 → Mgmt 15676). Questo evita
    // hardcoding di 15672 che non funziona quando docker compose remappa
    // (vedi incident 2026-05-26: porta AMQP 5676, Management 15676).
    // .env può comunque overridare con RABBITMQ_MANAGEMENT_URL esplicito.
    const parsedAmqp = this.tryParseAmqpUrl(this.url);
    const defaultMgmtPort = parsedAmqp?.port ? parsedAmqp.port + 10000 : 15672;
    this.managementUrl = config.get<string>(
      'RABBITMQ_MANAGEMENT_URL',
      parsedAmqp
        ? `http://${parsedAmqp.host}:${defaultMgmtPort}`
        : 'http://localhost:15672',
    );
    this.managementUser = config.get<string>(
      'RABBITMQ_MANAGEMENT_USER',
      parsedAmqp?.user ?? 'guest',
    );
    this.managementPass = config.get<string>(
      'RABBITMQ_MANAGEMENT_PASS',
      parsedAmqp?.pass ?? 'guest',
    );
    this.managementVhost = config.get<string>(
      'RABBITMQ_MANAGEMENT_VHOST',
      parsedAmqp?.vhost ?? '/',
    );

    this.logger.log(
      `ClinicalEvents config: enabled=${this.enabled}, ` +
        `clinicalExchange="${this.clinicalExchange}", ` +
        `accountingExchange="${this.accountingExchange}", ` +
        `feedbackQueue="${this.accountingFeedbackQueue}", ` +
        `producerVersion="${this.producerVersion}", ` +
        `managementUrl="${this.managementUrl}"`,
    );
  }

  /** Parsa amqp://user:pass@host:port/vhost (ritorna null se malformato). */
  private tryParseAmqpUrl(
    url: string,
  ): {
    user: string;
    pass: string;
    host: string;
    port: number | null;
    vhost: string;
  } | null {
    try {
      const u = new URL(url);
      const vhost = u.pathname && u.pathname !== '/' ? u.pathname.slice(1) : '/';
      const port = u.port ? parseInt(u.port, 10) : null;
      return {
        user: decodeURIComponent(u.username),
        pass: decodeURIComponent(u.password),
        host: u.hostname,
        port: Number.isFinite(port) ? port : null,
        vhost: decodeURIComponent(vhost),
      };
    } catch {
      return null;
    }
  }
}

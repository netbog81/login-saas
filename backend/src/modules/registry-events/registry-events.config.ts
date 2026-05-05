import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Config del consumer RabbitMQ.
 *
 * .env:
 *   RABBITMQ_URL=amqp://curandis-clinico-svc:clinico_dev_2024@localhost:5676/curandis
 *   RABBITMQ_REGISTRY_EXCHANGE=ex.registry.events
 *   RABBITMQ_QUEUE_SUBJECTS=q.clinico.subjects
 *   RABBITMQ_BINDING_PATTERN=subject.*.*
 *   RABBITMQ_PREFETCH=10
 *   RABBITMQ_ENABLED=true   # se false, il consumer non parte (utile per test/CI)
 */
@Injectable()
export class RegistryEventsConfig {
  private readonly logger = new Logger(RegistryEventsConfig.name);
  readonly enabled: boolean;
  readonly url: string;
  readonly exchange: string;
  readonly queue: string;
  readonly bindingPattern: string;
  readonly prefetch: number;

  constructor(config: ConfigService) {
    this.enabled = (config.get<string>('RABBITMQ_ENABLED', 'true') ?? 'true').toLowerCase() !== 'false';
    this.url = config.get<string>(
      'RABBITMQ_URL',
      'amqp://curandis-clinico-svc:clinico_dev_2024@localhost:5676/curandis',
    );
    this.exchange = config.get<string>('RABBITMQ_REGISTRY_EXCHANGE', 'ex.registry.events');
    this.queue = config.get<string>('RABBITMQ_QUEUE_SUBJECTS', 'q.clinico.subjects');
    this.bindingPattern = config.get<string>('RABBITMQ_BINDING_PATTERN', 'subject.*.*');
    this.prefetch = parseInt(config.get<string>('RABBITMQ_PREFETCH', '10'), 10);
    this.logger.log(
      `RegistryEvents config: enabled=${this.enabled}, queue="${this.queue}", binding="${this.bindingPattern}", prefetch=${this.prefetch}`,
    );
  }
}

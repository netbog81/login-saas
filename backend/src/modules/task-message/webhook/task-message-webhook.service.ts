import { Injectable, Logger } from '@nestjs/common';
import { TaskMessage } from '../entities/task-message.entity';
import { TaskMessageWebhookEvent } from '../entities/task-message-webhook-event.entity';
import { TaskMessageStatus } from '../enums/task-message-status.enum';

import { TenantContextService } from '@curandis/tenant-datasource';
interface TaskMessageGatewayMetadata {
  source: string;
  event: string;
  message_id: string;
  correlation_id?: string;
  tenant_id: string;
  sender_user_id: string;
  recipient_user_id: string;
  content: string;
  status: string;
  available_from?: string;
  created_at?: string;
  timestamp: string;
}

@Injectable()
export class TaskMessageWebhookService {
  private readonly logger = new Logger(TaskMessageWebhookService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get taskMessageRepo() { return this.dataSource.getRepository(TaskMessage); }

  private get webhookEventRepo() { return this.dataSource.getRepository(TaskMessageWebhookEvent); }

  /**
   * Processes an incoming webhook event from the task-message gateway.
   * Saves raw event for audit, then updates/creates task_message record.
   */
  async processEvent(tenantId: string, rawPayload: any): Promise<void> {
    const metadata: TaskMessageGatewayMetadata = rawPayload?.gateway_metadata;
    if (!metadata) {
      this.logger.warn('[TASK-WEBHOOK] No gateway_metadata in payload, skipping');
      return;
    }

    const eventType = metadata.event || 'unknown';
    const correlationId = metadata.correlation_id;

    this.logger.log(
      `[TASK-WEBHOOK] RECEIVED tenantId=${tenantId} event=${eventType} messageId=${metadata.message_id} correlationId=${correlationId || 'none'}`,
    );

    // 1. Save raw event for audit
    const webhookEvent = this.webhookEventRepo.create({
      tenantId,
      correlationId,
      eventType,
      rawEvent: rawPayload,
      processed: false,
    });
    const savedEvent = await this.webhookEventRepo.save(webhookEvent);

    try {
      // 2. Route by event type
      switch (eventType) {
        case 'task_message.created':
          await this.handleCreated(tenantId, metadata);
          break;
        case 'task_message.updated':
          await this.handleUpdated(metadata);
          break;
        case 'task_message.available':
          await this.handleAvailable(metadata);
          break;
        case 'task_message.read':
          await this.handleRead(metadata);
          break;
        case 'task_message.completed':
          await this.handleCompleted(metadata);
          break;
        case 'task_message.deleted':
          await this.handleDeleted(metadata);
          break;
        default:
          this.logger.warn(`[TASK-WEBHOOK] Unknown event type: ${eventType}`);
      }

      // 3. Mark webhook event as processed
      savedEvent.processed = true;
      savedEvent.processedAt = new Date();
      await this.webhookEventRepo.save(savedEvent);
    } catch (error: any) {
      this.logger.error(`[TASK-WEBHOOK] Processing error for event ${eventType}: ${error?.message}`);
    }
  }

  private async handleCreated(tenantId: string, metadata: TaskMessageGatewayMetadata): Promise<void> {
    const existing = await this.taskMessageRepo.findOneBy({
      gatewayMessageId: metadata.message_id,
    });
    if (existing) {
      this.logger.warn(`[TASK-WEBHOOK] Message ${metadata.message_id} already exists, skipping creation`);
      return;
    }

    const status = this.mapStatus(metadata.status);
    const taskMessage = this.taskMessageRepo.create({
      gatewayMessageId: metadata.message_id,
      tenantId,
      senderUserId: metadata.sender_user_id,
      recipientUserId: metadata.recipient_user_id,
      content: metadata.content,
      status,
      availableFrom: metadata.available_from ? new Date(metadata.available_from) : undefined,
      correlationId: metadata.correlation_id,
    });

    await this.taskMessageRepo.save(taskMessage);
    this.logger.log(`[TASK-WEBHOOK] Created task_message id=${taskMessage.id} gateway_id=${metadata.message_id} status=${status}`);
  }

  private async handleUpdated(metadata: TaskMessageGatewayMetadata): Promise<void> {
    const msg = await this.findByGatewayId(metadata.message_id);
    if (!msg) return;

    if (metadata.content) msg.content = metadata.content;
    if (metadata.available_from) msg.availableFrom = new Date(metadata.available_from);

    await this.taskMessageRepo.save(msg);
    this.logger.log(`[TASK-WEBHOOK] Updated task_message gateway_id=${metadata.message_id}`);
  }

  private async handleAvailable(metadata: TaskMessageGatewayMetadata): Promise<void> {
    const msg = await this.findByGatewayId(metadata.message_id);
    if (!msg) return;

    msg.status = TaskMessageStatus.AVAILABLE;
    await this.taskMessageRepo.save(msg);
    this.logger.log(`[TASK-WEBHOOK] Message ${metadata.message_id} now AVAILABLE`);
  }

  private async handleRead(metadata: TaskMessageGatewayMetadata): Promise<void> {
    const msg = await this.findByGatewayId(metadata.message_id);
    if (!msg) return;

    msg.status = TaskMessageStatus.READ;
    msg.readAt = new Date();
    await this.taskMessageRepo.save(msg);
    this.logger.log(`[TASK-WEBHOOK] Message ${metadata.message_id} now READ`);
  }

  private async handleCompleted(metadata: TaskMessageGatewayMetadata): Promise<void> {
    const msg = await this.findByGatewayId(metadata.message_id);
    if (!msg) return;

    msg.status = TaskMessageStatus.COMPLETED;
    msg.completedAt = new Date();
    await this.taskMessageRepo.save(msg);
    this.logger.log(`[TASK-WEBHOOK] Message ${metadata.message_id} now COMPLETED`);
  }

  private async handleDeleted(metadata: TaskMessageGatewayMetadata): Promise<void> {
    const msg = await this.findByGatewayId(metadata.message_id);
    if (!msg) return;

    msg.status = TaskMessageStatus.DELETED;
    msg.deletedAt = new Date();
    await this.taskMessageRepo.save(msg);
    this.logger.log(`[TASK-WEBHOOK] Message ${metadata.message_id} now DELETED`);
  }

  private async findByGatewayId(gatewayMessageId: string): Promise<TaskMessage | null> {
    const msg = await this.taskMessageRepo.findOneBy({ gatewayMessageId });
    if (!msg) {
      this.logger.warn(`[TASK-WEBHOOK] No task_message found for gateway_id=${gatewayMessageId}`);
    }
    return msg;
  }

  private mapStatus(status: string): TaskMessageStatus {
    const upper = status?.toUpperCase();
    if (Object.values(TaskMessageStatus).includes(upper as TaskMessageStatus)) {
      return upper as TaskMessageStatus;
    }
    return TaskMessageStatus.SCHEDULED;
  }
}

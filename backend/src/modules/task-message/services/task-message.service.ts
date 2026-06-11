import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { In, Not } from 'typeorm';
import { TaskMessage } from '../entities/task-message.entity';
import { TaskMessageStatus } from '../enums/task-message-status.enum';
import { TaskMessageGatewayService } from './task-message-gateway.service';
import { CreateTaskMessageInput } from '../dto/create-task-message.input';
import { UpdateTaskMessageInput } from '../dto/update-task-message.input';
import { TaskMessageResult } from '../dto/task-message-result.type';
import { TaskMessagePage } from '../dto/task-message-page.type';
import { AppUser } from '../../users/entities/app-user.entity';

import { TenantContextService } from '@curandis/tenant-datasource';
@Injectable()
export class TaskMessageService {
  private readonly logger = new Logger(TaskMessageService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly gatewayService: TaskMessageGatewayService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get taskMessageRepo() { return this.dataSource.getRepository(TaskMessage); }

  private get appUserRepo() { return this.dataSource.getRepository(AppUser); }

  // ─── Mutations (delegate to gateway) ────────────────────────────

  async create(
    tenantId: string,
    senderAppUserId: string,
    input: CreateTaskMessageInput,
  ): Promise<TaskMessageResult> {
    // Validate: no self-send
    if (senderAppUserId === input.recipientUserId) {
      throw new BadRequestException('Non puoi inviare un messaggio a te stesso');
    }

    // Validate: content not empty
    if (!input.content?.trim()) {
      throw new BadRequestException('Il contenuto del messaggio non può essere vuoto');
    }

    // Validate: recipient exists
    const recipient = await this.appUserRepo.findOneBy({ id: input.recipientUserId });
    if (!recipient) {
      throw new BadRequestException('Destinatario non trovato');
    }

    // Validate: availableFrom in the future
    if (input.availableFrom && new Date(input.availableFrom) <= new Date()) {
      throw new BadRequestException('La data di disponibilità deve essere nel futuro');
    }

    const result = await this.gatewayService.create(
      tenantId,
      senderAppUserId,
      input.recipientUserId,
      input.content.trim(),
      input.availableFrom ? new Date(input.availableFrom) : undefined,
    );

    return {
      messageId: result.messageId,
      status: result.status.toUpperCase() as TaskMessageStatus,
    };
  }

  async update(
    tenantId: string,
    senderAppUserId: string,
    gatewayMessageId: string,
    input: UpdateTaskMessageInput,
  ): Promise<boolean> {
    const msg = await this.findByGatewayIdOrFail(gatewayMessageId);

    if (msg.senderUserId !== senderAppUserId) {
      throw new ForbiddenException('Solo il mittente può modificare il messaggio');
    }

    if (msg.status !== TaskMessageStatus.SCHEDULED) {
      throw new BadRequestException('Solo i messaggi schedulati possono essere modificati');
    }

    await this.gatewayService.update(
      tenantId,
      gatewayMessageId,
      senderAppUserId,
      input.content?.trim(),
      input.availableFrom ? new Date(input.availableFrom) : undefined,
    );

    return true;
  }

  async delete(
    tenantId: string,
    senderAppUserId: string,
    gatewayMessageId: string,
  ): Promise<boolean> {
    const msg = await this.findByGatewayIdOrFail(gatewayMessageId);

    if (msg.senderUserId !== senderAppUserId) {
      throw new ForbiddenException('Solo il mittente può cancellare il messaggio');
    }

    if (![TaskMessageStatus.SCHEDULED, TaskMessageStatus.AVAILABLE].includes(msg.status)) {
      throw new BadRequestException('Questo messaggio non può essere cancellato');
    }

    // Solo SCHEDULED passa dal gateway (rimozione job BullMQ)
    if (msg.status === TaskMessageStatus.SCHEDULED) {
      await this.gatewayService.delete(tenantId, gatewayMessageId, senderAppUserId);
    }

    // Aggiornamento diretto nel DB
    msg.status = TaskMessageStatus.DELETED;
    msg.deletedAt = new Date();
    await this.taskMessageRepo.save(msg);
    this.logger.log(`[TASK-MSG] delete gateway_id=${gatewayMessageId} (direct DB)`);

    return true;
  }

  async markAsRead(
    tenantId: string,
    recipientAppUserId: string,
    gatewayMessageId: string,
  ): Promise<boolean> {
    const msg = await this.findByGatewayIdOrFail(gatewayMessageId);

    if (msg.recipientUserId !== recipientAppUserId) {
      throw new ForbiddenException('Solo il destinatario può segnare come letto');
    }

    // Idempotente: se già READ o oltre, non fare nulla
    if (msg.status === TaskMessageStatus.READ || msg.status === TaskMessageStatus.COMPLETED) {
      return true;
    }

    if (msg.status !== TaskMessageStatus.AVAILABLE) {
      throw new BadRequestException('Messaggio non disponibile');
    }

    // Aggiornamento diretto nel DB — NESSUNA chiamata al gateway
    msg.status = TaskMessageStatus.READ;
    msg.readAt = new Date();
    await this.taskMessageRepo.save(msg);
    this.logger.log(`[TASK-MSG] markAsRead direct DB update gateway_id=${gatewayMessageId}`);

    return true;
  }

  async complete(
    tenantId: string,
    recipientAppUserId: string,
    gatewayMessageId: string,
  ): Promise<boolean> {
    const msg = await this.findByGatewayIdOrFail(gatewayMessageId);

    if (msg.recipientUserId !== recipientAppUserId) {
      throw new ForbiddenException('Solo il destinatario può completare il task');
    }

    // Idempotente: se già COMPLETED, non fare nulla
    if (msg.status === TaskMessageStatus.COMPLETED) {
      return true;
    }

    if (msg.status !== TaskMessageStatus.READ) {
      throw new BadRequestException('Il messaggio deve essere letto prima di essere completato');
    }

    // Aggiornamento diretto nel DB — NESSUNA chiamata al gateway
    msg.status = TaskMessageStatus.COMPLETED;
    msg.completedAt = new Date();
    await this.taskMessageRepo.save(msg);
    this.logger.log(`[TASK-MSG] complete direct DB update gateway_id=${gatewayMessageId}`);

    return true;
  }

  // ─── Queries (read from local DB) ──────────────────────────────

  async getInbox(
    recipientUserId: string,
    page: number,
    limit: number,
  ): Promise<TaskMessagePage> {
    const [items, total] = await this.taskMessageRepo.findAndCount({
      where: {
        recipientUserId,
        status: In([TaskMessageStatus.AVAILABLE, TaskMessageStatus.READ]),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total };
  }

  async getSent(
    senderUserId: string,
    page: number,
    limit: number,
  ): Promise<TaskMessagePage> {
    const [items, total] = await this.taskMessageRepo.findAndCount({
      where: {
        senderUserId,
        status: Not(In([TaskMessageStatus.DELETED, TaskMessageStatus.COMPLETED])),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total };
  }

  async getCompleted(
    userId: string,
    page: number,
    limit: number,
  ): Promise<TaskMessagePage> {
    const [items, total] = await this.taskMessageRepo
      .createQueryBuilder('tm')
      .where('tm.status = :status', { status: TaskMessageStatus.COMPLETED })
      .andWhere('(tm.sender_user_id = :userId OR tm.recipient_user_id = :userId)', { userId })
      .orderBy('tm.completed_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, total };
  }

  async getById(id: string): Promise<TaskMessage | null> {
    return this.taskMessageRepo.findOneBy({ id });
  }

  async countUnread(recipientUserId: string): Promise<number> {
    return this.taskMessageRepo.count({
      where: {
        recipientUserId,
        status: TaskMessageStatus.AVAILABLE,
      },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private async findByGatewayIdOrFail(gatewayMessageId: string): Promise<TaskMessage> {
    const msg = await this.taskMessageRepo.findOneBy({ gatewayMessageId });
    if (!msg) {
      throw new NotFoundException(`Messaggio non trovato: ${gatewayMessageId}`);
    }
    return msg;
  }
}

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
import { EventsService } from '../../events/events.service';
@Injectable()
export class TaskMessageService {
  private readonly logger = new Logger(TaskMessageService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly gatewayService: TaskMessageGatewayService,
    private readonly eventsService: EventsService,
  ){}

  /**
   * Campanello SSE per il tenant corrente: i client rifanno la query
   * dell'unread count / inbox. Nessun payload: il dato viaggia solo
   * sulla query autenticata di ciascun utente.
   */
  private notifyChanged(): void {
    this.eventsService.emit({ type: 'task_message_changed', timestamp: new Date() });
  }

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
    // Validate: esattamente uno tra destinatario singolo e gruppo
    if (!input.recipientUserId === !input.recipientGroup) {
      throw new BadRequestException('Specificare un destinatario oppure un gruppo');
    }

    // Validate: content not empty
    if (!input.content?.trim()) {
      throw new BadRequestException('Il contenuto del messaggio non può essere vuoto');
    }

    if (input.recipientUserId) {
      // Validate: no self-send
      if (senderAppUserId === input.recipientUserId) {
        throw new BadRequestException('Non puoi inviare un messaggio a te stesso');
      }

      // Validate: recipient exists
      const recipient = await this.appUserRepo.findOneBy({ id: input.recipientUserId });
      if (!recipient) {
        throw new BadRequestException('Destinatario non trovato');
      }
    } else {
      // Validate: il gruppo ha almeno un membro attivo oltre al mittente
      // (il mittente non vede i propri messaggi di gruppo in inbox)
      const members = await this.appUserRepo.count({
        where: {
          userType: input.recipientGroup as any,
          isActive: true,
          id: Not(senderAppUserId),
        },
      });
      if (members === 0) {
        throw new BadRequestException('Nessun utente attivo nel gruppo destinatario');
      }
    }

    // Validate: availableFrom in the future
    if (input.availableFrom && new Date(input.availableFrom) <= new Date()) {
      throw new BadRequestException('La data di disponibilità deve essere nel futuro');
    }

    const result = await this.gatewayService.create(
      tenantId,
      senderAppUserId,
      { userId: input.recipientUserId, group: input.recipientGroup },
      input.content.trim(),
      input.availableFrom ? new Date(input.availableFrom) : undefined,
    );

    const status = (result.status?.toUpperCase() as TaskMessageStatus) || TaskMessageStatus.SCHEDULED;

    // HARDENING: scrittura ottimistica locale. Il gateway ha già accettato
    // (risposta con messageId), quindi il messaggio ESISTE. Non aspettiamo il
    // webhook `task_message.created` per renderlo visibile: se quel webhook si
    // perde (gateway riavviato, delivery fallita, Redis giù dopo l'accept) il
    // messaggio comparirebbe comunque in "Inviati"/"Ricevuti". INSERT ... ON
    // CONFLICT DO NOTHING → idempotente rispetto al webhook, che resta la
    // fonte autoritativa e aggiornerà stato/campi via gateway_message_id.
    try {
      await this.taskMessageRepo
        .createQueryBuilder()
        .insert()
        .values({
          gatewayMessageId: result.messageId,
          tenantId,
          senderUserId: senderAppUserId,
          recipientUserId: input.recipientUserId ?? null,
          recipientGroup: input.recipientGroup ?? null,
          content: input.content.trim(),
          status,
          availableFrom: input.availableFrom ? new Date(input.availableFrom) : undefined,
        })
        .orIgnore()
        .execute();
    } catch (err: any) {
      // Non bloccare la mutation: il gateway ha già il messaggio e il webhook
      // lo riconcilierà. Logghiamo per visibilità.
      this.logger.error(`[TASK-MSG] optimistic local write failed gateway_id=${result.messageId}: ${err?.message}`);
    }

    this.notifyChanged();

    return {
      messageId: result.messageId,
      status,
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

    this.notifyChanged();

    return true;
  }

  async markAsRead(
    tenantId: string,
    recipientAppUserId: string,
    gatewayMessageId: string,
  ): Promise<boolean> {
    const msg = await this.findByGatewayIdOrFail(gatewayMessageId);

    await this.assertCanActAsRecipient(msg, recipientAppUserId, 'Solo il destinatario può segnare come letto');

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
    msg.readByUserId = recipientAppUserId;
    await this.taskMessageRepo.save(msg);
    this.logger.log(`[TASK-MSG] markAsRead direct DB update gateway_id=${gatewayMessageId}`);

    this.notifyChanged();

    return true;
  }

  async complete(
    tenantId: string,
    recipientAppUserId: string,
    gatewayMessageId: string,
  ): Promise<boolean> {
    const msg = await this.findByGatewayIdOrFail(gatewayMessageId);

    await this.assertCanActAsRecipient(msg, recipientAppUserId, 'Solo il destinatario può completare il task');

    if (msg.status === TaskMessageStatus.COMPLETED) {
      return this.handleAlreadyCompleted(msg, recipientAppUserId);
    }

    if (msg.status !== TaskMessageStatus.READ) {
      throw new BadRequestException('Il messaggio deve essere letto prima di essere completato');
    }

    // Aggiornamento diretto nel DB — NESSUNA chiamata al gateway.
    // UPDATE condizionato sullo stato: se due utenti del gruppo completano
    // in contemporanea, solo il primo vince (affected=1); l'altro riceve
    // l'esito "già completato".
    const updateResult = await this.taskMessageRepo
      .createQueryBuilder()
      .update()
      .set({
        status: TaskMessageStatus.COMPLETED,
        completedAt: new Date(),
        completedByUserId: recipientAppUserId,
      })
      .where('gateway_message_id = :gid AND status = :status', {
        gid: gatewayMessageId,
        status: TaskMessageStatus.READ,
      })
      .execute();

    if (!updateResult.affected) {
      const fresh = await this.findByGatewayIdOrFail(gatewayMessageId);
      if (fresh.status === TaskMessageStatus.COMPLETED) {
        return this.handleAlreadyCompleted(fresh, recipientAppUserId);
      }
      throw new BadRequestException('Il messaggio deve essere letto prima di essere completato');
    }

    this.logger.log(`[TASK-MSG] complete direct DB update gateway_id=${gatewayMessageId} by=${recipientAppUserId}`);

    this.notifyChanged();

    return true;
  }

  /**
   * Esito per un complete su messaggio già COMPLETED: idempotente se era
   * stato lo stesso utente, errore esplicito se un altro membro del gruppo
   * ha già eseguito il task (così chi arriva secondo lo sa e non lo rifà).
   */
  private handleAlreadyCompleted(msg: TaskMessage, userId: string): boolean {
    if (!msg.completedByUserId || msg.completedByUserId === userId) {
      return true;
    }
    throw new BadRequestException('Task già completato da un altro utente');
  }

  /**
   * Autorizzazione destinatario: per i messaggi singoli deve coincidere
   * l'utente; per i messaggi di gruppo basta essere un membro attivo del
   * gruppo (user_type corrispondente).
   */
  private async assertCanActAsRecipient(
    msg: TaskMessage,
    appUserId: string,
    errorMessage: string,
  ): Promise<void> {
    if (msg.recipientGroup) {
      const member = await this.appUserRepo.countBy({
        id: appUserId,
        userType: msg.recipientGroup as any,
        isActive: true,
      });
      if (!member) {
        throw new ForbiddenException(errorMessage);
      }
      return;
    }
    if (msg.recipientUserId !== appUserId) {
      throw new ForbiddenException(errorMessage);
    }
  }

  // ─── Queries (read from local DB) ──────────────────────────────

  async getInbox(
    user: { id: string; userType: string },
    page: number,
    limit: number,
  ): Promise<TaskMessagePage> {
    const [items, total] = await this.taskMessageRepo
      .createQueryBuilder('tm')
      .where('tm.status IN (:...statuses)', {
        statuses: [TaskMessageStatus.AVAILABLE, TaskMessageStatus.READ],
      })
      .andWhere(
        // Destinatario diretto, oppure messaggio al mio gruppo (esclusi
        // quelli inviati da me stesso al gruppo)
        '(tm.recipient_user_id = :userId OR (tm.recipient_group = :userGroup AND tm.sender_user_id != :userId))',
        { userId: user.id, userGroup: user.userType },
      )
      .orderBy('tm.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

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
    user: { id: string; userType: string },
    page: number,
    limit: number,
  ): Promise<TaskMessagePage> {
    const [items, total] = await this.taskMessageRepo
      .createQueryBuilder('tm')
      .where('tm.status = :status', { status: TaskMessageStatus.COMPLETED })
      .andWhere(
        // Mittente, destinatario diretto, oppure task del mio gruppo (tutte
        // le colleghe vedono che è stato eseguito e da chi)
        '(tm.sender_user_id = :userId OR tm.recipient_user_id = :userId OR tm.recipient_group = :userGroup)',
        { userId: user.id, userGroup: user.userType },
      )
      .orderBy('tm.completed_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, total };
  }

  async getById(id: string): Promise<TaskMessage | null> {
    return this.taskMessageRepo.findOneBy({ id });
  }

  async countUnread(user: { id: string; userType: string }): Promise<number> {
    return this.taskMessageRepo
      .createQueryBuilder('tm')
      .where('tm.status = :status', { status: TaskMessageStatus.AVAILABLE })
      .andWhere(
        '(tm.recipient_user_id = :userId OR (tm.recipient_group = :userGroup AND tm.sender_user_id != :userId))',
        { userId: user.id, userGroup: user.userType },
      )
      .getCount();
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

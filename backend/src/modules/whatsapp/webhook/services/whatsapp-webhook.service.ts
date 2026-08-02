import { Injectable, Logger } from '@nestjs/common';
import { WhatsappWebhookEvent } from '../entities/whatsapp-webhook-event.entity';
import { WhatsappLogService, UpdateLogExtras } from '../../log/services/whatsapp-log.service';
import { WhatsappMessageStatus, WhatsappMessageType } from '../../enums/whatsapp-enums';

import { TenantContextService } from '@curandis/tenant-datasource';
interface GatewayMetadata {
  messageType?: string;
  correlationId?: string;
  tenantId?: string;
  patientId?: string;
  appointmentIds?: string[];
  status?: string;
  timestamp?: string;
}

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly logService: WhatsappLogService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get webhookEventRepo() { return this.dataSource.getRepository(WhatsappWebhookEvent); }

  /**
   * Processes an incoming webhook event from the WhatsApp gateway.
   * Saves raw event, then updates message log if correlation found.
   */
  async processEvent(
    tenantId: string,
    rawPayload: any,
  ): Promise<void> {
    const eventType =
      rawPayload?.event || rawPayload?.type || 'unknown';
    const correlationId =
      rawPayload?.correlationId ||
      rawPayload?.data?.correlationId;

    this.logger.log(
      `[WA-WEBHOOK] RECEIVED tenantId=${tenantId} eventType=${eventType} correlationId=${correlationId || 'none'}`,
    );
    this.logger.log(`[WA-WEBHOOK] RAW PAYLOAD: ${JSON.stringify(rawPayload)}`);

    // 1. Save raw event for audit
    const event = this.webhookEventRepo.create({
      eventType,
      rawPayload,
      tenantId,
      correlationId,
      processed: false,
    });
    const savedEvent = await this.webhookEventRepo.save(event);
    this.logger.log(`[WA-WEBHOOK] Event saved id=${savedEvent.id}`);

    // 2. Try to update message log based on event type
    try {
      await this.updateLogFromEvent(correlationId, rawPayload);
      await this.webhookEventRepo.update(savedEvent.id, { processed: true });
      this.logger.log(`[WA-WEBHOOK] Event ${savedEvent.id} processed successfully`);
    } catch (error: any) {
      this.logger.error(
        `[WA-WEBHOOK] Error processing event ${savedEvent.id}: ${error?.message}`,
      );
    }
  }

  /**
   * Extracts Evolution API message ID from different payload formats:
   * - send.message / messages.upsert: data.key.id
   * - messages.update: data.keyId (Evolution API v2 format)
   */
  private extractEvolutionMessageId(payload: any): string | undefined {
    return payload?.data?.key?.id || payload?.data?.keyId;
  }

  /**
   * Extracts phone number from remoteJid in webhook payload.
   * "393922077179@s.whatsapp.net" → "393922077179"
   */
  private extractPhone(payload: any): string | undefined {
    const remoteJid = payload?.data?.key?.remoteJid || payload?.data?.remoteJid;
    if (!remoteJid) return undefined;
    return remoteJid.replace(/@s\.whatsapp\.net$/, '');
  }

  private mapGatewayMessageType(payload: any): WhatsappMessageType | undefined {
    const gwType = payload?.gateway_metadata?.message_type;
    switch (gwType) {
      case 'single_recap': return WhatsappMessageType.RECAP_SINGLE;
      case 'multiple_recap': return WhatsappMessageType.RECAP_MULTI;
      case 'reminder': return WhatsappMessageType.REMINDER_24H;
      case 'cancel_notification': return WhatsappMessageType.CANCELLATION;
      case 'update_notification': return WhatsappMessageType.UPDATE;
      default: return undefined;
    }
  }

  // ── Gateway metadata extraction ──

  private extractGatewayMetadata(payload: any): GatewayMetadata | null {
    const gm = payload?.gateway_metadata;
    if (!gm) return null;
    return {
      messageType: gm.message_type,
      correlationId: gm.correlation_id,
      tenantId: gm.tenant_id,
      patientId: gm.patient_id,
      appointmentIds: gm.appointment_ids,
      status: gm.status,
      timestamp: gm.timestamp,
    };
  }

  private mapGatewayStatus(gwStatus: string | undefined): WhatsappMessageStatus | undefined {
    switch (gwStatus) {
      case 'PENDING': return WhatsappMessageStatus.PENDING;
      case 'SENT': return WhatsappMessageStatus.SENT;
      case 'DELIVERED': return WhatsappMessageStatus.DELIVERED;
      case 'READ': return WhatsappMessageStatus.READ;
      case 'FAILED': return WhatsappMessageStatus.FAILED;
      case 'CANCELLED': return WhatsappMessageStatus.CANCELLED;
      default: return undefined;
    }
  }

  // ── Main dispatcher ──

  private async updateLogFromEvent(
    correlationId: string | undefined,
    payload: any,
  ): Promise<void> {
    const gm = this.extractGatewayMetadata(payload);

    if (gm) {
      await this.handleGatewayMetadataEvent(gm, payload);
      return;
    }

    // Legacy fallback for Evolution events without gateway_metadata
    await this.handleLegacyEvent(correlationId, payload);
  }

  // ── New gateway_metadata-based handling ──

  private async handleGatewayMetadataEvent(
    gm: GatewayMetadata,
    payload: any,
  ): Promise<void> {
    const gatewayMessageType = this.mapGatewayMessageType(payload);
    const newStatus = this.mapGatewayStatus(gm.status);
    const evolutionMessageId = this.extractEvolutionMessageId(payload);
    const messageBody = payload?.data?.message?.conversation
      || payload?.data?.message?.extendedTextMessage?.text;
    const phone = this.extractPhone(payload);

    this.logger.log(
      `[WA-WEBHOOK] gateway_metadata: type=${gm.messageType} status=${gm.status} ` +
      `correlationId=${gm.correlationId} appointmentIds=${JSON.stringify(gm.appointmentIds)}`,
    );

    if (!newStatus) {
      this.logger.warn(`[WA-WEBHOOK] Unknown gateway status: ${gm.status}`);
      return;
    }

    switch (gm.messageType) {
      case 'reminder': {
        // correlationId is the ORIGINAL one from main-app → update existing record
        const extras: UpdateLogExtras = { evolutionMessageId, messageBody };
        if (newStatus === WhatsappMessageStatus.SENT) extras.sentAt = new Date();
        if (newStatus === WhatsappMessageStatus.DELIVERED) extras.deliveredAt = new Date();
        if (newStatus === WhatsappMessageStatus.READ) extras.readAt = new Date();
        extras.messageType = WhatsappMessageType.REMINDER_24H;

        let updated = false;
        if (gm.correlationId) {
          const existing = await this.logService.findByCorrelationId(gm.correlationId);
          if (existing) {
            await this.logService.updateStatus(gm.correlationId, newStatus, extras);
            updated = true;
          }
        }

        // Fallback: find DISPATCHED/PENDING log by appointmentId
        if (!updated && gm.appointmentIds?.length) {
          for (const aptId of gm.appointmentIds) {
            const logs = await this.logService.findByAppointmentId(aptId);
            const dispatchLog = logs.find(
              l => (l.status === WhatsappMessageStatus.DISPATCHED || l.status === WhatsappMessageStatus.PENDING)
                && l.messageType !== WhatsappMessageType.CANCELLATION
                && l.messageType !== WhatsappMessageType.UPDATE,
            );
            if (dispatchLog) {
              await this.logService.updateStatus(dispatchLog.correlationId, newStatus, extras);
              this.logger.log(
                `[WA-WEBHOOK] reminder: matched by appointmentId=${aptId} → log=${dispatchLog.id}`,
              );
              updated = true;
              break;
            }
          }
        }

        if (!updated) {
          this.logger.warn(
            `[WA-WEBHOOK] reminder: no matching log found. correlationId=${gm.correlationId} appointmentIds=${JSON.stringify(gm.appointmentIds)}`,
          );
        }
        break;
      }

      case 'single_recap':
      case 'multiple_recap': {
        // correlationId is NEW (gateway-generated)
        if (!gm.correlationId) break;

        const existingLog = await this.logService.findByCorrelationId(gm.correlationId);

        if (existingLog) {
          // Update existing recap record (SENT → DELIVERED → READ)
          const extras: UpdateLogExtras = { evolutionMessageId, messageBody };
          if (newStatus === WhatsappMessageStatus.DELIVERED) extras.deliveredAt = new Date();
          if (newStatus === WhatsappMessageStatus.READ) extras.readAt = new Date();
          await this.logService.updateStatus(gm.correlationId, newStatus, extras);
        } else {
          // Create new recap record
          let patientName: string | undefined;
          let patientId: string | undefined = gm.patientId;
          if (gm.appointmentIds?.length) {
            const info = await this.logService.findPatientInfoByAppointmentId(gm.appointmentIds[0]);
            if (info) {
              patientName = info.patientName;
              if (!patientId) patientId = info.patientId;
            }
          }

          await this.logService.createLog({
            correlationId: gm.correlationId,
            appointmentIds: gm.appointmentIds,
            appointmentId: gm.appointmentIds?.[0],
            patientId,
            patientName,
            phoneNumber: phone || '',
            messageType: gatewayMessageType || WhatsappMessageType.RECAP_SINGLE,
            messageBody,
            status: newStatus,
          });
        }
        break;
      }

      case 'update_notification': {
        // Notifica di spostamento appuntamento: il log è già stato creato in
        // DISPATCHED da updateBooking, qui ne avanza solo lo stato.
        const extras: UpdateLogExtras = { evolutionMessageId, messageBody };
        if (newStatus === WhatsappMessageStatus.SENT) extras.sentAt = new Date();
        if (newStatus === WhatsappMessageStatus.DELIVERED) extras.deliveredAt = new Date();
        if (newStatus === WhatsappMessageStatus.READ) extras.readAt = new Date();
        extras.messageType = WhatsappMessageType.UPDATE;

        let updated = false;
        if (gm.correlationId) {
          const existing = await this.logService.findByCorrelationId(gm.correlationId);
          if (existing) {
            await this.logService.updateStatus(gm.correlationId, newStatus, extras);
            updated = true;
          }
        }

        // Fallback: cerca il log UPDATE dell'appuntamento
        if (!updated && gm.appointmentIds?.length) {
          for (const aptId of gm.appointmentIds) {
            const logs = await this.logService.findByAppointmentId(aptId);
            const updateLog = logs.find(
              l => l.messageType === WhatsappMessageType.UPDATE
                && l.status === WhatsappMessageStatus.DISPATCHED,
            );
            if (updateLog) {
              await this.logService.updateStatus(updateLog.correlationId, newStatus, extras);
              this.logger.log(
                `[WA-WEBHOOK] update_notification: matched by appointmentId=${aptId} → log=${updateLog.id}`,
              );
              updated = true;
              break;
            }
          }
        }

        if (!updated) {
          this.logger.warn(
            `[WA-WEBHOOK] update_notification: no matching log found. correlationId=${gm.correlationId} appointmentIds=${JSON.stringify(gm.appointmentIds)}`,
          );
        }
        break;
      }

      case 'cancel_notification': {
        if (newStatus === WhatsappMessageStatus.CANCELLED) {
          // sendCancelNotification=false → gateway cancelled the reminder
          // Update DISPATCHED/PENDING records to CANCELLED
          if (gm.appointmentIds?.length) {
            for (const aptId of gm.appointmentIds) {
              await this.logService.cancelByAppointmentId(aptId);
            }
          }
        } else {
          // sendCancelNotification=true → cancellation message was sent
          const extras: UpdateLogExtras = { evolutionMessageId, messageBody };
          if (newStatus === WhatsappMessageStatus.SENT) extras.sentAt = new Date();
          if (newStatus === WhatsappMessageStatus.DELIVERED) extras.deliveredAt = new Date();
          if (newStatus === WhatsappMessageStatus.READ) extras.readAt = new Date();

          // Try by correlationId first, then fallback to appointmentId
          let updated = false;
          if (gm.correlationId) {
            const existing = await this.logService.findByCorrelationId(gm.correlationId);
            if (existing) {
              await this.logService.updateStatus(gm.correlationId, newStatus, extras);
              updated = true;
            }
          }

          // Fallback: find CANCELLATION log by appointmentId
          if (!updated && gm.appointmentIds?.length) {
            for (const aptId of gm.appointmentIds) {
              const logs = await this.logService.findByAppointmentId(aptId);
              const cancelLog = logs.find(
                l => l.messageType === WhatsappMessageType.CANCELLATION
                  && l.status === WhatsappMessageStatus.DISPATCHED,
              );
              if (cancelLog) {
                await this.logService.updateStatus(cancelLog.correlationId, newStatus, extras);
                this.logger.log(
                  `[WA-WEBHOOK] cancel_notification: matched by appointmentId=${aptId} → log=${cancelLog.id}`,
                );
                updated = true;
                break;
              }
            }
          }

          if (!updated) {
            this.logger.warn(
              `[WA-WEBHOOK] cancel_notification: no matching log found. correlationId=${gm.correlationId} appointmentIds=${JSON.stringify(gm.appointmentIds)}`,
            );
          }
        }
        break;
      }

      default: {
        // gateway_metadata present but message_type is null/unknown
        // Try generic matching by correlationId or appointmentIds
        this.logger.log(
          `[WA-WEBHOOK] No specific message_type (${gm.messageType}), attempting generic match`,
        );

        let updated = false;

        // Try by correlationId
        if (gm.correlationId) {
          const existing = await this.logService.findByCorrelationId(gm.correlationId);
          if (existing) {
            const extras: UpdateLogExtras = { evolutionMessageId, messageBody };
            if (newStatus === WhatsappMessageStatus.SENT) extras.sentAt = new Date();
            if (newStatus === WhatsappMessageStatus.DELIVERED) extras.deliveredAt = new Date();
            if (newStatus === WhatsappMessageStatus.READ) extras.readAt = new Date();
            await this.logService.updateStatus(gm.correlationId, newStatus, extras);
            this.logger.log(
              `[WA-WEBHOOK] Generic match by correlationId=${gm.correlationId} → status=${newStatus}`,
            );
            updated = true;
          }
        }

        // Fallback by appointmentId
        if (!updated && gm.appointmentIds?.length) {
          for (const aptId of gm.appointmentIds) {
            const logs = await this.logService.findByAppointmentId(aptId);
            const matchLog = logs.find(
              l => l.status === WhatsappMessageStatus.DISPATCHED || l.status === WhatsappMessageStatus.PENDING,
            );
            if (matchLog) {
              const extras: UpdateLogExtras = { evolutionMessageId, messageBody };
              if (newStatus === WhatsappMessageStatus.SENT) extras.sentAt = new Date();
              if (newStatus === WhatsappMessageStatus.DELIVERED) extras.deliveredAt = new Date();
              if (newStatus === WhatsappMessageStatus.READ) extras.readAt = new Date();
              await this.logService.updateStatus(matchLog.correlationId, newStatus, extras);
              this.logger.log(
                `[WA-WEBHOOK] Generic match by appointmentId=${aptId} → log=${matchLog.id} status=${newStatus}`,
              );
              updated = true;
              break;
            }
          }
        }

        if (!updated) {
          this.logger.warn(
            `[WA-WEBHOOK] Unknown gateway message_type: ${gm.messageType}, no matching log found`,
          );
        }
      }
    }
  }

  // ── Legacy Evolution event handling (fallback) ──

  private async handleLegacyEvent(
    correlationId: string | undefined,
    payload: any,
  ): Promise<void> {
    const eventType = payload?.event || payload?.type;
    const evolutionMessageId = this.extractEvolutionMessageId(payload);
    const phone = this.extractPhone(payload);

    this.logger.log(
      `[WA-WEBHOOK] Legacy event: eventType=${eventType} correlationId=${correlationId} ` +
      `evolutionMessageId=${evolutionMessageId} phone=${phone}`,
    );

    switch (eventType) {
      case 'send.message': {
        const messageBody = payload?.data?.message?.conversation
          || payload?.data?.message?.extendedTextMessage?.text;

        if (correlationId) {
          await this.logService.updateStatus(
            correlationId,
            WhatsappMessageStatus.SENT,
            { sentAt: new Date(), evolutionMessageId, messageBody },
          );
        } else if (phone) {
          const updated = await this.logService.updatePendingByPhone(
            phone,
            WhatsappMessageStatus.SENT,
            { sentAt: new Date(), evolutionMessageId, messageBody },
          );
          if (!updated) {
            this.logger.warn(`[WA-WEBHOOK] No PENDING log found for phone=${phone}`);
          }
        }
        break;
      }

      case 'messages.upsert':
        if (payload?.data?.key?.fromMe) {
          if (correlationId) {
            await this.logService.updateStatus(
              correlationId,
              WhatsappMessageStatus.SENT,
              { sentAt: new Date(), evolutionMessageId },
            );
          } else if (evolutionMessageId) {
            await this.logService.updateStatusByEvolutionId(
              evolutionMessageId,
              WhatsappMessageStatus.SENT,
              { sentAt: new Date() },
            );
          }
        }
        break;

      case 'messages.update': {
        const status = payload?.data?.update?.status || payload?.data?.status;
        this.logger.log(`[WA-WEBHOOK] messages.update status="${status}" evolutionMessageId=${evolutionMessageId}`);

        const isServerAck = status === 'SERVER_ACK' || status === 2;
        const isDelivered = status === 'DELIVERY_ACK' || status === 3;
        const isRead = status === 'READ' || status === 4;

        if (isServerAck && evolutionMessageId) {
          await this.logService.updateStatusByEvolutionId(
            evolutionMessageId,
            WhatsappMessageStatus.SENT,
            { sentAt: new Date() },
          );
        } else if (isDelivered) {
          if (correlationId) {
            await this.logService.updateStatus(correlationId, WhatsappMessageStatus.DELIVERED, { deliveredAt: new Date() });
          } else if (evolutionMessageId) {
            await this.logService.updateStatusByEvolutionId(evolutionMessageId, WhatsappMessageStatus.DELIVERED, { deliveredAt: new Date() });
          }
        } else if (isRead) {
          if (correlationId) {
            await this.logService.updateStatus(correlationId, WhatsappMessageStatus.READ, { readAt: new Date() });
          } else if (evolutionMessageId) {
            await this.logService.updateStatusByEvolutionId(evolutionMessageId, WhatsappMessageStatus.READ, { readAt: new Date() });
          }
        } else {
          this.logger.debug(`[WA-WEBHOOK] Unhandled messages.update status: ${status}`);
        }
        break;
      }

      case 'connection.update':
        this.logger.log(
          `[WA-WEBHOOK] Connection update: ${JSON.stringify(payload?.data?.state || payload?.data)}`,
        );
        break;

      default:
        this.logger.debug(`[WA-WEBHOOK] Unhandled event type: ${eventType}`);
    }
  }
}

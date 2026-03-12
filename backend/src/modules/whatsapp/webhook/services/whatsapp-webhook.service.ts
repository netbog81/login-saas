import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappWebhookEvent } from '../entities/whatsapp-webhook-event.entity';
import { WhatsappLogService } from '../../log/services/whatsapp-log.service';
import { WhatsappMessageStatus, WhatsappMessageType } from '../../enums/whatsapp-enums';

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    @InjectRepository(WhatsappWebhookEvent)
    private readonly webhookEventRepo: Repository<WhatsappWebhookEvent>,
    private readonly logService: WhatsappLogService,
  ) {}

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
      default: return undefined;
    }
  }

  private async updateLogFromEvent(
    correlationId: string | undefined,
    payload: any,
  ): Promise<void> {
    const eventType = payload?.event || payload?.type;
    const evolutionMessageId = this.extractEvolutionMessageId(payload);
    const phone = this.extractPhone(payload);

    this.logger.log(
      `[WA-WEBHOOK] updateLogFromEvent: eventType=${eventType} correlationId=${correlationId} ` +
      `evolutionMessageId=${evolutionMessageId} phone=${phone}`,
    );

    switch (eventType) {
      case 'send.message': {
        // Evolution API confirms message was sent.
        // Gateway does NOT propagate correlationId, so we match by phone number
        // to find the most recent PENDING log and link it to the evolutionMessageId.
        // Also capture the actual message text sent by WhatsApp.
        const gatewayMessageType = this.mapGatewayMessageType(payload);
        if (gatewayMessageType) {
          this.logger.log(`[WA-WEBHOOK] gateway_metadata.message_type=${gatewayMessageType}`);
        }

        const messageBody = payload?.data?.message?.conversation
          || payload?.data?.message?.extendedTextMessage?.text;

        if (correlationId) {
          this.logger.log(`[WA-WEBHOOK] Updating to SENT via correlationId=${correlationId}`);
          await this.logService.updateStatus(
            correlationId,
            WhatsappMessageStatus.SENT,
            { sentAt: new Date(), evolutionMessageId, messageBody },
          );
        } else if (phone) {
          this.logger.log(`[WA-WEBHOOK] No correlationId, matching PENDING log by phone=${phone}`);
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
        // Message confirmed on WhatsApp (fromMe = true)
        if (payload?.data?.key?.fromMe) {
          if (correlationId) {
            await this.logService.updateStatus(
              correlationId,
              WhatsappMessageStatus.SENT,
              { sentAt: new Date(), evolutionMessageId },
            );
          } else if (evolutionMessageId) {
            // Try to update by evolutionMessageId (already linked from send.message)
            await this.logService.updateStatusByEvolutionId(
              evolutionMessageId,
              WhatsappMessageStatus.SENT,
              { sentAt: new Date() },
            );
          }
        }
        break;

      case 'messages.update': {
        // Delivery/read receipt from Evolution API.
        // Status can be string ("SERVER_ACK","DELIVERY_ACK","READ") or number (2,3,4)
        const status = payload?.data?.update?.status || payload?.data?.status;
        this.logger.log(`[WA-WEBHOOK] messages.update status="${status}" evolutionMessageId=${evolutionMessageId}`);

        const isServerAck = status === 'SERVER_ACK' || status === 2;
        const isDelivered = status === 'DELIVERY_ACK' || status === 3;
        const isRead = status === 'READ' || status === 4;

        if (isServerAck && evolutionMessageId) {
          // SERVER_ACK = message reached WhatsApp server → mark as SENT
          this.logger.log(`[WA-WEBHOOK] SERVER_ACK → SENT via evolutionMessageId=${evolutionMessageId}`);
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

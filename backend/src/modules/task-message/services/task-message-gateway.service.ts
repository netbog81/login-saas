import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { WhatsappConfigService } from '../../whatsapp/config/services/whatsapp-config.service';

interface GatewayCreateResponse {
  messageId: string;
  status: string;
}

interface GatewayUnreadResponse {
  count: number;
}

@Injectable()
export class TaskMessageGatewayService {
  private readonly logger = new Logger(TaskMessageGatewayService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: WhatsappConfigService,
  ) {}

  /**
   * Creates a task message via the gateway.
   * Returns { messageId, status } on success, throws on failure.
   */
  async create(
    tenantId: string,
    senderUserId: string,
    recipientUserId: string,
    content: string,
    availableFrom?: Date,
    correlationId?: string,
  ): Promise<GatewayCreateResponse> {
    const corrId = correlationId || uuidv4();
    this.logger.log(`[TASK-GW] CREATE sender=${senderUserId} recipient=${recipientUserId} correlationId=${corrId}`);

    const { url, headers } = await this.buildRequest(tenantId, corrId);

    const payload: Record<string, any> = {
      senderUserId,
      recipientUserId,
      content,
      correlationId: corrId,
    };
    if (availableFrom) {
      payload.availableFrom = availableFrom.toISOString();
    }

    const response = await firstValueFrom(
      this.httpService.post<GatewayCreateResponse>(`${url}/task-messages`, payload, {
        headers,
        timeout: 10000,
      }),
    );

    this.logger.log(`[TASK-GW] CREATE SUCCESS messageId=${response.data.messageId} status=${response.data.status}`);
    return response.data;
  }

  /**
   * Updates a scheduled task message (content and/or availableFrom).
   */
  async update(
    tenantId: string,
    messageId: string,
    senderUserId: string,
    content?: string,
    availableFrom?: Date,
  ): Promise<void> {
    this.logger.log(`[TASK-GW] UPDATE messageId=${messageId} sender=${senderUserId}`);

    const { url, headers } = await this.buildRequest(tenantId);

    const payload: Record<string, any> = {};
    if (content !== undefined) payload.content = content;
    if (availableFrom !== undefined) payload.availableFrom = availableFrom.toISOString();

    await firstValueFrom(
      this.httpService.patch(`${url}/task-messages/${messageId}?senderUserId=${senderUserId}`, payload, {
        headers,
        timeout: 10000,
      }),
    );

    this.logger.log(`[TASK-GW] UPDATE SUCCESS messageId=${messageId}`);
  }

  /**
   * Deletes a task message (only SCHEDULED or AVAILABLE, by sender).
   */
  async delete(
    tenantId: string,
    messageId: string,
    senderUserId: string,
  ): Promise<void> {
    this.logger.log(`[TASK-GW] DELETE messageId=${messageId} sender=${senderUserId}`);

    const { url, headers } = await this.buildRequest(tenantId);

    await firstValueFrom(
      this.httpService.delete(`${url}/task-messages/${messageId}?senderUserId=${senderUserId}`, {
        headers,
        timeout: 10000,
      }),
    );

    this.logger.log(`[TASK-GW] DELETE SUCCESS messageId=${messageId}`);
  }

  /**
   * Marks a task message as read (by recipient).
   */
  async markAsRead(
    tenantId: string,
    messageId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(`[TASK-GW] MARK_READ messageId=${messageId} userId=${userId}`);

    const { url, headers } = await this.buildRequest(tenantId);

    await firstValueFrom(
      this.httpService.post(`${url}/task-messages/${messageId}/read`, { userId }, {
        headers,
        timeout: 10000,
      }),
    );

    this.logger.log(`[TASK-GW] MARK_READ SUCCESS messageId=${messageId}`);
  }

  /**
   * Marks a task message as completed (by recipient).
   */
  async markAsCompleted(
    tenantId: string,
    messageId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(`[TASK-GW] MARK_COMPLETED messageId=${messageId} userId=${userId}`);

    const { url, headers } = await this.buildRequest(tenantId);

    await firstValueFrom(
      this.httpService.post(`${url}/task-messages/${messageId}/complete`, { userId }, {
        headers,
        timeout: 10000,
      }),
    );

    this.logger.log(`[TASK-GW] MARK_COMPLETED SUCCESS messageId=${messageId}`);
  }

  /**
   * Gets the count of unread (AVAILABLE) messages for a recipient.
   */
  async getUnreadCount(
    tenantId: string,
    recipientUserId: string,
  ): Promise<number> {
    try {
      const { url, headers } = await this.buildRequest(tenantId);

      const response = await firstValueFrom(
        this.httpService.get<GatewayUnreadResponse>(
          `${url}/task-messages/notifications/pending?recipientUserId=${recipientUserId}`,
          { headers, timeout: 10000 },
        ),
      );

      return response.data.count;
    } catch (error: any) {
      this.logger.error(`[TASK-GW] UNREAD_COUNT FAILED: ${error?.message}`);
      return 0;
    }
  }

  /**
   * Builds the base URL and common headers for gateway calls.
   */
  private async buildRequest(
    tenantId: string,
    correlationId?: string,
  ): Promise<{ url: string; headers: Record<string, string> }> {
    const config = await this.configService.getConfig();
    // I messaggi task sono una feature INTERNA tra operatori: dipendono solo
    // dalla presenza della config gateway + API key, NON dal flag `isActive`
    // (che governa l'invio WhatsApp ai pazienti). Disaccoppiamento voluto
    // (2026-07-08): così i task-message funzionano anche con WhatsApp OFF, e
    // attivare WhatsApp non è un prerequisito per la messaggistica interna.
    if (!config) {
      throw new Error('Gateway config non trovata: configura il gateway per abilitare i messaggi task');
    }

    const apiKey = await this.configService.getDecryptedApiKey();
    if (!apiKey) {
      throw new Error('Cannot decrypt gateway API key');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': config.tenantApiId,
      'x-tenant-api-key': apiKey,
    };

    if (correlationId) {
      headers['x-correlation-id'] = correlationId;
    }

    return { url: config.gatewayUrl, headers };
  }
}

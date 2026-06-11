import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Logger,
  RawBodyRequest,
  Req,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Request } from 'express';
import { randomUUID } from 'crypto';
import { createHmac, timingSafeEqual } from 'crypto';
import { WhatsappWebhookService } from './services/whatsapp-webhook.service';
import { WhatsappConfigService } from '../config/services/whatsapp-config.service';
import {
  TenantContextService,
  TenantDataSourceManager,
} from '@curandis/tenant-datasource';
import { TaskMessageWebhookService } from '../../task-message/webhook/task-message-webhook.service';

@Controller('api/webhooks')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly webhookService: WhatsappWebhookService,
    private readonly configService: WhatsappConfigService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantDsManager: TenantDataSourceManager,
    @Optional() @Inject(forwardRef(() => TaskMessageWebhookService))
    private readonly taskMessageWebhookService?: TaskMessageWebhookService,
  ) {}

  @Post('whatsapp')
  @HttpCode(200)
  async handleWebhook(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-webhook-signature') signature: string,
    @Body() body: any,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: boolean }> {
    try {
      this.logger.log(`[WA-WEBHOOK] Incoming webhook tenantId=${tenantId}`);

      // Validate HMAC signature
      if (signature) {
        const isValid = await this.validateSignature(
          signature,
          req.rawBody || Buffer.from(JSON.stringify(body)),
        );
        if (!isValid) {
          this.logger.warn(
            `[WA-WEBHOOK] Invalid signature from tenant: ${tenantId}`,
          );
          return { received: true };
        }
      }

      // Resolve tenant DataSource via @curandis/tenant-datasource.
      // Webhook esterni NON passano dal middleware (sono in exclude api/webhooks/*),
      // quindi qui dobbiamo costruire manualmente il contesto tenant.
      const tenantAlias = tenantId || 'unknown';

      // Determine which service should process this webhook
      const isTaskMessage = body?.gateway_metadata?.source === 'task-message-service';
      if (isTaskMessage) {
        this.logger.log(`[WA-WEBHOOK] Routing to TaskMessage webhook service`);
      }

      let ds: import('typeorm').DataSource;
      try {
        ds = await this.tenantDsManager.getDataSource(tenantAlias);
      } catch (err) {
        // Tenant non riconosciuto (es. istanza gateway esterna non onboardata,
        // webhook personali di test/debug). Niente DataSource = nessuna scrittura.
        // Log a debug e drop del payload, ma 200 al gateway per non far ritry.
        this.logger.debug(
          `[WA-WEBHOOK] Skip: tenant "${tenantAlias}" non onboarded (${(err as Error).message})`,
        );
        return { received: true };
      }

      this.logger.log(
        `[WA-WEBHOOK] Resolved tenant "${tenantAlias}" → db="${(ds.options as { database?: string }).database}"`,
      );

      // Run processing inside tenant context AsyncLocalStorage.
      this.tenantContext.run(
        {
          dataSource: ds,
          tenantAlias,
          dbName: (ds.options as { database?: string }).database || '',
          userId: 'webhook',
          requestId: randomUUID(),
        },
        () => {
          this.routeWebhook(isTaskMessage, tenantAlias, body);
        },
      );
    } catch (error: any) {
      this.logger.error(`[WA-WEBHOOK] Handler error: ${error?.message}`);
    }

    // Always respond 200 to prevent gateway retries
    return { received: true };
  }

  /**
   * Routes webhook to the correct service based on source.
   */
  private routeWebhook(isTaskMessage: boolean, tenantAlias: string, body: any): void {
    if (isTaskMessage && this.taskMessageWebhookService) {
      this.taskMessageWebhookService
        .processEvent(tenantAlias, body)
        .catch((err) => {
          this.logger.error(`[WA-WEBHOOK] TaskMessage processing error: ${err?.message}`);
        });
    } else {
      this.webhookService
        .processEvent(tenantAlias, body)
        .catch((err) => {
          this.logger.error(`[WA-WEBHOOK] Processing error: ${err?.message}`);
        });
    }
  }

  private async validateSignature(
    receivedSignature: string,
    body: Buffer,
  ): Promise<boolean> {
    try {
      const secret = await this.configService.getWebhookSecret();
      if (!secret) {
        // No secret configured, skip validation
        return true;
      }

      const expectedSig = receivedSignature.startsWith('sha256=')
        ? receivedSignature
        : `sha256=${receivedSignature}`;

      const computed = `sha256=${createHmac('sha256', secret)
        .update(body)
        .digest('hex')}`;

      const expectedBuffer = Buffer.from(expectedSig, 'utf8');
      const computedBuffer = Buffer.from(computed, 'utf8');

      if (expectedBuffer.length !== computedBuffer.length) {
        return false;
      }

      return timingSafeEqual(expectedBuffer, computedBuffer);
    } catch (error: any) {
      this.logger.error(`Signature validation error: ${error?.message}`);
      return false;
    }
  }
}

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
import { TenantSchemaContextService } from '../../../database/tenant-schema-context.service';
import { TenantOpenbaoResolverService } from '../../../database/tenant-openbao-resolver.service';
import { TaskMessageWebhookService } from '../../task-message/webhook/task-message-webhook.service';

@Controller('api/webhooks')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly webhookService: WhatsappWebhookService,
    private readonly configService: WhatsappConfigService,
    private readonly tenantSchemaContext: TenantSchemaContextService,
    private readonly tenantResolver: TenantOpenbaoResolverService,
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

      // Resolve tenant schema from OpenBao using x-tenant-id header
      const tenantAlias = tenantId || 'unknown';
      const tenantInfo = await this.tenantResolver.resolveTenant(tenantAlias);

      // Determine which service should process this webhook
      const isTaskMessage = body?.gateway_metadata?.source === 'task-message-service';
      if (isTaskMessage) {
        this.logger.log(`[WA-WEBHOOK] Routing to TaskMessage webhook service`);
      }

      if (!tenantInfo || !tenantInfo.schemaName || tenantInfo.schemaName === 'pending') {
        // Tenant non riconosciuto (es. istanza gateway esterna non mappata a un
        // tenant Curandis: webhook personali di test/debug, ecc.). Non blocca
        // ma non ha senso processarlo: niente schema valido = scrittura su
        // public che non vogliamo. Logghiamo a debug e droppiamo il payload.
        this.logger.debug(
          `[WA-WEBHOOK] Skip: instance "${tenantAlias}" non mappata a un tenant Curandis`,
        );
        return { received: true };
      } else {
        this.logger.log(
          `[WA-WEBHOOK] Resolved tenant "${tenantAlias}" → schema="${tenantInfo.schemaName}"`,
        );

        // Run processing inside tenant schema context so TypeORM uses correct search_path
        this.tenantSchemaContext.run(
          {
            schemaName: tenantInfo.schemaName,
            tenantId: tenantAlias,
            tenantAlias,
            userId: 'webhook',
            requestId: randomUUID(),
          },
          () => {
            this.routeWebhook(isTaskMessage, tenantAlias, body);
          },
        );
      }
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

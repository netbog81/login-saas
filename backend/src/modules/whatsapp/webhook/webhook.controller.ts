import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Logger,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { randomUUID } from 'crypto';
import { createHmac, timingSafeEqual } from 'crypto';
import { WhatsappWebhookService } from './services/whatsapp-webhook.service';
import { WhatsappConfigService } from '../config/services/whatsapp-config.service';
import { TenantSchemaContextService } from '../../../database/tenant-schema-context.service';
import { TenantOpenbaoResolverService } from '../../../database/tenant-openbao-resolver.service';

@Controller('api/webhooks')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly webhookService: WhatsappWebhookService,
    private readonly configService: WhatsappConfigService,
    private readonly tenantSchemaContext: TenantSchemaContextService,
    private readonly tenantResolver: TenantOpenbaoResolverService,
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

      if (!tenantInfo || !tenantInfo.schemaName || tenantInfo.schemaName === 'pending') {
        this.logger.warn(
          `[WA-WEBHOOK] Cannot resolve schema for tenant "${tenantAlias}". Processing on public schema.`,
        );
        // Fire-and-forget without tenant schema (will query public)
        this.webhookService
          .processEvent(tenantAlias, body)
          .catch((err) => {
            this.logger.error(`[WA-WEBHOOK] Processing error: ${err?.message}`);
          });
      } else {
        this.logger.log(
          `[WA-WEBHOOK] Resolved tenant "${tenantAlias}" → schema="${tenantInfo.schemaName}"`,
        );

        // Run processing inside tenant schema context so TypeORM uses correct search_path
        this.tenantSchemaContext.run(
          {
            schemaName: tenantInfo.schemaName,
            tenantId: tenantAlias,
            userId: 'webhook',
            requestId: randomUUID(),
          },
          () => {
            this.webhookService
              .processEvent(tenantAlias, body)
              .catch((err) => {
                this.logger.error(`[WA-WEBHOOK] Processing error: ${err?.message}`);
              });
          },
        );
      }
    } catch (error: any) {
      this.logger.error(`[WA-WEBHOOK] Handler error: ${error?.message}`);
    }

    // Always respond 200 to prevent gateway retries
    return { received: true };
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

import { Module, OnModuleInit, Logger, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

// Entities
import { WhatsappTenantConfig } from './config/entities/whatsapp-tenant-config.entity';
import { WhatsappMessageTemplate } from './template/entities/whatsapp-message-template.entity';
import { WhatsappMessageLog } from './log/entities/whatsapp-message-log.entity';
import { WhatsappWebhookEvent } from './webhook/entities/whatsapp-webhook-event.entity';

// Services
import { CryptoService } from './crypto/crypto.service';
import { WhatsappConfigService } from './config/services/whatsapp-config.service';
import { WhatsappTemplateService } from './template/services/whatsapp-template.service';
import { WhatsappLogService } from './log/services/whatsapp-log.service';
import { WhatsappWebhookService } from './webhook/services/whatsapp-webhook.service';
import { WhatsappGatewayService } from './gateway/whatsapp-gateway.service';

// Resolvers
import { WhatsappConfigResolver } from './config/resolvers/whatsapp-config.resolver';
import { WhatsappTemplateResolver } from './template/resolvers/whatsapp-template.resolver';
import { WhatsappLogResolver } from './log/resolvers/whatsapp-log.resolver';
import { WhatsappLogManagementResolver } from './log/resolvers/whatsapp-log-management.resolver';

// Controller
import { WhatsappWebhookController } from './webhook/webhook.controller';

// Availability module for circular dependency
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      WhatsappTenantConfig,
      WhatsappMessageTemplate,
      WhatsappMessageLog,
      WhatsappWebhookEvent,
    ]),
    forwardRef(() => AvailabilityModule),
  ],
  controllers: [WhatsappWebhookController],
  providers: [
    CryptoService,
    WhatsappConfigService,
    WhatsappTemplateService,
    WhatsappLogService,
    WhatsappWebhookService,
    WhatsappGatewayService,
    WhatsappConfigResolver,
    WhatsappTemplateResolver,
    WhatsappLogResolver,
    WhatsappLogManagementResolver,
  ],
  exports: [
    WhatsappGatewayService,
    WhatsappConfigService,
  ],
})
export class WhatsappModule implements OnModuleInit {
  private readonly logger = new Logger(WhatsappModule.name);

  constructor(private readonly templateService: WhatsappTemplateService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.templateService.initializeDefaults();
      this.logger.log('Default WhatsApp templates initialized');
    } catch (error: any) {
      this.logger.warn(`Could not initialize default templates: ${error?.message}`);
    }
  }
}

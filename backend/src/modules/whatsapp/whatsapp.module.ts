import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

// Entities
import { WhatsappTenantConfig } from './config/entities/whatsapp-tenant-config.entity';
import { WhatsappMessageTemplate } from './template/entities/whatsapp-message-template.entity';
import { WhatsappMessageLog } from './log/entities/whatsapp-message-log.entity';
import { WhatsappWebhookEvent } from './webhook/entities/whatsapp-webhook-event.entity';
import { WhatsappConversation } from './chat/entities/whatsapp-conversation.entity';
import { WhatsappChatMessage } from './chat/entities/whatsapp-chat-message.entity';

// Services
import { CryptoService } from './crypto/crypto.service';
import { WhatsappConfigService } from './config/services/whatsapp-config.service';
import { WhatsappTemplateService } from './template/services/whatsapp-template.service';
import { WhatsappLogService } from './log/services/whatsapp-log.service';
import { WhatsappWebhookService } from './webhook/services/whatsapp-webhook.service';
import { WhatsappGatewayService } from './gateway/whatsapp-gateway.service';
import { WhatsappScheduledService } from './scheduled/services/whatsapp-scheduled.service';
import { WhatsappChatService } from './chat/services/whatsapp-chat.service';
import { WhatsappUnreadSyncJob } from './chat/services/whatsapp-unread-sync.job';

// Resolvers
import { WhatsappConfigResolver } from './config/resolvers/whatsapp-config.resolver';
import { NotificationChannelService } from './notifications/services/notification-channel.service';
import { NotificationChannelResolver } from './notifications/resolvers/notification-channel.resolver';
import { WhatsappTemplateResolver } from './template/resolvers/whatsapp-template.resolver';
import { WhatsappLogResolver } from './log/resolvers/whatsapp-log.resolver';
import { WhatsappLogManagementResolver } from './log/resolvers/whatsapp-log-management.resolver';
import { WhatsappScheduledResolver } from './scheduled/resolvers/whatsapp-scheduled.resolver';
import { WhatsappChatResolver } from './chat/resolvers/whatsapp-chat.resolver';

// Controller
import { WhatsappWebhookController } from './webhook/webhook.controller';

// Availability module for circular dependency
import { AvailabilityModule } from '../availability/availability.module';
import { WhatsappDiagnosticsService } from './diagnostics/services/whatsapp-diagnostics.service';
import { WhatsappDiagnosticsResolver } from './diagnostics/resolvers/whatsapp-diagnostics.resolver';
// Task Message module for webhook routing
import { TaskMessageModule } from '../task-message/task-message.module';

@Module({
  imports: [
    HttpModule,
    forwardRef(() => AvailabilityModule),
    forwardRef(() => TaskMessageModule)],
  controllers: [WhatsappWebhookController],
  providers: [
    CryptoService,
    WhatsappConfigService,
    NotificationChannelService,
    WhatsappDiagnosticsService,
    WhatsappDiagnosticsResolver,
    WhatsappTemplateService,
    WhatsappLogService,
    WhatsappWebhookService,
    WhatsappGatewayService,
    WhatsappScheduledService,
    WhatsappChatService,
    WhatsappUnreadSyncJob,
    WhatsappConfigResolver,
    NotificationChannelResolver,
    WhatsappTemplateResolver,
    WhatsappLogResolver,
    WhatsappLogManagementResolver,
    WhatsappScheduledResolver,
    WhatsappChatResolver],
  exports: [
    WhatsappGatewayService,
    WhatsappConfigService,
    NotificationChannelService,
    WhatsappDiagnosticsService,
    WhatsappChatService,
    // Serve al calendario dei pazienti (modulo availability), che compone da
    // sé il testo dell'email con i template del tenant.
    WhatsappTemplateService],
})
export class WhatsappModule {
  // NOTA containerization-2026-06-11: rimosso `onModuleInit` che chiamava
  // `templateService.initializeDefaults()` al boot. In architettura
  // DB-per-tenant non c'è un AsyncLocalStorage context disponibile al boot.
  // I default Whatsapp vanno inizializzati per-tenant via TMS o lazy.
}

import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

// Entities
import { TaskMessage } from './entities/task-message.entity';
import { TaskMessageWebhookEvent } from './entities/task-message-webhook-event.entity';
import { AppUser } from '../users/entities/app-user.entity';

// Services
import { TaskMessageGatewayService } from './services/task-message-gateway.service';
import { TaskMessageService } from './services/task-message.service';
import { TaskMessageWebhookService } from './webhook/task-message-webhook.service';

// Resolver
import { TaskMessageResolver } from './resolvers/task-message.resolver';

// WhatsApp module for shared gateway config
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    HttpModule,
    forwardRef(() => WhatsappModule)],
  providers: [
    TaskMessageGatewayService,
    TaskMessageService,
    TaskMessageWebhookService,
    TaskMessageResolver],
  exports: [TaskMessageWebhookService],
})
export class TaskMessageModule {}

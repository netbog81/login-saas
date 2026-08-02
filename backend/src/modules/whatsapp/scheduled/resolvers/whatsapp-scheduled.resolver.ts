import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { WhatsappScheduledMessage } from '../dto/whatsapp-scheduled.dto';
import { WhatsappScheduledService } from '../services/whatsapp-scheduled.service';

@Resolver(() => WhatsappScheduledMessage)
export class WhatsappScheduledResolver {
  constructor(private readonly scheduledService: WhatsappScheduledService) {}

  @Query(() => [WhatsappScheduledMessage], { name: 'whatsappScheduledMessages' })
  async getScheduled(): Promise<WhatsappScheduledMessage[]> {
    return this.scheduledService.list();
  }

  @Mutation(() => Boolean, { name: 'cancelWhatsappScheduledMessage' })
  async cancelScheduled(@Args('jobId') jobId: string): Promise<boolean> {
    return this.scheduledService.cancel(jobId);
  }
}

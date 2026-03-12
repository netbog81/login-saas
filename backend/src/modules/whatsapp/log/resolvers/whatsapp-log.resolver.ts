import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { WhatsappMessageLog } from '../entities/whatsapp-message-log.entity';
import { WhatsappLogService } from '../services/whatsapp-log.service';
import {
  WhatsappLogFilterInput,
  WhatsappMessageLogPage,
} from '../dto/whatsapp-log-filter.input';

@Resolver(() => WhatsappMessageLog)
export class WhatsappLogResolver {
  constructor(private readonly logService: WhatsappLogService) {}

  @Query(() => WhatsappMessageLogPage, { name: 'whatsappMessageLogs' })
  async getMessageLogs(
    @Args('filters') filters: WhatsappLogFilterInput,
  ): Promise<WhatsappMessageLogPage> {
    return this.logService.findByFilters(filters);
  }

  @Query(() => WhatsappMessageLog, {
    name: 'whatsappMessageLog',
    nullable: true,
  })
  async getMessageLog(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WhatsappMessageLog | null> {
    return this.logService.findById(id);
  }

  @Query(() => [WhatsappMessageLog], {
    name: 'whatsappMessageLogsByAppointment',
  })
  async getMessageLogsByAppointment(
    @Args('appointmentId', { type: () => ID }) appointmentId: string,
  ): Promise<WhatsappMessageLog[]> {
    return this.logService.findByAppointmentId(appointmentId);
  }
}

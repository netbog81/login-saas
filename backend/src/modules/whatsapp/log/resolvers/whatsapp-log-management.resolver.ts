import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { WhatsappLogService } from '../services/whatsapp-log.service';
import { WhatsappConfigService } from '../../config/services/whatsapp-config.service';
import { WhatsappChatService } from '../../chat/services/whatsapp-chat.service';
import { WhatsappMessageLogPage } from '../dto/whatsapp-log-filter.input';
import {
  WhatsappRetentionStats,
  WhatsappBulkLogIdsInput,
  WhatsappLogManagementResult,
} from '../dto/whatsapp-log-management.dto';

@Resolver()
export class WhatsappLogManagementResolver {
  constructor(
    private readonly logService: WhatsappLogService,
    private readonly configService: WhatsappConfigService,
    private readonly chatService: WhatsappChatService,
  ) {}

  private async getRetentionDays(): Promise<number> {
    const config = await this.configService.getConfig();
    return config?.retentionDays ?? 730;
  }

  @Query(() => WhatsappRetentionStats, { name: 'whatsappRetentionStats' })
  async getRetentionStats(): Promise<WhatsappRetentionStats> {
    const retentionDays = await this.getRetentionDays();
    return this.logService.getRetentionStats(retentionDays);
  }

  @Query(() => WhatsappMessageLogPage, { name: 'whatsappExpiredLogs' })
  async getExpiredLogs(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 50 }) limit: number,
  ): Promise<WhatsappMessageLogPage> {
    const retentionDays = await this.getRetentionDays();
    return this.logService.findExpiredLogs(retentionDays, page, limit);
  }

  @Mutation(() => WhatsappLogManagementResult, { name: 'anonymizeWhatsappLogs' })
  async anonymizeLogs(
    @Args('input') input: WhatsappBulkLogIdsInput,
  ): Promise<WhatsappLogManagementResult> {
    const affectedCount = await this.logService.anonymizeLogs(input.logIds);
    return { success: true, affectedCount, message: `${affectedCount} log anonimizzati` };
  }

  @Mutation(() => WhatsappLogManagementResult, { name: 'anonymizeExpiredWhatsappLogs' })
  async anonymizeExpiredLogs(): Promise<WhatsappLogManagementResult> {
    const retentionDays = await this.getRetentionDays();
    const affectedCount = await this.logService.anonymizeExpiredLogs(retentionDays);
    // I messaggi di chat seguono la stessa retention dei log: sono anch'essi
    // testo scambiato col paziente, e lasciarli fuori significherebbe
    // conservarli per sempre.
    const chatCount = await this.chatService.anonymizeExpiredMessages(retentionDays);
    return {
      success: true,
      affectedCount: affectedCount + chatCount,
      message:
        `${affectedCount} log scaduti anonimizzati` +
        (chatCount > 0 ? `, ${chatCount} messaggi di chat anonimizzati` : ''),
    };
  }

  @Mutation(() => WhatsappLogManagementResult, { name: 'deleteWhatsappLogs' })
  async deleteLogs(
    @Args('input') input: WhatsappBulkLogIdsInput,
  ): Promise<WhatsappLogManagementResult> {
    const affectedCount = await this.logService.deleteLogs(input.logIds);
    return { success: true, affectedCount, message: `${affectedCount} log eliminati` };
  }

  @Mutation(() => WhatsappLogManagementResult, { name: 'deleteExpiredWhatsappLogs' })
  async deleteExpiredLogs(): Promise<WhatsappLogManagementResult> {
    const retentionDays = await this.getRetentionDays();
    const affectedCount = await this.logService.deleteExpiredLogs(retentionDays);
    return { success: true, affectedCount, message: `${affectedCount} log scaduti eliminati` };
  }
}

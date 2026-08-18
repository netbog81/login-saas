import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantContextService, TenantDataSourceManager } from '@curandis/tenant-datasource';
import { WhatsappChatService } from './whatsapp-chat.service';
import { WhatsappGatewayService } from '../../gateway/whatsapp-gateway.service';
import { WhatsappConfigService } from '../../config/services/whatsapp-config.service';

/**
 * Allinea i "non letti" dell'applicativo a quelli di WhatsApp.
 *
 * Quando la segreteria apre una conversazione da WhatsApp Web il contatore si
 * azzera su WhatsApp, ma nessun evento lo comunica: l'evento `chats.update` di
 * Evolution 2.3.7 trasporta solo `remoteJid` e `instanceId`, verificato sulla
 * coda reale. L'unica fonte del dato è `/chat/findChats`, che va interrogato.
 *
 * Per questo l'allineamento è periodico e non istantaneo come il resto della
 * chat: qui non c'è niente da spingere, c'è solo da andare a guardare.
 *
 * Il confronto parte dalle conversazioni che l'applicativo considera non lette,
 * non da tutte: sono poche, e il verso opposto (nuovi messaggi) è già coperto
 * dal webhook in tempo reale.
 */
@Injectable()
export class WhatsappUnreadSyncJob {
  private readonly logger = new Logger(WhatsappUnreadSyncJob.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantDsManager: TenantDataSourceManager,
    private readonly chatService: WhatsappChatService,
    private readonly gatewayService: WhatsappGatewayService,
    private readonly configService: WhatsappConfigService,
  ) {}

  // Ogni 2 minuti: è il compromesso fra il ritardo percepito in segreteria e il
  // peso dell'interrogazione, che su questa istanza scorre ~2000 chat.
  @Cron('0 */2 * * * *', { name: 'whatsappUnreadSync' })
  async handleSync(): Promise<void> {
    let aliases: string[];
    try {
      aliases = await this.tenantDsManager.listKnownTenantAliases();
    } catch (error) {
      this.logger.error('Allineamento non letti: impossibile elencare i tenant', error as Error);
      return;
    }

    for (const alias of aliases) {
      try {
        await this.processTenant(alias);
      } catch (error) {
        // Un tenant che fallisce non deve bloccare gli altri: il gateway può
        // essere irraggiungibile per uno solo (URL o chiave sbagliati).
        this.logger.error(
          `Allineamento non letti: errore sul tenant="${alias}"`,
          error as Error,
        );
      }
    }
  }

  private async processTenant(tenantAlias: string): Promise<void> {
    const ds = await this.tenantDsManager.getDataSource(tenantAlias);

    await this.tenantContext.run(
      { tenantAlias, dataSource: ds, dbName: ds.options.database as string },
      async () => {
        const config = await this.configService.getConfig();
        if (!config?.isActive) return;

        const unreadConversations = (
          await this.chatService.listConversations({ unreadOnly: true })
        ).filter((conversation) => conversation.unreadCount > 0);

        if (unreadConversations.length === 0) return;

        // L'ultimo messaggio in arrivo è la chiave con cui il gateway riconosce
        // la lettura nello storico di Evolution: senza, resterebbe solo il
        // contatore, che per molte chat è nullo e non dice niente.
        const latestInbound = await this.chatService.findLatestInboundMessageIds(
          unreadConversations.map((conversation) => conversation.id),
        );

        const states = await this.gatewayService.getChatReadStates(
          unreadConversations.map((conversation) => ({
            phone: conversation.phoneNumber,
            messageId: latestInbound.get(conversation.id),
          })),
        );

        let aligned = 0;

        for (const conversation of unreadConversations) {
          // Solo 'read' è una conferma. 'unknown' significa che WhatsApp non sa
          // dire: spegnere il pallino su quella base nasconderebbe messaggi mai
          // letti davvero.
          if (states[conversation.phoneNumber] !== 'read') continue;

          await this.chatService.markAsRead(conversation.id);
          aligned++;
        }

        if (aligned > 0) {
          this.logger.log(
            `[WA-CHAT] ${aligned} conversazioni segnate lette su ${tenantAlias}: lette da WhatsApp Web`,
          );
        }
      },
    );
  }
}

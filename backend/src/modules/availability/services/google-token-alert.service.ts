import { BadRequestException, Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { TenantContextService } from '@curandis/tenant-datasource';
import { Operator } from '../entities/operator.entity';
import { AppUser } from '../../users/entities/app-user.entity';
import {
  GoogleCalendarConnection,
  GoogleCalendarConnectionStatus,
  GoogleCalendarOwnerType,
} from '../entities/google-calendar-connection.entity';
import { OperatorCalendarFeedService } from './operator-calendar-feed.service';
import { GoogleCalendarOAuthService } from './google-calendar-oauth.service';
import { computeTokenLifetime } from '../utils/google-token-lifetime.util';
import {
  isGoogleOauthTestingMode, googleTokenLifetimeDays, googleAlertDaysBefore,
} from '../utils/google-oauth-mode';
import { WhatsappGatewayService } from '../../whatsapp/gateway/whatsapp-gateway.service';
import { WhatsappChatService } from '../../whatsapp/chat/services/whatsapp-chat.service';

/**
 * Avvisa chi usa Google Calendar prima che l'autorizzazione scada.
 *
 * Serve perche' finche' l'app Curandis e' in stato "Testing" presso Google il
 * permesso dura 7 giorni, poi il calendario dell'operatore smette di
 * aggiornarsi **senza dire niente**: gli appuntamenti vecchi restano, i nuovi
 * non arrivano, e chi lo usa se ne accorge quando si presenta all'ora
 * sbagliata.
 *
 * Il messaggio porta un link usa-e-getta che avvia direttamente la
 * riautorizzazione: senza, l'operatore dovrebbe farsi aprire la propria
 * scheda dalla segreteria, che e' il tipo di attrito per cui una cosa non si
 * fa e basta.
 */
@Injectable()
export class GoogleTokenAlertService {
  private readonly logger = new Logger(GoogleTokenAlertService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly feedService: OperatorCalendarFeedService,
    private readonly oauth: GoogleCalendarOAuthService,
    @Optional() @Inject(forwardRef(() => WhatsappGatewayService))
    private readonly whatsappGateway?: WhatsappGatewayService,
    @Optional() @Inject(forwardRef(() => WhatsappChatService))
    private readonly whatsappChat?: WhatsappChatService,
  ) {}

  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('Nessun DataSource di tenant nel contesto corrente');
    return ds;
  }

  /**
   * Controlla i collegamenti del tenant corrente e avvisa chi lo ha chiesto.
   * Chiamato dal job periodico dentro il contesto del tenant.
   */
  async checkAndAlert(): Promise<number> {
    if (!isGoogleOauthTestingMode()) return 0;

    const ds = this.dataSource;
    const connections = await ds.getRepository(GoogleCalendarConnection).find({
      where: { ownerType: GoogleCalendarOwnerType.APP_USER },
    });
    if (!connections.length) return 0;

    let sent = 0;

    for (const connection of connections) {
      const lifetime = computeTokenLifetime({
        connectedAt: connection.connectedAt,
        testingMode: true,
        lifetimeDays: googleTokenLifetimeDays(),
        warnDaysBefore: googleAlertDaysBefore(),
      });

      const expired = connection.status === GoogleCalendarConnectionStatus.EXPIRED;
      if (!lifetime.expiringSoon && !expired) continue;

      const operator = await ds.getRepository(Operator).findOne({
        where: { appUserId: connection.ownerId },
      });
      if (!operator) continue;
      if (!operator.googleAlertWhatsapp && !operator.googleAlertEmail) continue;

      /**
       * Gia' avvisato per QUESTO permesso?
       *
       * Il confronto e' con `connectedAt`, non con una finestra di tempo: chi
       * riautorizza ottiene un permesso nuovo con una data nuova, e da sola
       * rende "vecchio" l'avviso precedente. Cosi' non serve ricordarsi di
       * azzerare niente al rinnovo — la cosa che, dimenticata, avrebbe
       * lasciato l'operatore senza avviso al ciclo successivo.
       */
      if (
        operator.googleAlertLastSentAt
        && operator.googleAlertLastSentAt.getTime() > new Date(connection.connectedAt).getTime()
      ) {
        continue;
      }

      const channels: ('whatsapp' | 'email')[] = [];
      if (operator.googleAlertWhatsapp && operator.phone) channels.push('whatsapp');
      if (operator.googleAlertEmail && operator.email) channels.push('email');
      if (!channels.length) {
        this.logger.warn(
          `[GCAL-ALERT] ${operator.name}: avviso richiesto ma manca il recapito del canale scelto`,
        );
        continue;
      }

      for (const channel of channels) {
        try {
          await this.sendRenewLink(
            operator,
            channel,
            channel === 'email' ? operator.email! : operator.phone!,
            expired ? null : (lifetime.daysLeft ?? 0),
          );
          sent++;
        } catch (error) {
          this.logger.error(
            `[GCAL-ALERT] Invio fallito a ${operator.name} via ${channel}: ${(error as Error).message}`,
          );
        }
      }

      await ds.getRepository(Operator).update(operator.id, {
        googleAlertLastSentAt: new Date(),
      });
    }

    return sent;
  }

  /**
   * Manda il link di riautorizzazione.
   *
   * `daysLeft` null significa gia' scaduto: cambia il tono del messaggio, non
   * il meccanismo. Dire "scade fra 0 giorni" a chi ha gia' il calendario
   * fermo sarebbe una bugia rassicurante.
   */
  async sendRenewLink(
    operator: Operator,
    channel: 'whatsapp' | 'email',
    recipient: string,
    daysLeft: number | null,
  ): Promise<void> {
    const token = await this.feedService.issueSetupLink(
      operator.id, channel, recipient, 'google_renew',
    );
    const alias = this.tenantContext.getTenantAlias();
    const url = `${this.publicBaseUrl()}/calendar-feed/google-renew/${alias}/${token}`;

    const quando =
      daysLeft === null
        ? 'è scaduto: il tuo calendario Google non si sta più aggiornando'
        : daysLeft <= 0
          ? 'scade oggi'
          : daysLeft === 1
            ? 'scade domani'
            : `scade fra ${daysLeft} giorni`;

    const testo =
      `Ciao ${operator.name}, il collegamento fra Curandis e il tuo Google Calendar ${quando}.\n\n`
      + `Da qui lo rinnovi in un tocco, senza passare dalla segreteria:\n\n${url}\n\n`
      + `Il link vale 30 minuti e una volta sola. `
      + `Finché non lo rinnovi, gli appuntamenti nuovi e gli spostamenti non arrivano sul telefono.`;

    if (channel === 'email') {
      if (!this.whatsappGateway) {
        throw new BadRequestException('Canale email non disponibile: gateway non configurato');
      }
      await this.whatsappGateway.sendEmail({
        email: recipient,
        subject:
          daysLeft === null
            ? 'Il tuo calendario Google non si aggiorna più'
            : 'Rinnova il collegamento con Google Calendar',
        message: testo,
      });
      return;
    }

    if (!this.whatsappChat) {
      throw new BadRequestException('Modulo chat WhatsApp non disponibile');
    }
    const conversation = await this.whatsappChat.openConversation({
      phone: recipient,
      contactName: `${operator.name} ${operator.surname ?? ''}`.trim(),
    });
    await this.whatsappChat.sendMessage({ conversationId: conversation.id, text: testo });
  }

  /**
   * Guarda il link SENZA consumarlo: WhatsApp e i filtri di posta scaricano
   * l'URL da soli per l'anteprima, e un consumo in GET brucerebbe il link
   * prima che il destinatario lo veda.
   */
  async peekRenewLink(token: string): Promise<{ operatorName: string } | null> {
    const link = await this.feedService.peekLink(token, 'google_renew');
    if (!link) return null;

    const operator = await this.dataSource.getRepository(Operator).findOne({
      where: { id: link.operatorId },
    });
    if (!operator) return null;

    return { operatorName: `${operator.name} ${operator.surname ?? ''}`.trim() };
  }

  /** Consuma il link e restituisce l'indirizzo Google a cui mandare la persona. */
  async consumeRenewLink(token: string): Promise<string | null> {
    const link = await this.feedService.consumeLink(token, 'google_renew');
    if (!link) return null;

    const ds = this.dataSource;
    const operator = await ds.getRepository(Operator).findOne({ where: { id: link.operatorId } });
    if (!operator?.appUserId) return null;

    const user = await ds.getRepository(AppUser).findOne({ where: { id: operator.appUserId } });
    if (!user) return null;

    const connection = await ds.getRepository(GoogleCalendarConnection).findOne({
      where: { ownerType: GoogleCalendarOwnerType.APP_USER, ownerId: user.id },
    });

    return this.oauth.buildConnectUrl({
      ownerType: GoogleCalendarOwnerType.APP_USER,
      ownerId: user.id,
      // Si rinnova il calendario che c'e' gia': un nome diverso ne creerebbe
      // un secondo e lascerebbe il primo fermo per sempre.
      calendarName: connection?.calendarName ?? 'Curandis',
    });
  }

  private publicBaseUrl(): string {
    return (process.env.PUBLIC_API_BASE_URL || 'https://api.curandis.cloud').replace(/\/$/, '');
  }
}

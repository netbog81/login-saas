import { Resolver, Query, Mutation, Args, ID, ObjectType, Field } from '@nestjs/graphql';
import { UseGuards, Optional, BadRequestException } from '@nestjs/common';
import { Operator } from '../entities/operator.entity';
import { OperatorCalendarFeedService } from '../services/operator-calendar-feed.service';
import {
  AuthorizationGuard,
  RequirePermissions,
} from '../../users/guards/authorization.guard';
import { TenantContextService } from '@curandis/tenant-datasource';
import { WhatsappChatService } from '../../whatsapp/chat/services/whatsapp-chat.service';
import { WhatsappGatewayService } from '../../whatsapp/gateway/whatsapp-gateway.service';
import { CurrentUser, CurrentUserContext } from '../../users/decorators/current-user.decorator';

/**
 * Stato del feed ICS di un operatore, con l'URL già composto.
 *
 * L'URL contiene il token, cioè l'unica credenziale del feed: esce solo da
 * qui, su richiesta esplicita di chi ha `operator_calendar_manage`. Non è un campo
 * dell'operatore, altrimenti finirebbe in ogni query della gestione operatori
 * e da lì nella cache Apollo e nei log.
 */
@ObjectType()
export class OperatorCalendarFeedStatus {
  @Field(() => ID)
  operatorId: string;

  @Field()
  enabled: boolean;

  @Field()
  showPatientName: boolean;

  @Field()
  showPatientPhone: boolean;

  /** Null quando il feed non è attivo. */
  @Field({ nullable: true })
  feedUrl?: string;

  @Field({ nullable: true })
  createdAt?: Date;

  @Field({ nullable: true })
  revokedAt?: Date;

  /** Ultimo scaricamento del feed: dice se il calendario si sta aggiornando davvero. */
  @Field({ nullable: true })
  lastAccessAt?: Date;
}

@Resolver()
export class OperatorCalendarFeedResolver {
  constructor(
    private readonly feedService: OperatorCalendarFeedService,
    private readonly tenantContext: TenantContextService,
    @Optional() private readonly whatsappChat?: WhatsappChatService,
    @Optional() private readonly whatsappGateway?: WhatsappGatewayService,
  ) {}

  /** Repository sul DataSource del tenant corrente (DB-per-tenant). */
  private get operatorRepo() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds.getRepository(Operator);
  }

  @Query(() => OperatorCalendarFeedStatus, { name: 'operatorCalendarFeed' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async getFeed(
    @Args('operatorId', { type: () => ID }) operatorId: string,
  ): Promise<OperatorCalendarFeedStatus> {
    const operator = await this.operatorRepo.findOneOrFail({ where: { id: operatorId } });
    return this.toStatus(operator);
  }

  /**
   * Genera o rigenera il link. Rigenerare invalida il precedente: è anche il
   * modo di togliere di mezzo un URL finito dove non doveva.
   */
  @Mutation(() => OperatorCalendarFeedStatus, { name: 'generateOperatorCalendarFeed' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async generate(
    @Args('operatorId', { type: () => ID }) operatorId: string,
  ): Promise<OperatorCalendarFeedStatus> {
    return this.toStatus(await this.feedService.generateToken(operatorId));
  }

  @Mutation(() => OperatorCalendarFeedStatus, { name: 'revokeOperatorCalendarFeed' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async revoke(
    @Args('operatorId', { type: () => ID }) operatorId: string,
  ): Promise<OperatorCalendarFeedStatus> {
    return this.toStatus(await this.feedService.revokeToken(operatorId));
  }

  /**
   * Accende o spegne il nome del paziente nel feed.
   *
   * La spiegazione delle conseguenze e la conferma stanno nella UI: qui
   * arriva una scelta già presa, di cui resta traccia nei log del service.
   */
  @Mutation(() => OperatorCalendarFeedStatus, { name: 'setOperatorCalendarFeedPatientName' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async setPatientName(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('show') show: boolean,
  ): Promise<OperatorCalendarFeedStatus> {
    return this.toStatus(await this.feedService.setShowPatientName(operatorId, show));
  }

  /**
   * Accende o spegne il numero di telefono del paziente nel feed.
   * Scelta separata da quella del nome: il nome dice chi, il numero permette
   * di raggiungerlo.
   */
  @Mutation(() => OperatorCalendarFeedStatus, { name: 'setOperatorCalendarFeedPatientPhone' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async setPatientPhone(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('show') show: boolean,
  ): Promise<OperatorCalendarFeedStatus> {
    return this.toStatus(await this.feedService.setShowPatientPhone(operatorId, show));
  }

  /**
   * Manda all'operatore un link usa-e-getta per sottoscrivere l'agenda.
   *
   * Il link nel messaggio è temporaneo e monouso: apre una pagina con i
   * pulsanti di sottoscrizione, da cui l'indirizzo vero entra direttamente
   * nell'app calendario. Nella conversazione resta un link morto invece di
   * una credenziale permanente sull'agenda, che rimarrebbe lì anche nei
   * backup del telefono.
   */
  @Mutation(() => Boolean, { name: 'sendOperatorCalendarFeedLink' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async sendFeedLink(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('channel') channel: string,
    @Args('recipient') recipient: string,
    @CurrentUser() user?: CurrentUserContext,
  ): Promise<boolean> {
    const via = channel === 'email' ? 'email' : 'whatsapp';
    const to = recipient?.trim();
    if (!to) throw new BadRequestException('Indica un destinatario');

    const operator = await this.operatorRepo.findOneOrFail({ where: { id: operatorId } });
    const token = await this.feedService.issueSetupLink(operatorId, via, to);
    const alias = this.tenantContext.getTenantAlias();
    const setupUrl = `${this.publicBaseUrl()}/calendar-feed/setup/${alias}/${token}`;

    const nome = operator.name;
    const testo =
      `Ciao ${nome}, ecco il link per aggiungere la tua agenda di lavoro al `
      + `calendario del telefono:\n\n${setupUrl}\n\n`
      + `Il link vale 30 minuti e una volta sola. `
      + `Se scade, chiedi alla segreteria di rimandartelo.`;

    if (via === 'email') {
      if (!this.whatsappGateway) {
        throw new BadRequestException('Canale email non disponibile: gateway non configurato');
      }
      await this.whatsappGateway.sendEmail({
        email: to,
        subject: 'La tua agenda di lavoro sul calendario',
        message: testo,
      });
      return true;
    }

    if (!this.whatsappChat) {
      throw new BadRequestException('Modulo chat WhatsApp non disponibile');
    }
    // `patientId` è opzionale: la conversazione si apre sul numero, che qui
    // è di un operatore e non di un paziente.
    const conversation = await this.whatsappChat.openConversation({
      phone: to,
      contactName: `${operator.name} ${operator.surname ?? ''}`.trim(),
    });
    await this.whatsappChat.sendMessage({
      conversationId: conversation.id,
      text: testo,
      userId: user?.userId,
      userName: (user as any)?.name || (user as any)?.email,
    });
    return true;
  }

  private toStatus(operator: Operator): OperatorCalendarFeedStatus {
    return {
      operatorId: operator.id,
      enabled: operator.calendarFeedEnabled,
      showPatientName: operator.calendarFeedShowPatientName,
      showPatientPhone: operator.calendarFeedShowPatientPhone,
      feedUrl:
        this.feedService.buildFeedUrl(operator, this.publicBaseUrl(), this.tenantAlias())
        ?? undefined,
      createdAt: operator.calendarFeedCreatedAt,
      revokedAt: operator.calendarFeedRevokedAt,
      lastAccessAt: operator.calendarFeedLastAccessAt,
    };
  }

  /**
   * Base pubblica del backend.
   *
   * In produzione TUTTI i tenant parlano con lo stesso host,
   * `api.curandis.cloud`: non esiste un `clinico.{tenant}.curandis.cloud` —
   * quel nome non è nemmeno nel DNS. Per questo il tenant viaggia nel path
   * del feed e non nel sottodominio.
   *
   * Sovrascrivibile con `CLINICO_PUBLIC_API_URL` per installazioni che
   * espongono il backend altrove.
   */
  private publicBaseUrl(): string {
    return process.env.CLINICO_PUBLIC_API_URL || 'https://api.curandis.cloud';
  }

  /** Alias del tenant corrente: finisce nel path del feed. */
  private tenantAlias(): string {
    const alias = this.tenantContext.getTenantAlias();
    if (!alias) throw new Error('Tenant non risolto: impossibile comporre il link del feed');
    return alias;
  }
}

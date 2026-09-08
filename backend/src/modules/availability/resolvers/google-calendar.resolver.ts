import {
  Resolver, Query, Mutation, Args, ID, Int, ObjectType, Field,
} from '@nestjs/graphql';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { TenantContextService } from '@curandis/tenant-datasource';
import { GoogleCalendarOAuthService } from '../services/google-calendar-oauth.service';
import { GoogleCalendarConnectionService } from '../services/google-calendar-connection.service';
import { GoogleCalendarSyncService } from '../services/google-calendar-sync.service';
import { GoogleTokenAlertService } from '../services/google-token-alert.service';
import {
  GoogleCalendarOwnerType,
  GoogleCalendarConnectionStatus,
  GoogleCalendarConnection,
} from '../entities/google-calendar-connection.entity';
import { Operator } from '../entities/operator.entity';
import {
  CurrentUser, CurrentUserContext,
} from '../../users/decorators/current-user.decorator';
import { computeTokenLifetime } from '../utils/google-token-lifetime.util';
import {
  isGoogleOauthTestingMode, googleTokenLifetimeDays, googleAlertDaysBefore,
} from '../utils/google-oauth-mode';
import { AppUser } from '../../users/entities/app-user.entity';
import {
  AuthorizationGuard,
  RequirePermissions,
} from '../../users/guards/authorization.guard';

/**
 * Stato del collegamento Google Calendar di un operatore, per la sua scheda.
 *
 * Il token non compare da nessuna parte: qui c'è solo ciò che serve a
 * decidere cosa mostrare e quale pulsante offrire.
 */
@ObjectType()
export class GoogleCalendarStatus {
  @Field(() => ID)
  operatorId: string;

  /** Falso quando l'operatore non ha un utente collegato: non può autorizzare. */
  @Field()
  canConnect: boolean;

  @Field()
  connected: boolean;

  /** Indirizzo Google dichiarato sull'utente, se impostato. */
  @Field({ nullable: true })
  declaredEmail?: string;

  /** Indirizzo che ha davvero autorizzato, come lo riporta Google. */
  @Field({ nullable: true })
  googleEmail?: string;

  @Field({ nullable: true })
  calendarName?: string;

  /**
   * Nome proposto per il calendario da creare, quando non è ancora collegato.
   * Modificabile: lo studio può volerci il proprio nome, non l'alias tecnico.
   */
  @Field()
  suggestedCalendarName: string;

  @Field(() => GoogleCalendarConnectionStatus, { nullable: true })
  status?: GoogleCalendarConnectionStatus;

  @Field({ nullable: true })
  connectedAt?: Date;

  @Field({ nullable: true })
  lastSyncAt?: Date;

  @Field({ nullable: true })
  lastErrorMessage?: string;

  /**
   * Vero quando l'autorizzazione non vale più e serve ricollegare.
   * Finché l'app Google è in "Testing" succede ogni 7 giorni.
   */
  @Field()
  needsReconnect: boolean;

  /**
   * L'app Curandis è ancora in "Testing" presso Google: i permessi scadono
   * a scadenza fissa e ha senso mostrare un conto alla rovescia. A verifica
   * ottenuta diventa falso e la UI smette di parlarne.
   */
  @Field()
  testingMode: boolean;

  /**
   * Scadenza ATTESA dell'autorizzazione. È una previsione, non un dato:
   * Google non comunica la scadenza dei refresh token, ma in fase di test la
   * vita è fissa e la data di rilascio la conosciamo.
   */
  @Field({ nullable: true })
  expiresAt?: Date;

  /** Giorni interi rimasti; negativo se la scadenza attesa è passata. */
  @Field(() => Int, { nullable: true })
  daysLeft?: number;

  /** Conviene riautorizzare adesso, senza aspettare che si rompa. */
  @Field()
  expiringSoon: boolean;

  /** Riceve l'avviso di scadenza su WhatsApp. */
  @Field()
  alertWhatsapp: boolean;

  /** Riceve l'avviso di scadenza per email. */
  @Field()
  alertEmail: boolean;

  /** Recapiti su cui l'avviso può partire, per popolare i campi della UI. */
  @Field({ nullable: true })
  operatorPhone?: string;

  @Field({ nullable: true })
  operatorEmail?: string;
}

/**
 * Riepilogo compatto dello stato di sincronizzazione di un operatore, per
 * l'elenco in configurazione.
 *
 * Query unica per tutti invece di una per card: con venti operatori sarebbero
 * state venti chiamate per mostrare tre pastiglie.
 */
@ObjectType()
export class OperatorSyncSummary {
  @Field(() => ID)
  operatorId: string;

  /** Feed ICS attivo (abbonamento al calendario). */
  @Field()
  feedEnabled: boolean;

  /** Collegamento Google attivo. */
  @Field()
  googleConnected: boolean;

  /** Indirizzo che ha autorizzato, quando c'è. */
  @Field({ nullable: true })
  googleEmail?: string;

  /** Indirizzo dichiarato dall'amministratore ma non ancora autorizzato. */
  @Field({ nullable: true })
  declaredEmail?: string;

  /** L'autorizzazione è scaduta: il calendario non si aggiorna più. */
  @Field()
  googleNeedsReconnect: boolean;

  /** Giorni residui previsti, solo finché l'app Google è in fase di test. */
  @Field(() => Int, { nullable: true })
  googleDaysLeft?: number;
}

@Resolver()
export class GoogleCalendarResolver {
  constructor(
    private readonly oauth: GoogleCalendarOAuthService,
    private readonly connections: GoogleCalendarConnectionService,
    private readonly tenantContext: TenantContextService,
    private readonly sync: GoogleCalendarSyncService,
    private readonly alerts: GoogleTokenAlertService,
  ) {}

  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  @Query(() => GoogleCalendarStatus, { name: 'operatorGoogleCalendar' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async status(
    @Args('operatorId', { type: () => ID }) operatorId: string,
  ): Promise<GoogleCalendarStatus> {
    const { operator, user } = await this.resolveOperator(operatorId);

    if (!user) {
      return {
        operatorId,
        canConnect: false,
        connected: false,
        needsReconnect: false,
        testingMode: isGoogleOauthTestingMode(),
        expiringSoon: false,
        alertWhatsapp: !!operator.googleAlertWhatsapp,
        alertEmail: !!operator.googleAlertEmail,
        suggestedCalendarName: this.defaultCalendarName(),
      };
    }

    const connection = await this.connections.findByOwner(
      GoogleCalendarOwnerType.APP_USER,
      user.id,
    );

    const lifetime = computeTokenLifetime({
      connectedAt: connection?.connectedAt,
      testingMode: isGoogleOauthTestingMode(),
      lifetimeDays: googleTokenLifetimeDays(),
      warnDaysBefore: googleAlertDaysBefore(),
    });

    return {
      operatorId,
      canConnect: true,
      // Collegato = c'e' un permesso valido, non "l'ultima sincronizzazione e'
      // andata bene". Legandolo ad ACTIVE, un errore passeggero faceva sparire
      // il collegamento dagli occhi dell'operatore, che si vedeva scollegato
      // pur avendo l'autorizzazione intatta. L'errore si racconta con
      // `lastErrorMessage`, non facendo finta che il collegamento non esista.
      connected: !!connection
        && connection.status !== GoogleCalendarConnectionStatus.REVOKED
        && connection.status !== GoogleCalendarConnectionStatus.EXPIRED,
      declaredEmail: user.googleAccountEmail ?? undefined,
      googleEmail: connection?.googleEmail,
      calendarName: connection?.calendarName,
      status: connection?.status,
      connectedAt: connection?.connectedAt,
      lastSyncAt: connection?.lastSyncAt,
      lastErrorMessage: connection?.lastErrorMessage,
      needsReconnect: connection?.status === GoogleCalendarConnectionStatus.EXPIRED,
      suggestedCalendarName: connection?.calendarName ?? this.defaultCalendarName(),
      testingMode: isGoogleOauthTestingMode(),
      expiresAt: lifetime.expiresAt,
      daysLeft: lifetime.daysLeft,
      // Un collegamento gia' scaduto non e' "in scadenza": ha gia' bisogno di
      // essere rifatto, e dirlo due volte in modi diversi confonderebbe.
      expiringSoon:
        lifetime.expiringSoon
        && connection?.status === GoogleCalendarConnectionStatus.ACTIVE,
      alertWhatsapp: !!operator.googleAlertWhatsapp,
      alertEmail: !!operator.googleAlertEmail,
      operatorPhone: operator.phone ?? undefined,
      operatorEmail: operator.email ?? undefined,
    };
  }

  /**
   * Stato di sincronizzazione di TUTTI gli operatori, in una sola query.
   *
   * Serve all'elenco in configurazione, dove ogni card mostra a colpo d'occhio
   * se quella persona riceve l'agenda sul telefono e da quale strada.
   */
  @Query(() => [OperatorSyncSummary], { name: 'operatorsSyncSummary' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async syncSummary(): Promise<OperatorSyncSummary[]> {
    const ds = this.dataSource;
    const operators = await ds.getRepository(Operator).find();
    const users = await ds.getRepository(AppUser).find();
    const connections = await ds.getRepository(GoogleCalendarConnection).find({
      where: { ownerType: GoogleCalendarOwnerType.APP_USER },
    });

    const userById = new Map(users.map(u => [u.id, u]));
    const connByOwner = new Map(connections.map(c => [c.ownerId, c]));
    const testing = isGoogleOauthTestingMode();

    return operators.map((operator) => {
      const user = operator.appUserId ? userById.get(operator.appUserId) : undefined;
      const connection = user ? connByOwner.get(user.id) : undefined;

      const lifetime = computeTokenLifetime({
        connectedAt: connection?.connectedAt,
        testingMode: testing,
        lifetimeDays: googleTokenLifetimeDays(),
        warnDaysBefore: googleAlertDaysBefore(),
      });

      return {
        operatorId: operator.id,
        feedEnabled: !!operator.calendarFeedEnabled,
        googleConnected: !!connection
          && connection.status !== GoogleCalendarConnectionStatus.REVOKED
          && connection.status !== GoogleCalendarConnectionStatus.EXPIRED,
        googleEmail: connection?.googleEmail,
        declaredEmail: user?.googleAccountEmail ?? undefined,
        googleNeedsReconnect: connection?.status === GoogleCalendarConnectionStatus.EXPIRED,
        googleDaysLeft: connection ? lifetime.daysLeft : undefined,
      };
    });
  }

  /**
   * Il PROPRIO collegamento Google, per la dashboard.
   *
   * Query distinta e senza `operator_calendar_manage` perche' quel permesso
   * ce l'hanno solo chi amministra e la segreteria: chiedendolo qui, un
   * operatore o un medico riceveva un errore di permessi e il riquadro non
   * compariva mai — proprio a chi serve, visto che e' il suo calendario.
   *
   * Non prende un `operatorId`: la persona si ricava dal token. Cosi' non
   * esiste nemmeno il modo di chiedere lo stato di qualcun altro.
   */
  @Query(() => GoogleCalendarStatus, { name: 'myGoogleCalendar', nullable: true })
  async myStatus(@CurrentUser() current?: CurrentUserContext): Promise<GoogleCalendarStatus | null> {
    const operator = await this.operatorOfCurrentUser(current);
    return operator ? this.status(operator.id) : null;
  }

  /** Rinnova il PROPRIO collegamento. */
  @Mutation(() => String, { name: 'startMyGoogleCalendarConnect' })
  async startMyConnect(@CurrentUser() current?: CurrentUserContext): Promise<string> {
    const operator = await this.requireOwnOperator(current);
    return this.startConnect(operator.id);
  }

  /** Accende o spegne l'avviso di scadenza sul PROPRIO collegamento. */
  @Mutation(() => GoogleCalendarStatus, { name: 'setMyGoogleAlertChannel' })
  async setMyAlertChannel(
    @Args('channel') channel: string,
    @Args('enabled') enabled: boolean,
    @CurrentUser() current?: CurrentUserContext,
  ): Promise<GoogleCalendarStatus> {
    const operator = await this.requireOwnOperator(current);
    return this.setAlertChannel(operator.id, channel, enabled);
  }

  /** Si manda da solo il link di rinnovo, sul proprio recapito. */
  @Mutation(() => Boolean, { name: 'sendMyGoogleRenewLink' })
  async sendMyRenewLink(
    @Args('channel') channel: string,
    @CurrentUser() current?: CurrentUserContext,
  ): Promise<boolean> {
    const operator = await this.requireOwnOperator(current);
    const recipient = channel === 'email' ? operator.email : operator.phone;
    if (!recipient) {
      throw new BadRequestException(
        channel === 'email'
          ? 'Non hai un indirizzo email in scheda: chiedi alla segreteria di inserirlo.'
          : 'Non hai un numero in scheda: chiedi alla segreteria di inserirlo.',
      );
    }
    return this.sendRenewLink(operator.id, channel, recipient);
  }

  /** Si scollega da solo dal PROPRIO calendario Google. */
  @Mutation(() => GoogleCalendarStatus, { name: 'disconnectMyGoogleCalendar' })
  async disconnectMine(@CurrentUser() current?: CurrentUserContext): Promise<GoogleCalendarStatus> {
    const operator = await this.requireOwnOperator(current);
    return this.disconnect(operator.id);
  }

  /** L'operatore legato all'utente del token, se ce n'e' uno. */
  private async operatorOfCurrentUser(
    current?: CurrentUserContext,
  ): Promise<Operator | null> {
    const keycloakId = current?.userId;
    if (!keycloakId) return null;

    const user = await this.dataSource
      .getRepository(AppUser)
      .findOne({ where: { keycloakId } });
    if (!user) return null;

    return this.dataSource
      .getRepository(Operator)
      .findOne({ where: { appUserId: user.id } });
  }

  private async requireOwnOperator(current?: CurrentUserContext): Promise<Operator> {
    const operator = await this.operatorOfCurrentUser(current);
    if (!operator) {
      throw new BadRequestException(
        "Il tuo utente non è collegato a nessun operatore: chiedi all'amministratore di collegarlo.",
      );
    }
    return operator;
  }

  /**
   * URL a cui mandare l'utente per autorizzare.
   *
   * Non è un redirect del server: torna l'indirizzo, e il frontend apre la
   * finestra. Un redirect dentro una risposta GraphQL non arriverebbe da
   * nessuna parte.
   */
  @Mutation(() => String, { name: 'startOperatorGoogleCalendarConnect' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async startConnect(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('calendarName', { nullable: true }) calendarName?: string,
  ): Promise<string> {
    const { operator, user } = await this.resolveOperator(operatorId);
    if (!user) {
      throw new BadRequestException(
        "Questo operatore non ha un utente collegato: senza account non può autorizzare Google.",
      );
    }
    if (!user.googleAccountEmail) {
      throw new BadRequestException(
        "Indica prima l'indirizzo Google di questa persona: serve a proporre "
        + "l'account giusto e a verificare che sia quello che autorizza.",
      );
    }

    return this.oauth.buildConnectUrl({
      ownerType: GoogleCalendarOwnerType.APP_USER,
      ownerId: user.id,
      calendarName: (calendarName?.trim() || this.defaultCalendarName()),
    });
  }

  /**
   * Chi riceve l'avviso di scadenza, e su quale canale.
   *
   * Scelta della singola persona e non dello studio: e' il suo calendario
   * personale e il suo telefono. Si possono tenere accesi entrambi i canali.
   */
  @Mutation(() => GoogleCalendarStatus, { name: 'setOperatorGoogleAlertChannel' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async setAlertChannel(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('channel') channel: string,
    @Args('enabled') enabled: boolean,
  ): Promise<GoogleCalendarStatus> {
    const repo = this.dataSource.getRepository(Operator);
    const operator = await repo.findOne({ where: { id: operatorId } });
    if (!operator) throw new BadRequestException('Operatore non trovato');

    if (channel === 'email') {
      if (enabled && !operator.email) {
        throw new BadRequestException(
          "Questa persona non ha un indirizzo email in scheda: l'avviso non avrebbe dove arrivare.",
        );
      }
      operator.googleAlertEmail = enabled;
    } else if (channel === 'whatsapp') {
      if (enabled && !operator.phone) {
        throw new BadRequestException(
          "Questa persona non ha un numero in scheda: l'avviso non avrebbe dove arrivare.",
        );
      }
      operator.googleAlertWhatsapp = enabled;
    } else {
      throw new BadRequestException(`Canale sconosciuto: ${channel}`);
    }

    await repo.save(operator);
    return this.status(operatorId);
  }

  /**
   * Manda subito il link di riautorizzazione, senza aspettare il controllo
   * periodico. Serve a chi si accorge del problema prima di noi.
   */
  @Mutation(() => Boolean, { name: 'sendOperatorGoogleRenewLink' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async sendRenewLink(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('channel') channel: string,
    @Args('recipient') recipient: string,
  ): Promise<boolean> {
    const to = recipient?.trim();
    if (!to) throw new BadRequestException('Indica un destinatario');

    const operator = await this.dataSource
      .getRepository(Operator)
      .findOne({ where: { id: operatorId } });
    if (!operator) throw new BadRequestException('Operatore non trovato');

    const current = await this.status(operatorId);
    await this.alerts.sendRenewLink(
      operator,
      channel === 'email' ? 'email' : 'whatsapp',
      to,
      current.needsReconnect ? null : (current.daysLeft ?? 0),
    );
    return true;
  }

  @Mutation(() => GoogleCalendarStatus, { name: 'disconnectOperatorGoogleCalendar' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async disconnect(
    @Args('operatorId', { type: () => ID }) operatorId: string,
  ): Promise<GoogleCalendarStatus> {
    const { user } = await this.resolveOperator(operatorId);
    if (!user) throw new BadRequestException('Operatore senza utente collegato');

    await this.oauth.disconnect(GoogleCalendarOwnerType.APP_USER, user.id);
    return this.status(operatorId);
  }

  /**
   * Rinomina il calendario già creato.
   *
   * Serve perché il nome si sceglie prima di collegare, quando ancora non si
   * è visto il risultato dentro Google: senza questa, cambiare idea vorrebbe
   * dire scollegare e rifare tutto.
   */
  @Mutation(() => GoogleCalendarStatus, { name: 'renameOperatorGoogleCalendar' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async renameCalendar(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('calendarName') calendarName: string,
  ): Promise<GoogleCalendarStatus> {
    const name = calendarName?.trim();
    if (!name) throw new BadRequestException('Il nome del calendario non può essere vuoto');

    const { user } = await this.resolveOperator(operatorId);
    if (!user) throw new BadRequestException('Operatore senza utente collegato');

    await this.oauth.renameCalendar(GoogleCalendarOwnerType.APP_USER, user.id, name);
    return this.status(operatorId);
  }

  /**
   * Riversa subito tutti gli appuntamenti della finestra sul calendario.
   *
   * La sincronizzazione avviene già da sola — a ogni scrittura e comunque
   * ogni 10 minuti — ma serve un modo di dire "portalo lì adesso": dopo aver
   * cambiato le impostazioni di riservatezza, o quando si vuole verificare
   * che il collegamento funzioni senza aspettare il giro automatico.
   */
  @Mutation(() => GoogleCalendarStatus, { name: 'syncOperatorGoogleCalendar' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async syncNow(
    @Args('operatorId', { type: () => ID }) operatorId: string,
  ): Promise<GoogleCalendarStatus> {
    const { user } = await this.resolveOperator(operatorId);
    if (!user) throw new BadRequestException('Operatore senza utente collegato');

    const connection = await this.connections.findByOwner(
      GoogleCalendarOwnerType.APP_USER, user.id,
    );
    if (!connection || connection.status !== GoogleCalendarConnectionStatus.ACTIVE) {
      throw new BadRequestException('Nessun collegamento attivo da sincronizzare');
    }

    await this.sync.syncWindowForConnection(connection);
    return this.status(operatorId);
  }

  /**
   * Indirizzo Google dichiarato: sta sull'utente, non sull'operatore, perché
   * un account Google appartiene alla persona.
   */
  @Mutation(() => GoogleCalendarStatus, { name: 'setOperatorGoogleAccountEmail' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async setDeclaredEmail(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('email', { nullable: true }) email?: string,
  ): Promise<GoogleCalendarStatus> {
    const { user } = await this.resolveOperator(operatorId);
    if (!user) throw new BadRequestException('Operatore senza utente collegato');

    const value = email?.trim().toLowerCase() || null;
    if (value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      throw new BadRequestException('Indirizzo email non valido');
    }

    await this.dataSource
      .getRepository(AppUser)
      .update(user.id, { googleAccountEmail: value ?? undefined });

    return this.status(operatorId);
  }

  /** Nome di default del calendario: il tenant, che è come lo studio si chiama. */
  private defaultCalendarName(): string {
    const alias = this.tenantContext.getTenantAlias() ?? 'Curandis';
    return alias.toUpperCase();
  }

  private async resolveOperator(
    operatorId: string,
  ): Promise<{ operator: Operator; user: AppUser | null }> {
    const operator = await this.dataSource
      .getRepository(Operator)
      .findOne({ where: { id: operatorId } });
    if (!operator) throw new BadRequestException('Operatore non trovato');

    const user = operator.appUserId
      ? await this.dataSource.getRepository(AppUser).findOne({ where: { id: operator.appUserId } })
      : null;

    return { operator, user };
  }
}

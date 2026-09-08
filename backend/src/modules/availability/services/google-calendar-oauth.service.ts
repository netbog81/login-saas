import { Injectable, Logger, BadRequestException, Optional, Inject, forwardRef } from '@nestjs/common';
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { TenantContextService } from '@curandis/tenant-datasource';
import { OpenbaoTokenProvider } from '../../../infrastructure/openbao/openbao-token.provider';
import { readGoogleOAuthConfig } from '../../../infrastructure/openbao/google-oauth-kv-config';
import {
  GoogleCalendarApiService, GoogleAuthorizationExpiredError,
} from './google-calendar-api.service';
import { GoogleCalendarConnectionService } from './google-calendar-connection.service';
import { CalendarSyncSettingService } from './calendar-sync-setting.service';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';
import {
  GoogleCalendarConnection,
  GoogleCalendarOwnerType,
} from '../entities/google-calendar-connection.entity';
import { AppUser } from '../../users/entities/app-user.entity';

/** Contenuto dello `state` OAuth: chi sta collegando, e dove. */
export interface OAuthState {
  tenantAlias: string;
  ownerType: GoogleCalendarOwnerType;
  ownerId: string;
  /** Nome scelto per il calendario dedicato. */
  calendarName: string;
  /** Scadenza (epoch secondi): uno state vecchio non deve valere per sempre. */
  exp: number;
}

/** Esito del collegamento, per la pagina di ritorno. */
export interface ConnectOutcome {
  ok: boolean;
  message: string;
  googleEmail?: string;
  /** Vero quando l'account autorizzato non è quello dichiarato. */
  accountMismatch?: boolean;
}

/**
 * Flusso di collegamento a Google Calendar.
 *
 * IL PROBLEMA DELLO `state`: Google rimanda l'utente sul callback **senza
 * JWT** — è un redirect del browser verso un URL pubblico. Il backend deve
 * quindi sapere da sé di quale tenant e di quale utente si tratta, e non può
 * fidarsi di quello che c'è nell'URL: chiunque potrebbe cambiare l'id e farsi
 * collegare il calendario a nome di un altro.
 *
 * Perciò lo state è **firmato in HMAC** e ha una scadenza breve. La chiave di
 * firma è il client secret di Google: è già un segreto lato server, non esce
 * mai, e non richiede di provisionarne un altro. Se un giorno servisse
 * separarlo, basta cambiare `signingKey()`.
 */
@Injectable()
export class GoogleCalendarOAuthService {
  private readonly logger = new Logger(GoogleCalendarOAuthService.name);

  /** Finestra entro cui completare l'autorizzazione. */
  private static readonly STATE_TTL_SECONDS = 15 * 60;

  constructor(
    private readonly api: GoogleCalendarApiService,
    private readonly connections: GoogleCalendarConnectionService,
    private readonly tenantContext: TenantContextService,
    private readonly tokenProvider: OpenbaoTokenProvider,
    private readonly syncSettings: CalendarSyncSettingService,
    /** Iniettato in avanti: il sync usa a sua volta questo service. */
    @Optional()
    @Inject(forwardRef(() => GoogleCalendarSyncService))
    private readonly sync?: GoogleCalendarSyncService,
  ) {}

  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  /**
   * URL a cui mandare l'utente per autorizzare.
   *
   * Chiamato da dentro una richiesta autenticata: tenant e utente si sanno
   * qui, e vengono sigillati nello state perché al ritorno non ci saranno più.
   */
  async buildConnectUrl(params: {
    ownerType: GoogleCalendarOwnerType;
    ownerId: string;
    calendarName: string;
  }): Promise<string> {
    const tenantAlias = this.tenantContext.getTenantAlias();
    if (!tenantAlias) throw new Error('Tenant non risolto');

    const declaredEmail = await this.declaredGoogleEmail(params.ownerType, params.ownerId);

    const state = await this.signState({
      tenantAlias,
      ownerType: params.ownerType,
      ownerId: params.ownerId,
      calendarName: params.calendarName,
      exp: Math.floor(Date.now() / 1000) + GoogleCalendarOAuthService.STATE_TTL_SECONDS,
    });

    return this.api.buildAuthorizationUrl(state, declaredEmail);
  }

  /**
   * Completa il collegamento dopo il redirect di Google.
   *
   * Gira già dentro il contesto tenant, che il controller ha costruito a mano
   * leggendo lo state (l'unica fonte affidabile, essendo firmata).
   */
  async completeConnection(state: OAuthState, code: string): Promise<ConnectOutcome> {
    const tokens = await this.api.exchangeCode(code);

    if (!tokens.email) {
      return {
        ok: false,
        message:
          'Google non ha comunicato quale account ha autorizzato: impossibile '
          + 'verificare che sia quello giusto. Riprova.',
      };
    }

    // Verifica che chi ha autorizzato sia chi ci si aspettava. Senza questo
    // controllo un operatore che sbaglia account si vedrebbe gli appuntamenti
    // finire nel calendario di un'altra persona, e nessuno se ne accorgerebbe.
    const declared = await this.declaredGoogleEmail(state.ownerType, state.ownerId);
    const mismatch = !!declared && declared.toLowerCase() !== tokens.email.toLowerCase();
    if (mismatch) {
      // Non si salva niente e si revoca subito: un token ottenuto per errore
      // non deve restare valido lato Google.
      await this.api.revoke(tokens.refreshToken);
      return {
        ok: false,
        accountMismatch: true,
        googleEmail: tokens.email,
        message:
          `Hai autorizzato con ${tokens.email}, ma per questa persona è indicato `
          + `${declared}. Collegamento annullato: esci da Google, rientra con `
          + `l'account giusto e riprova.`,
      };
    }

    // Calendario dedicato: creato ora, con il nome scelto.
    let calendarId: string | undefined;
    try {
      calendarId = await this.api.createCalendar(tokens.accessToken, state.calendarName);
    } catch (err) {
      this.logger.error(`Creazione calendario fallita: ${(err as Error).message}`);
      await this.api.revoke(tokens.refreshToken);
      return {
        ok: false,
        message: `Autorizzazione riuscita ma creazione del calendario fallita: ${(err as Error).message}`,
      };
    }

    await this.connections.save({
      ownerType: state.ownerType,
      ownerId: state.ownerId,
      googleEmail: tokens.email,
      refreshToken: tokens.refreshToken,
      scope: tokens.scope,
      calendarId,
      calendarName: state.calendarName,
    });

    this.logger.log(
      `Google Calendar collegato: ${state.ownerType}/${state.ownerId} → ${tokens.email}`,
    );

    // Riversata iniziale in background: chi autorizza si aspetta di trovare
    // la propria agenda, non un calendario vuoto che si popola col tempo.
    // In background perché con centinaia di appuntamenti l'utente resterebbe
    // fermo sulla pagina di ritorno per parecchi secondi.
    this.sync?.scheduleInitialSync(state.ownerId);
    return {
      ok: true,
      googleEmail: tokens.email,
      message: `Calendario "${state.calendarName}" collegato a ${tokens.email}.`,
    };
  }

  /**
   * Scollega: revoca lato Google e cancella il token da noi.
   *
   * Prima Google, poi noi: se si cancellasse prima il token locale e la
   * revoca fallisse, resterebbe un'autorizzazione viva che nessuno può più
   * ritirare.
   */
  async disconnect(
    ownerType: GoogleCalendarOwnerType,
    ownerId: string,
  ): Promise<GoogleCalendarConnection> {
    const connection = await this.connections.findByOwner(ownerType, ownerId);
    if (!connection) throw new BadRequestException('Nessun collegamento da rimuovere');

    // L'ORDINE conta: prima si cancella il calendario, poi si revoca il
    // permesso. Al contrario resteremmo senza il diritto di cancellarlo, e il
    // calendario rimarrebbe li' per sempre contro la volonta' dello studio.
    if (connection.encRefreshToken && connection.calendarId) {
      try {
        const setting = await this.syncSettings.get();
        if (!setting.keepCalendarOnDisconnect) {
          const accessToken = await this.accessTokenFor(connection);
          await this.api.deleteCalendar(accessToken, connection.calendarId);
          this.logger.log(`Calendario "${connection.calendarName}" cancellato da Google`);
        }
      } catch (err) {
        // Non blocca lo scollegamento: meglio un calendario di troppo che una
        // persona che non riesce a scollegarsi.
        this.logger.warn(
          `Cancellazione del calendario non riuscita: ${(err as Error).message}`,
        );
      }
    }

    if (connection.encRefreshToken) {
      try {
        const refreshToken = await this.connections.getRefreshToken(connection);
        await this.api.revoke(refreshToken);
      } catch (err) {
        this.logger.warn(`Revoca lato Google non riuscita: ${(err as Error).message}`);
      }
    }

    return this.connections.revoke(ownerType, ownerId);
  }

  /**
   * Rinomina il calendario dedicato, su Google e da noi.
   *
   * Prima Google, poi il database: se si aggiornasse prima il nostro nome e
   * la chiamata a Google fallisse, resterebbe scritto un nome che il
   * calendario dell'operatore non ha.
   */
  async renameCalendar(
    ownerType: GoogleCalendarOwnerType,
    ownerId: string,
    name: string,
  ): Promise<void> {
    const connection = await this.connections.findByOwner(ownerType, ownerId);
    if (!connection?.calendarId) {
      throw new BadRequestException('Nessun calendario collegato da rinominare');
    }

    const accessToken = await this.accessTokenFor(connection);
    await this.api.renameCalendar(accessToken, connection.calendarId, name);
    await this.connections.updateCalendarName(connection.id, name);
    this.logger.log(`Calendario rinominato in "${name}" per ${ownerType}/${ownerId}`);
  }

  /**
   * Access token pronto all'uso per un collegamento, segnando lo stato se
   * l'autorizzazione non vale più.
   */
  async accessTokenFor(connection: GoogleCalendarConnection): Promise<string> {
    const refreshToken = await this.connections.getRefreshToken(connection);
    try {
      return await this.api.getAccessToken(refreshToken);
    } catch (err) {
      if (err instanceof GoogleAuthorizationExpiredError) {
        await this.connections.markError(connection.id, err.message, true);
      }
      throw err;
    }
  }

  /** Indirizzo Google dichiarato per quella persona, se impostato. */
  private async declaredGoogleEmail(
    ownerType: GoogleCalendarOwnerType,
    ownerId: string,
  ): Promise<string | undefined> {
    if (ownerType !== GoogleCalendarOwnerType.APP_USER) return undefined;
    const user = await this.dataSource
      .getRepository(AppUser)
      .findOne({ where: { id: ownerId } });
    return user?.googleAccountEmail ?? undefined;
  }

  // ==================== STATE FIRMATO ====================

  /** Chiave di firma: il client secret di Google, già segreto lato server. */
  private async signingKey(): Promise<string> {
    const { clientSecret } = await readGoogleOAuthConfig(this.tokenProvider);
    return clientSecret;
  }

  private async signState(state: OAuthState): Promise<string> {
    // Il nonce rende ogni state diverso anche a parità di contenuto: due
    // tentativi ravvicinati dello stesso utente non producono la stessa
    // stringa in giro per i log dei redirect.
    const payload = Buffer.from(
      JSON.stringify({ ...state, n: randomBytes(8).toString('hex') }),
    ).toString('base64url');
    const signature = createHmac('sha256', await this.signingKey())
      .update(payload)
      .digest('base64url');
    return `${payload}.${signature}`;
  }

  /**
   * Verifica e decodifica lo state. Lancia se manomesso o scaduto: da qui
   * dipende a quale tenant e a quale persona viene collegato il calendario,
   * quindi non si perdona nulla.
   */
  async verifyState(raw: string): Promise<OAuthState> {
    const [payload, signature] = (raw ?? '').split('.');
    if (!payload || !signature) throw new BadRequestException('State non valido');

    const expected = createHmac('sha256', await this.signingKey())
      .update(payload)
      .digest('base64url');

    // Confronto a tempo costante: con `===` la durata del confronto
    // racconterebbe quanti caratteri iniziali sono giusti.
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('State non valido');
    }

    const state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState;
    if (!state.exp || state.exp < Math.floor(Date.now() / 1000)) {
      throw new BadRequestException(
        'Richiesta di collegamento scaduta: riparti dalla scheda operatore.',
      );
    }
    return state;
  }
}

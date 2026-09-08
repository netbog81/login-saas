import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@curandis/tenant-datasource';
import { TransitEncryptionService } from '@curandis/encryption-core';
import {
  GoogleCalendarConnection,
  GoogleCalendarOwnerType,
  GoogleCalendarConnectionStatus,
} from '../entities/google-calendar-connection.entity';

/** Dati di un collegamento appena autorizzato. */
export interface SaveConnectionParams {
  ownerType: GoogleCalendarOwnerType;
  ownerId: string;
  /** Indirizzo che Google riporta come autorizzante. */
  googleEmail: string;
  /** Refresh token in chiaro: entra qui e non ne esce mai più. */
  refreshToken: string;
  scope?: string;
  calendarId?: string;
  calendarName?: string;
}

/**
 * Custodia delle autorizzazioni Google Calendar.
 *
 * Il refresh token è l'unica cosa che permette di scrivere nel calendario di
 * una persona per mesi senza chiederle più nulla: sta in Postgres, ma
 * **cifrato con il Transit di OpenBao**, mai in chiaro. Chi leggesse il
 * database — un backup finito dove non doveva, una copia di sviluppo — non ci
 * troverebbe niente di utilizzabile senza anche il permesso di decifrare su
 * OpenBao.
 *
 * CHIAVE SEPARATA da quella dei documenti clinici. Stessa engine `transit`,
 * stesso schema per tenant (che è ciò che rende possibile il crypto-shredding
 * all'offboarding), ma chiave propria: ruotare la chiave dei token dopo un
 * sospetto non deve costringere a ri-wrappare ogni documento clinico, e
 * viceversa. Un refresh token è sostituibile — al peggio l'utente
 * riautorizza — un documento clinico no, e la prudenza che merita il secondo
 * non deve bloccare la manutenzione del primo.
 */
@Injectable()
export class GoogleCalendarConnectionService {
  private readonly logger = new Logger(GoogleCalendarConnectionService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly transit: TransitEncryptionService,
  ) {}

  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get repo() {
    return this.dataSource.getRepository(GoogleCalendarConnection);
  }

  private get tenantAlias(): string {
    const alias = this.tenantContext.getTenantAlias();
    if (!alias) throw new Error('No tenant alias in current request context');
    return alias;
  }

  /**
   * Chiave Transit dei token, per tenant.
   *
   * Va creata in OpenBao prima dell'uso — il Transit non le crea da solo:
   *   bao write -f transit/keys/clinico-oauth-<alias> type=aes256-gcm96
   * e la policy dell'AppRole deve consentire il prefisso `clinico-oauth-*`.
   */
  private transitKeyName(): string {
    const prefix = process.env.OAUTH_TRANSIT_KEY_PREFIX || 'clinico-oauth';
    return `${prefix}-${this.tenantAlias}`;
  }

  /**
   * Salva (o sostituisce) l'autorizzazione di un utente.
   *
   * Sostituisce invece di accodare: due autorizzazioni sullo stesso utente
   * vorrebbero dire due calendari che si contendono gli stessi eventi, senza
   * modo di sapere quale sia quello buono.
   */
  async save(params: SaveConnectionParams): Promise<GoogleCalendarConnection> {
    const keyName = this.transitKeyName();
    const encrypted = await this.transit.encrypt({
      keyName,
      plaintext: params.refreshToken,
    });

    const existing = await this.repo.findOne({
      where: { ownerType: params.ownerType, ownerId: params.ownerId },
    });

    const connection = this.repo.create({
      ...(existing ?? {}),
      ownerType: params.ownerType,
      ownerId: params.ownerId,
      googleEmail: params.googleEmail,
      calendarId: params.calendarId ?? existing?.calendarId,
      calendarName: params.calendarName ?? existing?.calendarName,
      scope: params.scope,
      encKeyName: keyName,
      // Si conserva la stringa "vault:vN:..." e non i byte grezzi: è il
      // formato che serve al rewrap quando la chiave viene ruotata.
      encRefreshToken: encrypted.ciphertextString,
      status: GoogleCalendarConnectionStatus.ACTIVE,
      connectedAt: new Date(),
      lastErrorAt: undefined,
      lastErrorMessage: undefined,
    });

    const saved = await this.repo.save(connection);
    this.logger.log(
      `Collegamento Google Calendar salvato: ${params.ownerType}/${params.ownerId} → ${params.googleEmail}`,
    );
    return saved;
  }

  /** Collegamento di un utente, senza il token (che non deve girare). */
  async findByOwner(
    ownerType: GoogleCalendarOwnerType,
    ownerId: string,
  ): Promise<GoogleCalendarConnection | null> {
    return this.repo.findOne({ where: { ownerType, ownerId } });
  }

  /**
   * Refresh token in chiaro, decifrato al momento.
   *
   * Da chiamare solo quando serve davvero parlare con Google, e senza
   * conservare il risultato: il token in chiaro deve vivere il meno possibile
   * e non finire in nessuna cache, log o risposta GraphQL.
   */
  async getRefreshToken(connection: GoogleCalendarConnection): Promise<string> {
    return this.transit.decrypt({
      keyName: connection.encKeyName,
      ciphertext: connection.encRefreshToken,
    });
  }

  /** Aggiorna il nome del calendario dopo una rinomina andata a buon fine. */
  async updateCalendarName(connectionId: string, calendarName: string): Promise<void> {
    await this.repo.update(connectionId, { calendarName });
  }

  /**
   * Segna una sincronizzazione riuscita, e con essa fin dove siamo arrivati.
   *
   * I segnalibri sono facoltativi perche' chi scrive UN evento — il push
   * immediato — non ha attraversato nessuna finestra e non ha niente da
   * dichiarare: passarli sarebbe dire "sono allineato fino a ora" avendo
   * guardato un appuntamento solo, e il giro successivo salterebbe tutti gli
   * altri.
   */
  async markSynced(
    connectionId: string,
    watermarks?: {
      syncedThroughAt?: Date;
      prunedThroughDate?: string;
    },
  ): Promise<void> {
    await this.repo.update(connectionId, {
      lastSyncAt: new Date(),
      status: GoogleCalendarConnectionStatus.ACTIVE,
      lastErrorAt: undefined,
      lastErrorMessage: undefined,
      // `undefined` non finisce nella UPDATE: un segnalibro non passato resta
      // quello di prima invece di essere azzerato.
      ...(watermarks ?? {}),
    });
  }

  /**
   * Segna che a questo collegamento e' toccata la riversata integrale.
   *
   * Si chiama PRIMA di provarci, non dopo: il turno si consuma al tentativo.
   * Segnandolo alla riuscita, un collegamento in avaria — o semplicemente un
   * operatore senza appuntamenti, che non ha niente da riversare — resterebbe
   * per sempre il piu' arretrato di tutti, si prenderebbe l'unico turno di
   * ogni giro e lascerebbe gli altri senza la loro integrale quotidiana.
   *
   * Che sia andata bene o male lo dicono `lastSyncAt` e `syncedThroughAt`,
   * che sono un'altra cosa: questo campo tiene il turno, non l'esito.
   */
  async markFullSweepAttempt(connectionId: string, at: Date): Promise<void> {
    await this.repo.update(connectionId, { lastFullSyncAt: at });
  }

  /**
   * Segna un errore di sincronizzazione.
   *
   * `EXPIRED` è diverso da `ERROR` perché richiede un'azione diversa: il
   * primo si risolve solo riautorizzando (e la UI deve dirlo), il secondo
   * spesso si risolve da solo al tentativo successivo.
   */
  async markError(
    connectionId: string,
    message: string,
    expired = false,
  ): Promise<void> {
    await this.repo.update(connectionId, {
      status: expired
        ? GoogleCalendarConnectionStatus.EXPIRED
        : GoogleCalendarConnectionStatus.ERROR,
      lastErrorAt: new Date(),
      lastErrorMessage: message.slice(0, 1000),
    });
  }

  /**
   * Revoca il collegamento: il token cifrato viene **rimosso**, non solo
   * marcato. Un segreto che resta in tabella dopo la revoca è un segreto che
   * continua a esistere senza motivo.
   *
   * La riga resta, con stato REVOKED: serve a spiegare all'utente perché il
   * calendario ha smesso di aggiornarsi.
   */
  async revoke(
    ownerType: GoogleCalendarOwnerType,
    ownerId: string,
  ): Promise<GoogleCalendarConnection> {
    const connection = await this.findByOwner(ownerType, ownerId);
    if (!connection) throw new NotFoundException('Collegamento non trovato');

    connection.encRefreshToken = '';
    connection.status = GoogleCalendarConnectionStatus.REVOKED;
    connection.calendarId = undefined;
    await this.repo.save(connection);

    this.logger.log(`Collegamento Google Calendar revocato: ${ownerType}/${ownerId}`);
    return connection;
  }

  /**
   * Ri-wrappa i token sulla versione corrente della chiave Transit.
   *
   * Da lanciare dopo una rotazione: senza, i token restano leggibili (Transit
   * decifra anche le versioni vecchie) ma la rotazione non protegge niente,
   * perché il materiale vecchio resta quello in uso.
   */
  async rewrapAll(): Promise<number> {
    const keyName = this.transitKeyName();
    const active = await this.repo.find({
      where: { status: GoogleCalendarConnectionStatus.ACTIVE },
    });

    let rewrapped = 0;
    for (const connection of active) {
      if (!connection.encRefreshToken) continue;
      try {
        const result = await this.transit.rewrap({
          keyName: connection.encKeyName || keyName,
          ciphertext: connection.encRefreshToken,
        });
        await this.repo.update(connection.id, {
          encRefreshToken: result.ciphertextString,
          encKeyName: connection.encKeyName || keyName,
        });
        rewrapped++;
      } catch (err) {
        this.logger.error(
          `Rewrap fallito per collegamento ${connection.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(`Rewrap completato: ${rewrapped}/${active.length} collegamenti`);
    return rewrapped;
  }
}

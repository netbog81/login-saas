import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabaseCredentialManagerBase, OpenbaoBaseService } from '@curandis/openbao-core';
import { CredentialSourceTracker } from '../health/credential-source-tracker.service';

const EXPECTED_DATABASE = process.env.DB_DATABASE || 'calendar_db';

const POSTGRES_AUTH_ERROR_CODE = '28P01';

/**
 * Riconosce errori di autenticazione PostgreSQL (codice SQLSTATE 28P01,
 * "invalid_password"). TypeORM espone l'errore in modi diversi a seconda
 * di dove esce: a volte come `error.code`, a volte come `error.driverError.code`.
 */
function isPostgresAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; driverError?: { code?: string } };
  return e.code === POSTGRES_AUTH_ERROR_CODE || e.driverError?.code === POSTGRES_AUTH_ERROR_CODE;
}

@Injectable()
export class MainDbCredentialManager extends DatabaseCredentialManagerBase {
  private readonly dbLogger = new Logger(MainDbCredentialManager.name);
  /** Single-flight guard per evitare refresh concorrenti su 28P01 sotto carico. */
  private recoveryInFlight: Promise<void> | null = null;

  constructor(
    @InjectDataSource() mainDataSource: DataSource,
    eventEmitter: EventEmitter2,
    private readonly openbaoService: OpenbaoBaseService,
    @Optional() private readonly credentialSourceTracker?: CredentialSourceTracker,
  ) {
    super(mainDataSource, eventEmitter, {
      dataSourceName: 'main',
      eventName: 'credentials.main-db.rotated',
    });
  }

  /**
   * Override: forza il database corretto prima della riconnessione
   * e verifica dopo che il database effettivo sia quello atteso.
   *
   * Difesa contro la configurazione OpenBao che punta a curandis_main_db
   * mentre il database corretto e' calendar_db.
   */
  override async handleRotation(credentials: { username: string; password: string }): Promise<void> {
    // Forza il database corretto nelle options PRIMA della riconnessione
    const options = this.dataSource.options as any;
    const previousDb = options.database;

    if (previousDb !== EXPECTED_DATABASE) {
      this.dbLogger.warn(
        `Database nelle options era "${previousDb}", forzato a "${EXPECTED_DATABASE}" prima della rotazione`,
      );
    }
    options.database = EXPECTED_DATABASE;

    this.dbLogger.log(
      `Rotazione credenziali: user=${credentials.username}, database forzato=${EXPECTED_DATABASE}`,
    );

    // Esegui la riconnessione standard (destroy + initialize)
    await super.handleRotation(credentials);

    // Verifica il database effettivo dopo la riconnessione
    await this.verifyCurrentDatabase();
  }

  /**
   * Esegue una query proteggendola da credenziali stale: se PostgreSQL
   * risponde 28P01 (auth error), forza un refresh delle credenziali da
   * OpenBao e riconnette il DataSource, poi ritenta la query una volta.
   *
   * Pattern utile quando OpenBao ruota le password fra due refresh
   * periodici dell'OpenbaoBaseService (default ogni 6h): il backend
   * potrebbe avere credenziali cached stale per la finestra di tempo
   * fra rotation e prossimo refresh.
   *
   * Idempotency: il recovery è single-flight; se più query in volo
   * incontrano 28P01 contemporaneamente, fanno tutte un solo refresh.
   *
   * Uso opzionale: la classe base continua a gestire il path event-driven
   * (rotation rilevata da OpenbaoBaseService → emit → handleRotation).
   * Questo wrapper copre solo la finestra di vulnerabilità.
   */
  async safeQuery<T = unknown>(query: string, parameters?: unknown[]): Promise<T> {
    try {
      return await this.dataSource.query(query, parameters);
    } catch (err) {
      if (!isPostgresAuthError(err)) throw err;

      // Disambigua il caso "credenziali OpenBao stale" (recuperabile via
      // force-refresh) vs "credenziali fasulle dal .env" (NON recuperabile,
      // richiede riavvio con OpenBao raggiungibile). I sintomi al log
      // erano identici prima del 2026-06-02 e generavano confusione coi
      // bug del token stale OpenBao.
      if (this.credentialSourceTracker && !this.credentialSourceTracker.isUsingOpenbao()) {
        this.dbLogger.error(
          `28P01 con credenziali da .env (ALLOW_DEV_FALLBACK). Non c'è force-refresh che possa risolverlo: ` +
          `riavvia il backend con OpenBao raggiungibile per ottenere credenziali valide.`,
        );
        throw err;
      }

      this.dbLogger.warn(
        `Query fallita con auth error 28P01 (credenziali OpenBao probabilmente stale): ` +
        `tento recovery via forceRefresh`,
      );
      await this.recoverFromAuthError();

      // Retry una volta sola dopo il recovery. Se anche questo fallisce,
      // propaga l'errore al caller (probabilmente OpenBao è giù o le
      // credenziali sono permanentemente errate).
      return await this.dataSource.query(query, parameters);
    }
  }

  /**
   * Forza il refresh delle credenziali da OpenBao e riconnette il
   * DataSource. Single-flight: chiamate concorrenti condividono lo
   * stesso refresh.
   */
  private async recoverFromAuthError(): Promise<void> {
    if (this.recoveryInFlight) return this.recoveryInFlight;

    this.recoveryInFlight = (async () => {
      try {
        const fresh = await this.openbaoService.forceRefreshDatabaseCredentials('main-db');
        if (!fresh) {
          throw new Error('forceRefreshDatabaseCredentials("main-db") ha ritornato null');
        }
        this.dbLogger.log(
          `forceRefresh OK: nuovo user="${fresh.username}", riconnetto DataSource`,
        );
        await this.handleRotation(fresh);
      } finally {
        this.recoveryInFlight = null;
      }
    })();

    return this.recoveryInFlight;
  }

  /**
   * Verifica che il database effettivo corrisponda a quello atteso.
   */
  async verifyCurrentDatabase(): Promise<void> {
    try {
      const [row] = await this.dataSource.query('SELECT current_database() AS db');
      const actualDb = row?.db;

      if (actualDb !== EXPECTED_DATABASE) {
        this.dbLogger.error(
          `DATABASE MISMATCH CRITICO: connesso a "${actualDb}" invece di "${EXPECTED_DATABASE}"! ` +
          `Options.database="${(this.dataSource.options as any).database}"`,
        );
      } else {
        this.dbLogger.log(`Database verificato: ${actualDb}`);
      }
    } catch (err: any) {
      this.dbLogger.error(`Impossibile verificare il database corrente: ${err?.message}`);
    }
  }
}

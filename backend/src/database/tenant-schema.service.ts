import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Gestisce la creazione degli schema PostgreSQL per i tenant.
 *
 * Lo schemaName viene dall'Internal JWT (generato dall'Auth App).
 * La Main App:
 * 1. Riceve schemaName dal JWT
 * 2. Se lo schema non esiste nel DB → lo crea + migrazioni
 * 3. Notifica Auth App: POST /auth/api/confirm-schema-created
 */
@Injectable()
export class TenantSchemaService {
  private readonly logger = new Logger(TenantSchemaService.name);
  private readonly TMS_URL = process.env.TMS_URL || process.env.AUTH_API_URL || 'https://api.curandis.cloud';

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Verifica se uno schema esiste nel database.
   */
  async schemaExists(schemaName: string): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
      [schemaName],
    );
    return result.length > 0;
  }

  /**
   * Verifica se uno schema ha almeno una tabella (migrazioni già eseguite).
   */
  async schemaHasTables(schemaName: string): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 LIMIT 1`,
      [schemaName],
    );
    return result.length > 0;
  }

  /**
   * Provisioning schema per un tenant.
   * Lo schemaName arriva dal JWT dell'Auth App.
   *
   * @param schemaName - nome schema dal JWT (es. "t_abc123")
   * @param tenantId - UUID/alias del tenant dall'Auth App
   * @param authCookie - cookie per autenticare la callback all'Auth API
   */
  async provisionTenantSchema(
    schemaName: string,
    tenantId: string,
    authCookie: string,
  ): Promise<void> {
    // Verifica se lo schema esiste gia' e se ha tabelle
    const exists = await this.schemaExists(schemaName);
    if (exists) {
      const hasTables = await this.schemaHasTables(schemaName);
      if (hasTables) {
        this.logger.log(`Schema "${schemaName}" gia' esistente con tabelle per tenant "${tenantId}"`);
        return;
      }
      // Schema esiste ma è vuoto (es. creato manualmente o da vecchio flusso automatico)
      this.logger.warn(`Schema "${schemaName}" esiste ma è vuoto, eseguo le migrazioni...`);
    }

    this.logger.log(`Provisioning schema "${schemaName}" per tenant "${tenantId}"...`);

    // 1. Crea schema
    await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // 2. Esegui migrazioni nello schema del tenant
    await this.runMigrationsInSchema(schemaName);

    // 3. Notifica Auth App che lo schema e' stato creato
    await this.confirmSchemaCreated(tenantId, authCookie);

    this.logger.log(`Provisioning completato: tenant "${tenantId}" -> schema "${schemaName}"`);
  }

  /**
   * Esegue tutte le migrazioni TypeORM all'interno di uno schema specifico.
   * Crea un DataSource temporaneo con lo schema del tenant.
   */
  private async runMigrationsInSchema(schemaName: string): Promise<void> {
    this.logger.log(`Esecuzione migrazioni nello schema "${schemaName}"...`);

    const pgOptions = this.dataSource.options as PostgresConnectionOptions;
    const tenantDataSource = new DataSource({
      type: 'postgres',
      host: pgOptions.host,
      port: pgOptions.port,
      username: pgOptions.username,
      password: pgOptions.password,
      database: pgOptions.database,
      schema: schemaName,
      // Forza search_path al livello libpq (l'opzione `schema` di TypeORM da
      // sola NON imposta il search_path della connection: senza questa, le
      // migrazioni che usano nomi non qualificati finiscono su `public`).
      extra: {
        options: `-c search_path="${schemaName}"`,
      },
      entities: this.dataSource.options.entities as any[],
      migrations: this.dataSource.options.migrations as any[],
      migrationsRun: false,
      migrationsTableName: 'migrations',
      synchronize: false,
      logging: false,
    });

    await tenantDataSource.initialize();

    try {
      await tenantDataSource.runMigrations();
      this.logger.log(`Migrazioni completate per schema "${schemaName}"`);
    } finally {
      await tenantDataSource.destroy();
    }
  }

  /**
   * Notifica il TMS che lo schema e' stato creato.
   * POST /tms/api/confirm-schema-created { tenantId }
   * Il TMS aggiorna: tenant.status pending_schema -> active
   */
  private async confirmSchemaCreated(
    tenantId: string,
    bearerToken: string,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.TMS_URL}/tms/api/confirm-schema-created`,
          { tenantId },
          {
            headers: { Authorization: `Bearer ${bearerToken}` },
          },
        ),
      );
      this.logger.log(`TMS notificato: schema creato per tenant "${tenantId}"`);
    } catch (error: any) {
      this.logger.warn(
        `Impossibile notificare TMS per tenant "${tenantId}": ${error?.message}`,
      );
      // Non blocchiamo il provisioning se la notifica fallisce
    }
  }

  /**
   * Restituisce nome del database e host della connessione corrente.
   */
  getConnectionInfo(): { databaseName: string; databaseHost: string } {
    const pgOptions = this.dataSource.options as PostgresConnectionOptions;
    const host = pgOptions.host || 'localhost';
    const port = pgOptions.port || 5432;
    return {
      databaseName: pgOptions.database || '',
      databaseHost: `${host}:${port}`,
    };
  }
}

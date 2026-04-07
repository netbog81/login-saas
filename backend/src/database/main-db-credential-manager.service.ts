import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabaseCredentialManagerBase } from '@curandis/openbao-core';

const EXPECTED_DATABASE = process.env.DB_DATABASE || 'calendar_db';

@Injectable()
export class MainDbCredentialManager extends DatabaseCredentialManagerBase {
  private readonly dbLogger = new Logger(MainDbCredentialManager.name);

  constructor(
    @InjectDataSource() mainDataSource: DataSource,
    eventEmitter: EventEmitter2,
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

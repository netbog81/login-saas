import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

export type CredentialSource = 'openbao' | 'env-fallback';

const EXPECTED_DATABASE = process.env.DB_DATABASE || 'calendar_db';

@Injectable()
export class CredentialSourceTracker {
  private readonly logger = new Logger(CredentialSourceTracker.name);
  private source: CredentialSource = 'env-fallback';
  private openbaoUsername: string | null = null;
  private bootstrapTime: Date = new Date();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  setSource(source: CredentialSource, username: string): void {
    this.source = source;
    this.openbaoUsername = username;
    this.bootstrapTime = new Date();
  }

  getSource(): CredentialSource {
    return this.source;
  }

  getUsername(): string | null {
    return this.openbaoUsername;
  }

  getBootstrapTime(): Date {
    return this.bootstrapTime;
  }

  isUsingOpenbao(): boolean {
    return this.source === 'openbao';
  }

  /**
   * Verifica ogni 30 minuti che il database effettivo sia quello atteso.
   * Difesa contro drift silenzioso della connessione.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async verifyDatabase(): Promise<void> {
    try {
      const [row] = await this.dataSource.query('SELECT current_database() AS db');
      const actualDb = row?.db;

      if (actualDb !== EXPECTED_DATABASE) {
        this.logger.error(
          `DATABASE MISMATCH: connesso a "${actualDb}" invece di "${EXPECTED_DATABASE}"!`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`Health check database fallito: ${err?.message}`);
    }
  }
}

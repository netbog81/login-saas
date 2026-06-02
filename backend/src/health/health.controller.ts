import { Controller, Get, HttpCode, HttpStatus, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OpenbaoBaseService } from '@curandis/openbao-core';
import { CredentialSourceTracker } from './credential-source-tracker.service';
import { HealthAdminGuard } from './health-admin.guard';
import { MainDbCredentialManager } from '../database/main-db-credential-manager.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly tracker: CredentialSourceTracker,
    private readonly openbaoService: OpenbaoBaseService,
    private readonly mainDbManager: MainDbCredentialManager,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * GET /health/status
   * Endpoint pubblico (no auth): destinato a monitoring esterno
   * (Uptime Kuma, Healthchecks.io, load balancer).
   *
   * Risponde 200 OK se tutto a posto, 503 se vault o DB sono giù.
   * Payload minimale: niente username, niente errori esposti.
   * Per debug umano usare /health/openbao e /health/db-credentials
   * (autenticati, ricchi di dettagli).
   *
   * Il check DB è un SELECT 1 secco sul DataSource (non safeQuery):
   * vogliamo che il monitoring veda "503" quando ci sono credenziali
   * stale, così l'incident è visibile invece di essere mascherato
   * da un force-refresh innescato dall'health probe.
   */
  @Get('status')
  async checkStatus(@Res({ passthrough: true }) res: Response) {
    let vaultOk = false;
    try {
      // getCachedDatabaseCredentials è puro (no chiamata HTTP a OpenBao):
      // se manca, vuol dire che il bootstrap o il refresh periodico non
      // ha mai avuto successo → vault non utilizzabile.
      vaultOk = !!this.openbaoService.getCachedDatabaseCredentials('main-db');
    } catch {
      vaultOk = false;
    }

    let dbOk = false;
    try {
      await this.dataSource.query('SELECT 1');
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const credentialsOk = this.tracker.isUsingOpenbao();
    const allOk = vaultOk && dbOk && credentialsOk;

    if (!allOk) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: allOk ? 'ok' : 'degraded',
      checks: {
        vault: vaultOk ? 'ok' : 'error',
        database: dbOk ? 'ok' : 'error',
        credentials: credentialsOk ? 'ok' : 'fallback',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /health/live
   * Liveness probe: ritorna sempre 200 finché il processo node è in vita
   * e Nest gira. Niente check esterni. Adatto a Docker HEALTHCHECK o
   * Kubernetes livenessProbe (devono dire "il container è da killare?",
   * non "i suoi dipendenti sono ok?").
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  /**
   * GET /health/openbao
   * Protetto: richiede autenticazione + ruolo admin.
   * Verifica se l'agent proxy OpenBao e' raggiungibile.
   */
  @Get('openbao')
  @UseGuards(HealthAdminGuard)
  async checkOpenbao() {
    try {
      const creds = await this.openbaoService.getDatabaseCredentials('main-db');
      return {
        status: 'ok',
        agentProxy: process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200',
        reachable: true,
        currentUser: creds?.username ?? null,
      };
    } catch (error) {
      return {
        status: 'error',
        agentProxy: process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200',
        reachable: false,
        error: error.message,
      };
    }
  }

  /**
   * GET /health/db-credentials
   * Protetto: richiede autenticazione + ruolo admin.
   * Mostra la fonte delle credenziali DB e verifica la connessione.
   */
  @Get('db-credentials')
  @UseGuards(HealthAdminGuard)
  async checkDbCredentials() {
    const source = this.tracker.getSource();
    const username = this.tracker.getUsername();
    const bootstrapTime = this.tracker.getBootstrapTime();

    // Verifica connessione DB reale
    let dbConnected = false;
    let dbCurrentUser: string | null = null;
    let dbName: string | null = null;
    try {
      // safeQuery: recovery automatico se 28P01 (vedi commento in /health/status).
      const result = await this.mainDbManager.safeQuery<Array<{ user: string; database: string }>>(
        'SELECT current_user AS user, current_database() AS database',
      );
      dbConnected = true;
      dbCurrentUser = result[0]?.user ?? null;
      dbName = result[0]?.database ?? null;
    } catch {
      dbConnected = false;
    }

    // Confronta l'utente del bootstrap con quello attivo sulla connessione
    const credentialsMatch = dbCurrentUser === username;

    return {
      status: dbConnected ? 'ok' : 'error',
      credentialSource: source,
      usingOpenbao: source === 'openbao',
      bootstrap: {
        username,
        time: bootstrapTime.toISOString(),
      },
      database: {
        connected: dbConnected,
        currentUser: dbCurrentUser,
        name: dbName,
        credentialsMatch,
      },
    };
  }
}

import { Controller, Get, UseGuards } from '@nestjs/common';
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
  ) {}

  /**
   * GET /health/status
   * Endpoint pubblico (no auth): restituisce solo ok/error
   * senza esporre dettagli infrastrutturali.
   */
  @Get('status')
  async checkStatus() {
    let openbaoOk = false;
    try {
      await this.openbaoService.getDatabaseCredentials('main-db');
      openbaoOk = true;
    } catch {
      openbaoOk = false;
    }

    let dbOk = false;
    try {
      // safeQuery: se 28P01 (auth error per credenziali stale), fa recovery
      // automatico via OpenBao + ritenta. Evita che health-check periodici
      // (load balancer / monitoring) marchino il backend come down per
      // una window fra rotation OpenBao e prossimo refresh-check.
      await this.mainDbManager.safeQuery('SELECT 1');
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const allOk = openbaoOk && dbOk && this.tracker.isUsingOpenbao();

    return {
      status: allOk ? 'ok' : 'degraded',
      openbao: openbaoOk ? 'ok' : 'error',
      database: dbOk ? 'ok' : 'error',
      credentials: this.tracker.isUsingOpenbao() ? 'ok' : 'fallback',
    };
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

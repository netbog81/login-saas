import { Controller, Get, HttpCode, HttpStatus, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { OpenbaoBaseService } from '@curandis/openbao-core';
import { HealthAdminGuard } from './health-admin.guard';

const VAULT_HEALTH_TIMEOUT_MS = 3000;

interface VaultHealthStatus {
  reachable: boolean;
  httpStatus?: number;
  sealed?: boolean;
  standby?: boolean;
  error?: string;
}

async function probeVaultEndpoint(endpoint: string): Promise<VaultHealthStatus> {
  const url = `${endpoint.replace(/\/$/, '')}/v1/sys/health`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), VAULT_HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'GET', signal: ac.signal });
    let body: { sealed?: boolean; standby?: boolean } = {};
    try {
      body = (await res.json()) as { sealed?: boolean; standby?: boolean };
    } catch {
      // /v1/sys/health può rispondere senza body in alcuni casi
    }
    return {
      reachable: true,
      httpStatus: res.status,
      sealed: body.sealed,
      standby: body.standby,
    };
  } catch (err) {
    return { reachable: false, error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

@Controller('health')
export class HealthController {
  constructor(private readonly openbaoService: OpenbaoBaseService) {}

  /**
   * GET /health/status
   * Endpoint pubblico (no auth): destinato a monitoring esterno
   * (Uptime Kuma, Healthchecks.io, load balancer).
   *
   * Risponde 200 OK se l'agent OpenBao è raggiungibile e unsealed, 503 altrimenti.
   *
   * Architettura DB-per-tenant: NON include check DB qui (non c'è un main DB
   * globale, ogni tenant ha il suo). Il check DB tenant-specifico potrebbe
   * essere fatto solo a fronte di una request autenticata che porta un
   * tenantAlias — non adatto a monitoring esterno anonimo.
   */
  @Get('status')
  async getStatus(@Res({ passthrough: true }) res: Response) {
    const endpoint = process.env.OPENBAO_ADDR || 'http://127.0.0.1:8203';
    const vault = await probeVaultEndpoint(endpoint);

    const vaultOk = vault.reachable && vault.sealed === false;

    if (!vaultOk) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: vaultOk ? 'ok' : 'degraded',
      service: 'curandis-clinico',
      checks: {
        vault: vaultOk ? 'ok' : 'error',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /health/live
   * Liveness probe: ritorna sempre 200 finché il processo node è in vita.
   * Adatto a Docker HEALTHCHECK / Kubernetes livenessProbe.
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  /**
   * GET /health/openbao
   * Protetto: richiede autenticazione + ruolo admin.
   * Diagnostica più dettagliata dello stato OpenBao.
   */
  @Get('openbao')
  @UseGuards(HealthAdminGuard)
  async checkOpenbao() {
    const endpoint = process.env.OPENBAO_ADDR || 'http://127.0.0.1:8203';
    const vault = await probeVaultEndpoint(endpoint);
    return {
      status: vault.reachable && vault.sealed === false ? 'ok' : 'error',
      agentProxy: endpoint,
      reachable: vault.reachable,
      sealed: vault.sealed,
      standby: vault.standby,
      httpStatus: vault.httpStatus,
      error: vault.error,
    };
  }
}

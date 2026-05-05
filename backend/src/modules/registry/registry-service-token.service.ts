import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Ottiene un access token "di sistema" da Keycloak via grant_type=client_credentials,
 * usato per chiamate server-to-server verso il registry quando NON c'è un JWT
 * utente nel contesto (es. fire-and-forget WhatsApp dispatch dopo create appointment,
 * cron job notturni, consumer RabbitMQ con refresh sincrono di cache, ...).
 *
 * Lettura credenziali (in ordine):
 *  1. OpenBao Agent: kv/data/keycloak/clinico-service { client_id, client_secret }
 *  2. Fallback env: KEYCLOAK_CLINICO_SERVICE_CLIENT_ID + _CLIENT_SECRET (solo dev)
 *
 * Cache token in memoria con TTL = (exp - 30s) per ridurre le chiamate a Keycloak.
 *
 * NOTA multi-realm: oggi il realm è quello globale (`curandis`). Quando si farà
 * la migrazione multi-realm, basterà cambiare la URL del realm in 1 punto qui.
 */
@Injectable()
export class RegistryServiceTokenService implements OnModuleInit {
  private readonly logger = new Logger(RegistryServiceTokenService.name);

  private readonly OPENBAO_ADDR: string;
  private readonly KEYCLOAK_URL: string;
  private readonly REALM: string;

  private clientId = '';
  private clientSecret = '';

  /** Token cache: validi fino a `expiresAt` (epoch ms). */
  private cachedToken: string | null = null;
  private expiresAt = 0;
  private inflight: Promise<string> | null = null;

  constructor(config: ConfigService) {
    this.OPENBAO_ADDR = config.get<string>('OPENBAO_ADDR', 'http://127.0.0.1:8200');
    this.KEYCLOAK_URL = config.get<string>('KEYCLOAK_URL', 'https://my.curandis.cloud');
    this.REALM = config.get<string>('KEYCLOAK_REALM', 'curandis');
  }

  async onModuleInit(): Promise<void> {
    await this.loadCredentials();
    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'Credenziali clinico-service mancanti. ' +
          'Le chiamate S2S verso il registry NON saranno disponibili (es. WhatsApp dispatch).',
      );
    } else {
      this.logger.log(
        `Service account clinico pronto: clientId="${this.clientId}", realm="${this.REALM}"`,
      );
    }
  }

  /**
   * Restituisce un access token valido. Usa cache + single-flight per
   * evitare chiamate concorrenti a Keycloak.
   */
  async getToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.expiresAt) {
      return this.cachedToken;
    }
    if (this.inflight) return this.inflight;

    this.inflight = this.fetchToken().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async fetchToken(): Promise<string> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'RegistryServiceTokenService: credenziali non configurate. ' +
          'Configurare kv/data/keycloak/clinico-service in OpenBao.',
      );
    }

    const tokenUrl = `${this.KEYCLOAK_URL}/realms/${this.REALM}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const startedAt = Date.now();
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(
        `client_credentials fallito (${res.status}): ${errText.substring(0, 300)}`,
      );
      throw new Error(`Keycloak client_credentials failed: ${res.status}`);
    }

    const json = (await res.json()) as { access_token: string; expires_in: number };
    if (!json?.access_token) {
      throw new Error('Keycloak client_credentials: access_token mancante nella response');
    }

    // Cache TTL = expires_in - 30s di safety margin
    const ttlMs = Math.max(10_000, (json.expires_in - 30) * 1000);
    this.cachedToken = json.access_token;
    this.expiresAt = Date.now() + ttlMs;

    this.logger.debug(
      `Token clinico-service ottenuto in ${Date.now() - startedAt}ms (TTL ${ttlMs}ms)`,
    );
    return this.cachedToken;
  }

  // ==================== INTERNAL: load credentials ====================

  private async loadCredentials(): Promise<void> {
    const fromOpenbao = await this.tryLoadFromOpenbao();
    if (fromOpenbao) return;
    this.fallbackToEnvVars();
  }

  private async tryLoadFromOpenbao(): Promise<boolean> {
    try {
      const url = `${this.OPENBAO_ADDR}/v1/kv/data/keycloak/clinico-service`;
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.warn(
          `OpenBao: read kv/data/keycloak/clinico-service → HTTP ${res.status}`,
        );
        return false;
      }
      const body = (await res.json()) as { data?: { data?: { client_id?: string; client_secret?: string } } };
      const data = body?.data?.data;
      if (!data?.client_id || !data?.client_secret) {
        this.logger.warn(
          `OpenBao: kv/data/keycloak/clinico-service senza client_id/client_secret`,
        );
        return false;
      }
      this.clientId = data.client_id;
      this.clientSecret = data.client_secret;
      this.logger.log('Credenziali clinico-service caricate da OpenBao');
      return true;
    } catch (err) {
      this.logger.warn(
        `OpenBao non raggiungibile per clinico-service: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private fallbackToEnvVars(): void {
    if (process.env.NODE_ENV === 'development') {
      this.clientId = process.env.KEYCLOAK_CLINICO_SERVICE_CLIENT_ID || '';
      this.clientSecret = process.env.KEYCLOAK_CLINICO_SERVICE_CLIENT_SECRET || '';
      if (this.clientId && this.clientSecret) {
        this.logger.warn('Fallback dev: clinico-service da env vars');
      }
    }
  }
}

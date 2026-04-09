import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

/**
 * Servizio per validazione JWT tramite JWKS di Keycloak.
 *
 * Fetcha le public key direttamente dall'endpoint JWKS del realm Keycloak.
 * La libreria `jose` gestisce automaticamente il caching e il refresh.
 *
 * ISO 27001 A.14.2.5: I JWT sono firmati da Keycloak (fonte autorevole),
 * validati localmente senza chiamate HTTP aggiuntive per ogni request.
 */
@Injectable()
export class JwksService implements OnModuleInit {
  private readonly logger = new Logger(JwksService.name);
  private readonly KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'https://my.curandis.cloud';
  private readonly KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'curandis';
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  async onModuleInit() {
    const jwksUrl = `${this.KEYCLOAK_URL}/realms/${this.KEYCLOAK_REALM}/protocol/openid-connect/certs`;
    this.logger.log(`Keycloak JWKS URL: ${jwksUrl}`);

    try {
      // Prefetch delle chiavi per verificare la connettività a Keycloak
      const response = await fetch(jwksUrl);
      if (!response.ok) {
        this.logger.error(`Keycloak JWKS HTTP ${response.status}: ${response.statusText}`);
        return;
      }
      const jwksData = await response.json() as { keys: any[] };
      this.logger.log(`Keycloak JWKS: ${jwksData.keys?.length || 0} chiavi caricate`);

      this.jwks = createRemoteJWKSet(new URL(jwksUrl));
    } catch (error: any) {
      this.logger.error(`Impossibile raggiungere Keycloak JWKS: ${error?.message}`);
      if (error?.cause) {
        this.logger.error(`Causa: ${error.cause?.message || error.cause}`);
      }
    }
  }

  /**
   * Valida un JWT Keycloak usando le public key JWKS.
   * @returns il payload decodificato o null se la validazione fallisce
   */
  async verifyToken(token: string): Promise<JWTPayload | null> {
    if (!this.jwks) {
      this.logger.warn('JWKS non disponibile — impossibile validare il token');
      return null;
    }

    try {
      // clockTolerance assorbe piccoli sfasamenti d'orologio tra il server NestJS
      // e il Keycloak IdP (NTP drift). Senza questa opzione, jose rifiuta il token
      // anche per pochi secondi di disallineamento causando falsi "exp expired".
      const { payload } = await jwtVerify(token, this.jwks, {
        clockTolerance: '30s',
      });
      return payload;
    } catch (error: any) {
      const cause = error?.cause?.message || '';
      this.logger.debug(`Validazione JWKS fallita: ${error?.message}${cause ? ` (${cause})` : ''}`);
      return null;
    }
  }
}

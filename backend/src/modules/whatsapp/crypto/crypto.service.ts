import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12;
  private readonly authTagLength = 16;
  private readonly OPENBAO_ADDR = process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200';

  // Cache con TTL 10 minuti
  private readonly keyCache = new Map<string, { key: Buffer; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 10 * 60 * 1000;

  /**
   * Recupera la encryption key da OpenBao (kv/data/whatsapp/{tenantApiId}/encryption_key)
   * con fallback a WHATSAPP_ENCRYPTION_KEY da .env.
   */
  async getEncryptionKey(tenantApiId?: string): Promise<Buffer> {
    const cacheKey = tenantApiId || '__env__';

    // 1. Controlla cache
    const cached = this.keyCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.key;
    }

    // 2. Prova OpenBao se abbiamo il tenantApiId
    if (tenantApiId) {
      try {
        const url = `${this.OPENBAO_ADDR}/v1/kv/data/whatsapp/${encodeURIComponent(tenantApiId)}/encryption_key`;
        const response = await fetch(url);

        if (response.ok) {
          const body = await response.json() as any;
          const data = body?.data?.data;
          // Campi possibili in OpenBao: value, key, encryption_key, secret,
          // oppure data direttamente come stringa. Formato accettato:
          //  - 64-char hex string
          //  - base64 (44 char con padding "=") che decodifica a 32 byte
          const rawKey =
            data?.value ||
            data?.key ||
            data?.encryption_key ||
            data?.secret ||
            (typeof data === 'string' ? data : null);
          const key = this.parseKey(rawKey);
          if (key) {
            this.keyCache.set(cacheKey, { key, cachedAt: Date.now() });
            this.logger.log(`Encryption key loaded from OpenBao for tenant "${tenantApiId}"`);
            return key;
          }
          this.logger.warn(
            `OpenBao: encryption key non valida per tenant "${tenantApiId}" ` +
              `(campi disponibili: ${data ? Object.keys(data).join(',') : 'none'}). ` +
              `Atteso hex 64-char o base64 di 32 byte. Fallback su env.`,
          );
        } else if (response.status !== 404) {
          this.logger.warn(`OpenBao error ${response.status} for tenant "${tenantApiId}" encryption key`);
        }
      } catch (error: any) {
        this.logger.warn(`OpenBao unreachable for encryption key: ${error?.message}, falling back to env`);
      }
    }

    // 3. Fallback: WHATSAPP_ENCRYPTION_KEY da .env
    const keyEnvRaw = process.env.WHATSAPP_ENCRYPTION_KEY;
    const keyEnv = this.parseKey(keyEnvRaw);
    if (!keyEnv) {
      throw new Error(
        'WHATSAPP_ENCRYPTION_KEY non trovata. Configurarla in OpenBao ' +
          '(kv/whatsapp/{tenant}/encryption_key) come hex 64-char o base64 ' +
          'di 32 byte, oppure come variabile env nel formato analogo.',
      );
    }
    this.keyCache.set(cacheKey, { key: keyEnv, cachedAt: Date.now() });
    return keyEnv;
  }

  /**
   * Parsa una chiave AES-256 da stringa. Accetta:
   *  - hex 64 caratteri  (32 byte)
   *  - base64 di 32 byte (44 caratteri con padding `=`, 43 senza)
   * Ritorna null se il formato non è valido.
   */
  private parseKey(raw: string | null | undefined): Buffer | null {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();

    // Hex 64-char
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, 'hex');
    }

    // Base64 → deve decodificare a esattamente 32 byte
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
      try {
        const buf = Buffer.from(trimmed, 'base64');
        if (buf.length === 32) {
          // Sanity: il base64 round-trip deve produrre la stessa stringa
          // (evita falsi positivi su stringhe arbitrarie che caso vuole
          // hanno length 32 una volta decodate)
          if (buf.toString('base64').replace(/=+$/, '') === trimmed.replace(/=+$/, '')) {
            return buf;
          }
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  async encrypt(plaintext: string, tenantApiId?: string): Promise<string> {
    const key = await this.getEncryptionKey(tenantApiId);
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, key, iv, {
      authTagLength: this.authTagLength,
    });

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  async decrypt(encryptedData: string, tenantApiId?: string): Promise<string> {
    const key = await this.getEncryptionKey(tenantApiId);
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const ciphertext = parts[2];

    const decipher = createDecipheriv(this.algorithm, key, iv, {
      authTagLength: this.authTagLength,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  maskValue(value: string, visibleChars = 4): string {
    if (!value || value.length <= visibleChars) {
      return '****';
    }
    return '****' + value.slice(-visibleChars);
  }
}

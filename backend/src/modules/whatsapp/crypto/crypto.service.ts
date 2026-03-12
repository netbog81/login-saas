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
          // Prova diversi campi: value, key, encryption_key, oppure se data è direttamente una stringa
          const keyHex = data?.value || data?.key || data?.encryption_key
            || (typeof data === 'string' ? data : null);
          this.logger.debug(
            `OpenBao response for tenant "${tenantApiId}": keys=${JSON.stringify(data ? Object.keys(data) : null)}, ` +
            `valueType=${typeof keyHex}, valueLength=${keyHex?.length}`,
          );
          if (keyHex && typeof keyHex === 'string' && /^[0-9a-fA-F]{64}$/.test(keyHex)) {
            const key = Buffer.from(keyHex, 'hex');
            this.keyCache.set(cacheKey, { key, cachedAt: Date.now() });
            this.logger.log(`Encryption key loaded from OpenBao for tenant "${tenantApiId}"`);
            return key;
          }
          this.logger.warn(
            `OpenBao: key format invalid for tenant "${tenantApiId}". ` +
            `Got type=${typeof keyHex}, length=${keyHex?.length}. Expected 64-char hex string. Falling back to env.`,
          );
        } else if (response.status !== 404) {
          this.logger.warn(`OpenBao error ${response.status} for tenant "${tenantApiId}" encryption key`);
        }
      } catch (error: any) {
        this.logger.warn(`OpenBao unreachable for encryption key: ${error?.message}, falling back to env`);
      }
    }

    // 3. Fallback: WHATSAPP_ENCRYPTION_KEY da .env
    const keyHex = process.env.WHATSAPP_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
      throw new Error(
        'WHATSAPP_ENCRYPTION_KEY not found. Set it in OpenBao (kv/whatsapp/{tenant}/encryption_key) or as a 64-char hex env variable.',
      );
    }
    const key = Buffer.from(keyHex, 'hex');
    this.keyCache.set(cacheKey, { key, cachedAt: Date.now() });
    return key;
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

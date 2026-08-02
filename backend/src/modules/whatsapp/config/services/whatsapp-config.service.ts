import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { WhatsappTenantConfig } from '../entities/whatsapp-tenant-config.entity';
import { WhatsappConfigInput } from '../dto/whatsapp-config.input';
import { CryptoService } from '../../crypto/crypto.service';

import { TenantContextService } from '@curandis/tenant-datasource';
const MIN_SECRET_LENGTH = 16;

@Injectable()
export class WhatsappConfigService {
  private readonly logger = new Logger(WhatsappConfigService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly cryptoService: CryptoService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get configRepo() { return this.dataSource.getRepository(WhatsappTenantConfig); }

  async getConfig(): Promise<WhatsappTenantConfig | null> {
    const config = await this.configRepo.findOne({ where: {} });
    if (config) {
      config.maskedApiKey = await this.getMaskedApiKey(config);
    }
    return config;
  }

  async upsertConfig(input: WhatsappConfigInput): Promise<WhatsappTenantConfig> {
    let config = await this.configRepo.findOne({ where: {} });

    if (!config) {
      config = this.configRepo.create();
    }

    config.gatewayUrl = input.gatewayUrl;
    config.tenantApiId = input.tenantApiId;

    if (input.isActive !== undefined) {
      config.isActive = input.isActive;
    }

    if (input.sendCancelNotification !== undefined) {
      config.sendCancelNotification = input.sendCancelNotification;
    }

    if (input.sendUpdateNotification !== undefined) {
      config.sendUpdateNotification = input.sendUpdateNotification;
    }

    if (input.recapBufferSeconds !== undefined) {
      // Stessi limiti applicati dal gateway: meglio rifiutare qui che vedersi
      // normalizzare il valore in silenzio dall'altra parte.
      if (input.recapBufferSeconds < 30 || input.recapBufferSeconds > 600) {
        throw new BadRequestException(
          'La finestra di raggruppamento del recap deve essere fra 30 e 600 secondi',
        );
      }
      config.recapBufferSeconds = input.recapBufferSeconds;
    }

    if (input.retentionDays !== undefined) {
      config.retentionDays = input.retentionDays;
    }

    if (input.apiKey) {
      this.assertPlausibleSecret(input.apiKey, 'API key');
      config.apiKeyEncrypted = await this.cryptoService.encrypt(input.apiKey, input.tenantApiId);
    }

    if (input.webhookSecret) {
      this.assertPlausibleSecret(input.webhookSecret, 'Webhook secret');
      config.webhookSecretEncrypted = await this.cryptoService.encrypt(input.webhookSecret, input.tenantApiId);
    }

    const saved = await this.configRepo.save(config);
    saved.maskedApiKey = await this.getMaskedApiKey(saved);
    return saved;
  }

  async getDecryptedApiKey(): Promise<string | null> {
    const config = await this.configRepo.findOne({ where: {} });
    if (!config?.apiKeyEncrypted) return null;
    try {
      return await this.cryptoService.decrypt(config.apiKeyEncrypted, config.tenantApiId);
    } catch (error) {
      this.logger.error('Failed to decrypt API key', error);
      return null;
    }
  }

  async getWebhookSecret(): Promise<string | null> {
    const config = await this.configRepo.findOne({ where: {} });
    if (!config?.webhookSecretEncrypted) return null;
    try {
      return await this.cryptoService.decrypt(config.webhookSecretEncrypted, config.tenantApiId);
    } catch (error) {
      this.logger.error('Failed to decrypt webhook secret', error);
      return null;
    }
  }

  async isWhatsappActive(): Promise<boolean> {
    const config = await this.configRepo.findOne({ where: {} });
    return config?.isActive === true;
  }

  private assertPlausibleSecret(value: string, label: string): void {
    if (value.length < MIN_SECRET_LENGTH) {
      throw new BadRequestException(
        `${label} troppo corta (min ${MIN_SECRET_LENGTH} caratteri). ` +
          `Probabile autofill del browser: cancella il campo e inserisci la chiave reale, ` +
          `oppure lascialo vuoto per mantenere quella già salvata.`,
      );
    }
  }

  private async getMaskedApiKey(config: WhatsappTenantConfig): Promise<string> {
    if (!config.apiKeyEncrypted) return '';
    try {
      const decrypted = await this.cryptoService.decrypt(config.apiKeyEncrypted, config.tenantApiId);
      return this.cryptoService.maskValue(decrypted);
    } catch {
      return '****';
    }
  }
}

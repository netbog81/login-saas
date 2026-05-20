import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappTenantConfig } from '../entities/whatsapp-tenant-config.entity';
import { WhatsappConfigInput } from '../dto/whatsapp-config.input';
import { CryptoService } from '../../crypto/crypto.service';

const MIN_SECRET_LENGTH = 16;

@Injectable()
export class WhatsappConfigService {
  private readonly logger = new Logger(WhatsappConfigService.name);

  constructor(
    @InjectRepository(WhatsappTenantConfig)
    private readonly configRepo: Repository<WhatsappTenantConfig>,
    private readonly cryptoService: CryptoService,
  ) {}

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

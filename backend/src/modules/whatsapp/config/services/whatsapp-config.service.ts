import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { WhatsappTenantConfig } from '../entities/whatsapp-tenant-config.entity';
import { WhatsappConfigInput } from '../dto/whatsapp-config.input';
import { CryptoService } from '../../crypto/crypto.service';

import { TenantContextService } from '@curandis/tenant-datasource';
import { WhatsappReminderEarlyPolicy } from '../../enums/whatsapp-enums';

const MIN_SECRET_LENGTH = 16;

const DEFAULT_REMINDER_WINDOW_START = '08:30';
const DEFAULT_REMINDER_WINDOW_END = '09:00';

/**
 * Sotto i 10 minuti la distribuzione degli invii non ha spazio per lavorare:
 * il rate limit del gateway (10s fra un messaggio e l'altro) li spingerebbe
 * comunque tutti oltre la fine della fascia.
 */
const MIN_REMINDER_WINDOW_MINUTES = 10;

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

    if (input.reminderWindowEnabled !== undefined) {
      config.reminderWindowEnabled = input.reminderWindowEnabled;
    }

    if (input.reminderWindowStart !== undefined) {
      config.reminderWindowStart = input.reminderWindowStart;
    }

    if (input.reminderWindowEnd !== undefined) {
      config.reminderWindowEnd = input.reminderWindowEnd;
    }

    if (input.reminderEarlyPolicy !== undefined) {
      config.reminderEarlyPolicy = input.reminderEarlyPolicy;
    }

    // Sui valori risultanti e non su quelli in input: la fascia si può accendere
    // con una richiesta che non ne ridichiara gli orari.
    this.normalizeAndAssertReminderWindow(config);

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

  /**
   * Riempie i buchi con i default e rifiuta una fascia impossibile.
   *
   * Gli stessi limiti li applica il gateway, che davanti a una fascia incoerente
   * ricade sulle 24h esatte: meglio bloccare qui, altrimenti l'utente salva una
   * fascia che poi non viene mai usata senza capire perché.
   */
  private normalizeAndAssertReminderWindow(config: WhatsappTenantConfig): void {
    config.reminderWindowStart = config.reminderWindowStart || DEFAULT_REMINDER_WINDOW_START;
    config.reminderWindowEnd = config.reminderWindowEnd || DEFAULT_REMINDER_WINDOW_END;
    config.reminderEarlyPolicy =
      config.reminderEarlyPolicy || WhatsappReminderEarlyPolicy.SHIFT_PREVIOUS_DAY;

    const start = this.parseHhMm(config.reminderWindowStart);
    const end = this.parseHhMm(config.reminderWindowEnd);

    if (start === null || end === null) {
      throw new BadRequestException(
        'Gli orari della fascia di invio promemoria devono essere nel formato HH:mm (es. 08:30)',
      );
    }

    if (end - start < MIN_REMINDER_WINDOW_MINUTES) {
      throw new BadRequestException(
        `La fascia di invio promemoria deve durare almeno ${MIN_REMINDER_WINDOW_MINUTES} minuti ` +
          "e la fine deve essere successiva all'inizio",
      );
    }

    if (!Object.values(WhatsappReminderEarlyPolicy).includes(config.reminderEarlyPolicy)) {
      throw new BadRequestException('Politica appuntamenti presto non riconosciuta');
    }
  }

  /** Minuti dalla mezzanotte, o null se il formato non è HH:mm. */
  private parseHhMm(value: string): number | null {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
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

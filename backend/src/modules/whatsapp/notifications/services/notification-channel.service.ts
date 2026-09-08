import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '@curandis/tenant-datasource';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationChannelSetting,
} from '../entities/notification-channel-setting.entity';
import { NotificationChannelSettingInput } from '../dto/notification-channel-setting.input';

/** Driver SMS che il gateway sa usare. Le credenziali di ognuno stanno in OpenBao. */
const SMS_DRIVERS = ['personal_gsm', 'skebby'];

/**
 * Impostazioni per canale: lettura, aggiornamento e — soprattutto — la
 * costruzione del piano di consegna di un singolo messaggio.
 *
 * DB-per-tenant: il repository si prende dal DataSource del contesto a ogni
 * chiamata. `@InjectRepository` qui leggerebbe il database sbagliato e il
 * compilatore non se ne accorgerebbe.
 */
@Injectable()
export class NotificationChannelService {
  private readonly logger = new Logger(NotificationChannelService.name);

  constructor(private readonly tenantContext: TenantContextService) {}

  private get repo() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('Nessun DataSource di tenant nel contesto corrente');
    return ds.getRepository(NotificationChannelSetting);
  }

  /**
   * Le tre righe, sempre tutte e tre.
   *
   * Se una manca la si crea spenta invece di restituire un elenco parziale:
   * un tenant creato prima di questa tabella, o una migration andata a metà,
   * non devono produrre una pagina impostazioni con dei buchi.
   */
  async list(): Promise<NotificationChannelSetting[]> {
    const existing = await this.repo.find({ order: { priority: 'ASC' } });
    const missing = Object.values(NotificationChannel).filter(
      (c) => !existing.some((s) => s.channel === c),
    );

    if (missing.length) {
      this.logger.warn(`Canali mancanti, li creo spenti: ${missing.join(', ')}`);
      await this.repo.save(
        missing.map((channel, i) =>
          this.repo.create({
            channel,
            // WhatsApp è l'unico che può nascere acceso: è da lì che passa
            // tutto oggi, e trovarlo spento sarebbe una regressione muta.
            enabled: channel === NotificationChannel.WHATSAPP,
            categories:
              channel === NotificationChannel.WHATSAPP
                ? Object.values(NotificationCategory)
                : [],
            priority: existing.length + i + 1,
          }),
        ),
      );
      return this.repo.find({ order: { priority: 'ASC' } });
    }

    return existing;
  }

  async update(input: NotificationChannelSettingInput): Promise<NotificationChannelSetting> {
    if (input.smsDriver && !SMS_DRIVERS.includes(input.smsDriver)) {
      throw new BadRequestException(
        `Driver SMS sconosciuto: ${input.smsDriver}. Ammessi: ${SMS_DRIVERS.join(', ')}`,
      );
    }
    if (input.smsDriver && input.channel !== NotificationChannel.SMS) {
      throw new BadRequestException('Il driver si imposta solo sul canale SMS');
    }
    if (input.emailFromName && input.channel !== NotificationChannel.EMAIL) {
      throw new BadRequestException('Il nome mittente si imposta solo sul canale email');
    }

    await this.list(); // garantisce che la riga esista
    const setting = await this.repo.findOne({ where: { channel: input.channel } });
    if (!setting) throw new BadRequestException(`Canale sconosciuto: ${input.channel}`);

    if (input.enabled !== undefined) setting.enabled = input.enabled;
    if (input.categories !== undefined) setting.categories = input.categories;
    if (input.priority !== undefined) setting.priority = input.priority;
    if (input.smsDriver !== undefined) setting.smsDriver = input.smsDriver || null;
    if (input.emailFromName !== undefined) setting.emailFromName = input.emailFromName || null;

    const saved = await this.repo.save(setting);
    this.logger.log(
      `Canale ${saved.channel}: ${saved.enabled ? 'acceso' : 'spento'}, ` +
        `categorie [${saved.categories.join(', ')}], priorità ${saved.priority}`,
    );
    return saved;
  }

  /**
   * Riscrive l'ordine di tentativo dei canali.
   *
   * Mutation separata da `update` e capace di toccare SOLO le priorita':
   * riordinare e' l'unica operazione che per sua natura riguarda tutti i
   * canali insieme, e farla passare da `update` avrebbe significato dare a
   * quella mutation il permesso di scrivere su righe che il chiamante non ha
   * nominato — esattamente cio' che il suo commento promette di non fare.
   *
   * L'elenco deve nominarli tutti: un ordine parziale lascerebbe le priorita'
   * dei canali omessi dove stavano, e due canali potrebbero ritrovarsi con lo
   * stesso numero. Chi legge il piano prenderebbe il primo dei due a caso.
   */
  async reorder(order: NotificationChannel[]): Promise<NotificationChannelSetting[]> {
    const tutti = Object.values(NotificationChannel);
    const doppi = order.filter((c, i) => order.indexOf(c) !== i);
    if (doppi.length) {
      throw new BadRequestException(`Canale ripetuto nell'ordine: ${doppi.join(', ')}`);
    }
    const mancanti = tutti.filter((c) => !order.includes(c));
    if (mancanti.length) {
      throw new BadRequestException(
        `L'ordine deve elencare tutti i canali. Mancano: ${mancanti.join(', ')}`,
      );
    }

    await this.list(); // garantisce che le righe esistano

    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('Nessun DataSource di tenant nel contesto corrente');

    // In transazione perche' un riordino applicato a meta' e' peggio di uno
    // non applicato: lascia due canali alla stessa priorita'.
    await ds.transaction(async (manager) => {
      const repo = manager.getRepository(NotificationChannelSetting);
      for (const [i, channel] of order.entries()) {
        await repo.update({ channel }, { priority: i + 1 });
      }
    });

    this.logger.log(`Ordine canali: ${order.join(' -> ')}`);
    return this.list();
  }
}

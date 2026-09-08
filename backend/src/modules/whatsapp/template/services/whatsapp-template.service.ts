import { Injectable, Logger } from '@nestjs/common';
import { WhatsappMessageTemplate } from '../entities/whatsapp-message-template.entity';
import { WhatsappTemplateInput } from '../dto/whatsapp-template.input';
import { WhatsappTemplateType } from '../../enums/whatsapp-enums';
import { NotificationChannel } from '../../notifications/entities/notification-channel-setting.entity';

import { TenantContextService } from '@curandis/tenant-datasource';
const DEFAULT_TEMPLATES: Record<WhatsappTemplateType, string> = {
  [WhatsappTemplateType.RECAP_SINGLE]:
    'Gentile {name}, confermiamo il suo appuntamento per il {date} alle {time}.',
  [WhatsappTemplateType.RECAP_MULTI]:
    'Gentile {name}, confermiamo i seguenti appuntamenti:\n{appointments}',
  [WhatsappTemplateType.REMINDER_24H]:
    'Promemoria: il suo appuntamento è domani alle {time}.',
  [WhatsappTemplateType.REMINDER_48H]:
    'Promemoria: il suo appuntamento è dopodomani alle {time}.',
  [WhatsappTemplateType.CANCELLATION]:
    'Gentile {name}, il suo appuntamento del {date} alle {time} è stato cancellato.',
  [WhatsappTemplateType.UPDATE]:
    'Gentile {name}, il suo appuntamento del {oldDate} alle {oldTime} è stato spostato al {date} alle {time}.',
  [WhatsappTemplateType.UPDATE_MULTI]:
    'Gentile {name}, i suoi appuntamenti sono stati spostati:\n{appointments}',
  [WhatsappTemplateType.CANCELLATION_MULTI]:
    'Gentile {name}, i seguenti appuntamenti sono stati cancellati:\n{appointments}',
  [WhatsappTemplateType.CALENDAR_INVITE_EMAIL]:
    'Gentile {name},\n\necco i suoi prossimi appuntamenti:\n\n{appointments}\n\n'
    + 'Da questo link può aggiungerli al calendario del telefono. Una volta fatto si '
    + 'aggiorna da solo a ogni spostamento o disdetta, senza altre email:\n\n{link}\n\n'
    + 'Il link è personale: le mostra i suoi appuntamenti, quindi la preghiamo di non '
    + 'inoltrarlo.\n\nSe non desidera più ricevere questo servizio può annullare '
    + 'l\'iscrizione qui:\n{unsubscribe}',
};

/** Oggetto di default dei template che viaggiano per posta. */
const DEFAULT_SUBJECTS: Partial<Record<WhatsappTemplateType, string>> = {
  [WhatsappTemplateType.CALENDAR_INVITE_EMAIL]:
    'I suoi appuntamenti sul calendario del telefono',
};

@Injectable()
export class WhatsappTemplateService {
  private readonly logger = new Logger(WhatsappTemplateService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get templateRepo() { return this.dataSource.getRepository(WhatsappMessageTemplate); }

  async findAll(channel?: NotificationChannel): Promise<WhatsappMessageTemplate[]> {
    return this.templateRepo.find({
      where: channel ? { channel } : {},
      order: { templateType: 'ASC' },
    });
  }

  /** Il testo di WhatsApp, che è quello sempre presente. */
  async findByType(type: WhatsappTemplateType): Promise<WhatsappMessageTemplate | null> {
    return this.templateRepo.findOne({
      where: { templateType: type, channel: NotificationChannel.WHATSAPP },
    });
  }

  /**
   * Il testo da usare su un canale, con ripiego su quello di WhatsApp.
   *
   * Il ripiego non è una comodità: senza, accendere l'email senza aver
   * scritto i suoi testi manderebbe messaggi vuoti — un guasto che si scopre
   * dal paziente, non dalla schermata. Con il ripiego un canale nuovo
   * funziona subito con i testi che ci sono, e si personalizza quando si
   * vuole, se si vuole.
   */
  async resolveForChannel(
    type: WhatsappTemplateType,
    channel: NotificationChannel,
  ): Promise<WhatsappMessageTemplate | null> {
    if (channel !== NotificationChannel.WHATSAPP) {
      const own = await this.templateRepo.findOne({ where: { templateType: type, channel } });
      if (own?.isActive && own.bodyTemplate?.trim()) return own;
    }
    return this.findByType(type);
  }

  async upsert(input: WhatsappTemplateInput): Promise<WhatsappMessageTemplate> {
    const channel = input.channel ?? NotificationChannel.WHATSAPP;
    let template = await this.templateRepo.findOne({
      where: { templateType: input.templateType, channel },
    });

    if (!template) {
      template = this.templateRepo.create({ templateType: input.templateType, channel });
    }

    template.bodyTemplate = input.bodyTemplate;

    if (input.footerTemplate !== undefined) {
      template.footerTemplate = input.footerTemplate;
    }

    if (input.subjectTemplate !== undefined) {
      template.subjectTemplate = input.subjectTemplate;
    }

    if (input.isActive !== undefined) {
      template.isActive = input.isActive;
    }

    return this.templateRepo.save(template);
  }

  renderTemplate(
    templateText: string,
    variables: Record<string, string>,
  ): string {
    let result = templateText;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  }

  async initializeDefaults(): Promise<void> {
    for (const [type, body] of Object.entries(DEFAULT_TEMPLATES)) {
      const exists = await this.templateRepo.findOne({
        where: {
          templateType: type as WhatsappTemplateType,
          channel: NotificationChannel.WHATSAPP,
        },
      });
      if (!exists) {
        await this.templateRepo.save(
          this.templateRepo.create({
            templateType: type as WhatsappTemplateType,
            channel: NotificationChannel.WHATSAPP,
            bodyTemplate: body,
            subjectTemplate: DEFAULT_SUBJECTS[type as WhatsappTemplateType],
            isActive: true,
          }),
        );
        this.logger.log(`Default template created: ${type}`);
      }
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { WhatsappMessageTemplate } from '../entities/whatsapp-message-template.entity';
import { WhatsappTemplateInput } from '../dto/whatsapp-template.input';
import { WhatsappTemplateType } from '../../enums/whatsapp-enums';

import { TenantContextService } from '@curandis/tenant-datasource';
const DEFAULT_TEMPLATES: Record<WhatsappTemplateType, string> = {
  [WhatsappTemplateType.RECAP_SINGLE]:
    'Gentile {name}, confermiamo il suo appuntamento per il {date} alle {time}.',
  [WhatsappTemplateType.RECAP_MULTI]:
    'Gentile {name}, confermiamo i seguenti appuntamenti:\n{appointments}',
  [WhatsappTemplateType.REMINDER_24H]:
    'Promemoria: il suo appuntamento è domani alle {time}.',
  [WhatsappTemplateType.CANCELLATION]:
    'Gentile {name}, il suo appuntamento del {date} alle {time} è stato cancellato.',
  [WhatsappTemplateType.UPDATE]:
    'Gentile {name}, il suo appuntamento è stato spostato al {date} alle {time}.',
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

  async findAll(): Promise<WhatsappMessageTemplate[]> {
    return this.templateRepo.find({ order: { templateType: 'ASC' } });
  }

  async findByType(type: WhatsappTemplateType): Promise<WhatsappMessageTemplate | null> {
    return this.templateRepo.findOne({ where: { templateType: type } });
  }

  async upsert(input: WhatsappTemplateInput): Promise<WhatsappMessageTemplate> {
    let template = await this.templateRepo.findOne({
      where: { templateType: input.templateType },
    });

    if (!template) {
      template = this.templateRepo.create({ templateType: input.templateType });
    }

    template.bodyTemplate = input.bodyTemplate;

    if (input.footerTemplate !== undefined) {
      template.footerTemplate = input.footerTemplate;
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
        where: { templateType: type as WhatsappTemplateType },
      });
      if (!exists) {
        await this.templateRepo.save(
          this.templateRepo.create({
            templateType: type as WhatsappTemplateType,
            bodyTemplate: body,
            isActive: true,
          }),
        );
        this.logger.log(`Default template created: ${type}`);
      }
    }
  }
}

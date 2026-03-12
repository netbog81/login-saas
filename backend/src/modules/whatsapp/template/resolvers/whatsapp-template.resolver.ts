import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { WhatsappMessageTemplate } from '../entities/whatsapp-message-template.entity';
import { WhatsappTemplateService } from '../services/whatsapp-template.service';
import { WhatsappTemplateInput } from '../dto/whatsapp-template.input';
import { WhatsappTemplateType } from '../../enums/whatsapp-enums';

@Resolver(() => WhatsappMessageTemplate)
export class WhatsappTemplateResolver {
  constructor(
    private readonly templateService: WhatsappTemplateService,
  ) {}

  @Query(() => [WhatsappMessageTemplate], { name: 'whatsappTemplates' })
  async getTemplates(): Promise<WhatsappMessageTemplate[]> {
    return this.templateService.findAll();
  }

  @Query(() => WhatsappMessageTemplate, {
    name: 'whatsappTemplate',
    nullable: true,
  })
  async getTemplate(
    @Args('type', { type: () => WhatsappTemplateType })
    type: WhatsappTemplateType,
  ): Promise<WhatsappMessageTemplate | null> {
    return this.templateService.findByType(type);
  }

  @Mutation(() => WhatsappMessageTemplate, {
    name: 'upsertWhatsappTemplate',
  })
  async upsertTemplate(
    @Args('input') input: WhatsappTemplateInput,
  ): Promise<WhatsappMessageTemplate> {
    return this.templateService.upsert(input);
  }
}

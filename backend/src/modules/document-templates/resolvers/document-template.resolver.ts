import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import {
  DocumentTemplate,
  DocumentTemplateType,
} from '../entities/document-template.entity';
import { DocumentTemplateService } from '../services/document-template.service';
import {
  CreateDocumentTemplateInput,
  UpdateDocumentTemplateInput,
} from '../dto/document-template.input';

@Resolver(() => DocumentTemplate)
export class DocumentTemplateResolver {
  constructor(private readonly templateService: DocumentTemplateService) {}

  // ==================== QUERIES ====================

  @Query(() => [DocumentTemplate], { name: 'documentTemplates' })
  async getTemplates(
    @Args('type', { type: () => DocumentTemplateType, nullable: true })
    type?: DocumentTemplateType,
  ): Promise<DocumentTemplate[]> {
    return this.templateService.findAll(type);
  }

  @Query(() => DocumentTemplate, { name: 'documentTemplate', nullable: true })
  async getTemplate(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<DocumentTemplate | null> {
    return this.templateService.findById(id);
  }

  /** Template usato dall'azione rapida "Genera attestato di presenza". */
  @Query(() => DocumentTemplate, {
    name: 'defaultDocumentTemplate',
    nullable: true,
  })
  async getDefaultTemplate(
    @Args('type', { type: () => DocumentTemplateType })
    type: DocumentTemplateType,
  ): Promise<DocumentTemplate | null> {
    return this.templateService.findDefaultByType(type);
  }

  // ==================== MUTATIONS ====================

  @Mutation(() => DocumentTemplate, { name: 'createDocumentTemplate' })
  async createTemplate(
    @Args('input') input: CreateDocumentTemplateInput,
  ): Promise<DocumentTemplate> {
    return this.templateService.create(input);
  }

  @Mutation(() => DocumentTemplate, { name: 'updateDocumentTemplate' })
  async updateTemplate(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateDocumentTemplateInput,
  ): Promise<DocumentTemplate> {
    return this.templateService.update(id, input);
  }

  @Mutation(() => Boolean, { name: 'deleteDocumentTemplate' })
  async deleteTemplate(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.templateService.delete(id);
  }
}

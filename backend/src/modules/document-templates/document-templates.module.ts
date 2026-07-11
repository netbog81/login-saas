import { Module } from '@nestjs/common';
import { DocumentTemplateService } from './services/document-template.service';
import { DocumentTemplateResolver } from './resolvers/document-template.resolver';

/**
 * Template documenti personalizzabili (attestati di presenza, ...).
 * Vedi entities/document-template.entity.ts per il modello.
 */
@Module({
  providers: [DocumentTemplateService, DocumentTemplateResolver],
  exports: [DocumentTemplateService],
})
export class DocumentTemplatesModule {}

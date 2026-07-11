import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';

import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import {
  CreateDocumentTemplateInput,
  DocumentTemplate,
  DocumentTemplateType,
  UpdateDocumentTemplateInput,
} from '../models/document-template.model';
import {
  CREATE_DOCUMENT_TEMPLATE,
  DELETE_DOCUMENT_TEMPLATE,
  GET_DEFAULT_DOCUMENT_TEMPLATE,
  GET_DOCUMENT_TEMPLATE,
  GET_DOCUMENT_TEMPLATES,
  UPDATE_DOCUMENT_TEMPLATE,
} from '../graphql/document-templates.operations';

/**
 * CRUD dei template documento.
 * APPROACH: GraphQL Fragments — nessuna foreign key, entità autonoma.
 */
@Injectable({ providedIn: 'root' })
export class DocumentTemplateService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getAll(type?: DocumentTemplateType): Observable<DocumentTemplate[]> {
    return this.query<{ documentTemplates: DocumentTemplate[] }>(
      GET_DOCUMENT_TEMPLATES,
      { type },
    ).pipe(map((r) => r.documentTemplates));
  }

  getById(id: string): Observable<DocumentTemplate | null> {
    return this.query<{ documentTemplate: DocumentTemplate | null }>(
      GET_DOCUMENT_TEMPLATE,
      { id },
    ).pipe(map((r) => r.documentTemplate));
  }

  getDefault(type: DocumentTemplateType): Observable<DocumentTemplate | null> {
    return this.query<{ defaultDocumentTemplate: DocumentTemplate | null }>(
      GET_DEFAULT_DOCUMENT_TEMPLATE,
      { type },
    ).pipe(map((r) => r.defaultDocumentTemplate));
  }

  create(input: CreateDocumentTemplateInput): Observable<DocumentTemplate> {
    return this.mutate<{ createDocumentTemplate: DocumentTemplate }>(
      CREATE_DOCUMENT_TEMPLATE,
      { input },
    ).pipe(map((r) => r.createDocumentTemplate));
  }

  update(id: string, input: UpdateDocumentTemplateInput): Observable<DocumentTemplate> {
    return this.mutate<{ updateDocumentTemplate: DocumentTemplate }>(
      UPDATE_DOCUMENT_TEMPLATE,
      { id, input },
    ).pipe(map((r) => r.updateDocumentTemplate));
  }

  delete(id: string): Observable<boolean> {
    return this.mutate<{ deleteDocumentTemplate: boolean }>(
      DELETE_DOCUMENT_TEMPLATE,
      { id },
    ).pipe(map((r) => r.deleteDocumentTemplate));
  }
}

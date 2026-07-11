import {
  TemplateDocument,
  TemplatePageSettings,
} from '../../../shared/template-editor';

/** Tipi di documento generabili (mirror dell'enum backend). */
export type DocumentTemplateType = 'ATTENDANCE_CERTIFICATE';

export interface DocumentTemplate {
  id: string;
  name: string;
  type: DocumentTemplateType;
  /** Documento TipTap JSON con nodi mergeField. */
  content: TemplateDocument;
  pageSettings?: Partial<TemplatePageSettings> | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentTemplateInput {
  name: string;
  type?: DocumentTemplateType;
  content: TemplateDocument;
  pageSettings?: Partial<TemplatePageSettings> | null;
  isDefault?: boolean;
}

export interface UpdateDocumentTemplateInput {
  name?: string;
  content?: TemplateDocument;
  pageSettings?: Partial<TemplatePageSettings> | null;
  isDefault?: boolean;
}

/**
 * Modelli documenti scheda paziente.
 *
 * Il documento è associato alla scheda paziente (subjectId registry) con
 * tre livelli opzionali: Generale / Percorso terapeutico / Trattamento
 * (con trattamento il percorso è sempre valorizzato, denormalizzato).
 *
 * Il blob vive su S3 cifrato (envelope encryption lato backend): qui
 * arrivano SOLO metadati; upload/download passano dal REST controller.
 */

export type PatientDocumentCategory =
  | 'prescription'
  | 'report'
  | 'radiology'
  | 'consent'
  | 'other';

export type PatientDocumentKind =
  | 'pdf'
  | 'image'
  | 'video'
  | 'audio'
  | 'spreadsheet'
  | 'document'
  | 'other';

export type PatientDocumentScope = 'general' | 'path' | 'treatment';

export interface PatientDocument {
  id: string;
  subjectId: string;
  organizationId?: string;
  therapeuticPathId?: string | null;
  treatmentId?: string | null;
  category: PatientDocumentCategory;
  contentKind: PatientDocumentKind;
  originalFileName: string;
  mimeType: string;
  /** bigint serializzato come stringa dal backend */
  fileSize: string;
  sha256: string;
  externalDoctorName?: string | null;
  notes?: string | null;
  description?: string | null;
  uploadedBy?: string | null;
  uploadedAt: string;
  updatedAt: string;
}

/** Filtro client-side/GraphQL per l'elenco documenti. */
export interface PatientDocumentsFilter {
  scope?: PatientDocumentScope;
  therapeuticPathId?: string;
  treatmentId?: string;
  category?: PatientDocumentCategory;
  contentKind?: PatientDocumentKind;
  search?: string;
}

export interface PatientDocumentStats {
  total: number;
  generalCount: number;
  pathCount: number;
  treatmentCount: number;
  byCategory: { category: PatientDocumentCategory; count: number }[];
  byKind: { kind: PatientDocumentKind; count: number }[];
  byPath: { therapeuticPathId: string; count: number }[];
}

/** Metadati condivisi dal batch di upload (stessa associazione per tutti i file). */
export interface UploadDocumentMeta {
  therapeuticPathId?: string;
  treatmentId?: string;
  notes?: string;
  externalDoctorName?: string;
}

/** Update metadati (il blob è immutabile). */
export interface UpdatePatientDocumentInput {
  category?: PatientDocumentCategory;
  notes?: string;
  description?: string;
  externalDoctorName?: string;
}

export type UploadFileStatus = 'pending' | 'uploading' | 'done' | 'error';

/** Stato di un singolo file nel dialog di upload multi-file. */
export interface UploadFileItem {
  file: File;
  category: PatientDocumentCategory;
  status: UploadFileStatus;
  /** 0..100 */
  progress: number;
  error?: string;
  result?: PatientDocument;
}

// ==================== HELPERS UI ====================

export const CATEGORY_LABELS: Record<PatientDocumentCategory, string> = {
  prescription: 'Prescrizioni',
  report: 'Referti',
  radiology: 'Radiografie',
  consent: 'Consensi',
  other: 'Altro',
};

export const KIND_LABELS: Record<PatientDocumentKind, string> = {
  pdf: 'PDF',
  image: 'Immagini',
  video: 'Video',
  audio: 'Audio',
  spreadsheet: 'Fogli di calcolo',
  document: 'Documenti di testo',
  other: 'Altro',
};

export function kindIcon(kind: PatientDocumentKind): string {
  const icons: Record<PatientDocumentKind, string> = {
    pdf: 'picture_as_pdf',
    image: 'image',
    video: 'videocam',
    audio: 'audiotrack',
    spreadsheet: 'table_chart',
    document: 'description',
    other: 'insert_drive_file',
  };
  return icons[kind] || 'insert_drive_file';
}

export function categoryIcon(category: PatientDocumentCategory): string {
  const icons: Record<PatientDocumentCategory, string> = {
    prescription: 'medication',
    report: 'description',
    radiology: 'radio_button_checked',
    consent: 'verified_user',
    other: 'folder',
  };
  return icons[category] || 'folder';
}

export function documentScope(doc: PatientDocument): PatientDocumentScope {
  if (doc.treatmentId) return 'treatment';
  if (doc.therapeuticPathId) return 'path';
  return 'general';
}

export function formatFileSize(bytes: number | string): string {
  const n = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (!n || isNaN(n)) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

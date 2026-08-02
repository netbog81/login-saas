import { registerEnumType } from '@nestjs/graphql';

/**
 * PatientDocumentCategory — classificazione clinica del documento
 * (stessi valori della vecchia DocumentCategory di path_documents).
 */
export enum PatientDocumentCategory {
  PRESCRIPTION = 'prescription', // Prescrizione medica
  REPORT = 'report',             // Referti medici
  RADIOLOGY = 'radiology',       // Radiografie/TAC/RMN
  CONSENT = 'consent',           // Consensi firmati
  OTHER = 'other',               // Altro
}

/**
 * PatientDocumentKind — tipo di contenuto, derivato server-side dal MIME.
 * Usato per icone/filtri UI (pdf, excel, video, ...).
 */
export enum PatientDocumentKind {
  PDF = 'pdf',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  SPREADSHEET = 'spreadsheet', // Excel/CSV/ods
  DOCUMENT = 'document',       // Word/odt/txt
  OTHER = 'other',
}

/**
 * PatientDocumentScope — livello di associazione (solo filtro GraphQL,
 * non è una colonna: si deriva da therapeutic_path_id/treatment_id).
 */
export enum PatientDocumentScope {
  GENERAL = 'general',     // nessuna associazione
  PATH = 'path',           // legato a un percorso terapeutico
  TREATMENT = 'treatment', // legato a un trattamento (e quindi al suo percorso)
}

registerEnumType(PatientDocumentCategory, {
  name: 'PatientDocumentCategory',
  description: 'Clinical category of a patient document',
});

registerEnumType(PatientDocumentKind, {
  name: 'PatientDocumentKind',
  description: 'Content kind of a patient document (derived from MIME type)',
});

registerEnumType(PatientDocumentScope, {
  name: 'PatientDocumentScope',
  description: 'Association level of a patient document (general/path/treatment)',
});

/** Deriva il PatientDocumentKind dal MIME type. */
export function kindFromMimeType(mimeType: string): PatientDocumentKind {
  const mime = (mimeType || '').toLowerCase();
  if (mime === 'application/pdf') return PatientDocumentKind.PDF;
  if (mime.startsWith('image/')) return PatientDocumentKind.IMAGE;
  if (mime.startsWith('video/')) return PatientDocumentKind.VIDEO;
  if (mime.startsWith('audio/')) return PatientDocumentKind.AUDIO;
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime === 'text/csv' ||
    mime === 'application/vnd.oasis.opendocument.spreadsheet'
  ) {
    return PatientDocumentKind.SPREADSHEET;
  }
  if (
    mime.includes('word') ||
    mime === 'text/plain' ||
    mime === 'application/rtf' ||
    mime === 'application/vnd.oasis.opendocument.text'
  ) {
    return PatientDocumentKind.DOCUMENT;
  }
  return PatientDocumentKind.OTHER;
}

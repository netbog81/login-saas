import { registerEnumType } from '@nestjs/graphql';

/**
 * TherapeuticPathStatus - Stato del percorso terapeutico
 */
export enum TherapeuticPathStatus {
  ACTIVE = 'active',           // Percorso in corso
  SUSPENDED = 'suspended',     // Sospeso temporaneamente
  COMPLETED = 'completed',     // Completato con successo
  ARCHIVED = 'archived'        // Archiviato
}

/**
 * DocumentType - Tipo di documento allegato
 */
export enum DocumentType {
  PDF = 'pdf',
  IMAGE = 'image',
  VIDEO = 'video',
  OTHER = 'other'
}

/**
 * DocumentCategory - Categoria del documento
 */
export enum DocumentCategory {
  PRESCRIPTION = 'prescription',   // Prescrizione medica
  REPORT = 'report',               // Referti medici
  RADIOLOGY = 'radiology',         // Radiografie/TAC/RMN
  CONSENT = 'consent',             // Consensi firmati
  OTHER = 'other'                  // Altro
}

// Register enums for GraphQL
registerEnumType(TherapeuticPathStatus, {
  name: 'TherapeuticPathStatus',
  description: 'Therapeutic path status',
});

registerEnumType(DocumentType, {
  name: 'DocumentType',
  description: 'Type of attached document',
});

registerEnumType(DocumentCategory, {
  name: 'DocumentCategory',
  description: 'Category of attached document',
});

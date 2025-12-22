/**
 * Modelli per Percorsi Terapeutici (MVP - Mock Data)
 * Questi modelli saranno poi implementati nel backend quando l'MVP sarà approvato
 */

// ==================== ENUMS ====================

export type PathStatus = 'active' | 'suspended' | 'completed' | 'archived';
export type DocumentType = 'pdf' | 'image' | 'video' | 'other';
export type TreatmentType = 'standard' | 'evaluation' | 'followup' | 'discharge';

// ==================== INTERFACES ====================

/**
 * Documento allegato a un percorso terapeutico
 */
export interface PathDocument {
  id: string;
  pathId: string;
  name: string;
  type: DocumentType;
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date | string;
  uploadedBy?: string;
  notes?: string;
  category?: string; // es: "radiografia", "referti", "consensi"
}

/**
 * Anamnesi del percorso terapeutico
 */
export interface Anamnesis {
  id: string;
  pathId: string;
  // Anamnesi prossima (problema attuale)
  chiefComplaint: string;
  historyOfPresentIllness: string;
  onsetDate?: Date | string;
  painScale?: number; // 0-10
  painLocation?: string;
  aggravatingFactors?: string[];
  relievingFactors?: string[];
  // Anamnesi remota
  pastMedicalHistory?: string;
  surgicalHistory?: string;
  medications?: string[];
  allergies?: string[];
  familyHistory?: string;
  // Obiettivi
  patientGoals?: string;
  therapistGoals?: string;
  // Metadata
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy: string;
}

/**
 * Strumento utilizzato in un trattamento
 */
export interface TreatmentInstrument {
  instrumentId: string;
  instrumentName: string;
  categoryName?: string;
  duration?: number; // minuti
  settings?: string; // es: "intensita 5, frequenza 10Hz"
}

/**
 * Singolo trattamento all'interno di un percorso
 */
export interface PathTreatment {
  id: string;
  pathId: string;
  appointmentId?: string;
  operatorId: string;
  operatorName?: string;
  // Timing
  date: Date | string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  // Tipo e contenuto
  type: TreatmentType;
  title?: string;
  // Note operatore
  clinicalNotes?: string;
  treatmentDescription?: string;
  patientResponse?: string;
  // Strumenti utilizzati
  instrumentsUsed?: TreatmentInstrument[];
  // Valutazione
  painScaleBefore?: number;
  painScaleAfter?: number;
  functionalScore?: number;
  // Prossimi passi
  nextSteps?: string;
  homeExercises?: string;
  // Metadata
  createdAt: Date | string;
  updatedAt?: Date | string;
  isBillable?: boolean;
  price?: number;
}

/**
 * Percorso terapeutico completo
 */
export interface TherapeuticPath {
  id: string;
  patientId: number;
  // Info percorso
  name: string;
  description?: string;
  diagnosis?: string;
  icdCode?: string;
  // Operatore responsabile
  primaryOperatorId: string;
  primaryOperatorName?: string;
  // Status e date
  status: PathStatus;
  startDate: Date | string;
  expectedEndDate?: Date | string;
  actualEndDate?: Date | string;
  // Sessioni previste
  plannedSessions?: number;
  completedSessions?: number;
  // Relazioni (popolate)
  anamnesis?: Anamnesis;
  treatments?: PathTreatment[];
  documents?: PathDocument[];
  // Note
  notes?: string;
  internalNotes?: string;
  // Metadata
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ==================== HELPER FUNCTIONS ====================

export function getPathStatusLabel(status: PathStatus): string {
  const labels: Record<PathStatus, string> = {
    active: 'In corso',
    suspended: 'Sospeso',
    completed: 'Completato',
    archived: 'Archiviato',
  };
  return labels[status] || status;
}

export function getPathStatusColor(status: PathStatus): string {
  const colors: Record<PathStatus, string> = {
    active: '#10b981', // green
    suspended: '#f59e0b', // amber
    completed: '#3b82f6', // blue
    archived: '#6b7280', // gray
  };
  return colors[status] || '#6b7280';
}

export function getDocumentTypeIcon(type: DocumentType): string {
  const icons: Record<DocumentType, string> = {
    pdf: 'file-text',
    image: 'image',
    video: 'video',
    other: 'file',
  };
  return icons[type] || 'file';
}

export function getTreatmentTypeLabel(type: TreatmentType): string {
  const labels: Record<TreatmentType, string> = {
    standard: 'Trattamento',
    evaluation: 'Valutazione',
    followup: 'Controllo',
    discharge: 'Dimissione',
  };
  return labels[type] || type;
}

export function getTreatmentTypeColor(type: TreatmentType): string {
  const colors: Record<TreatmentType, string> = {
    standard: '#6b7280', // gray
    evaluation: '#8b5cf6', // purple
    followup: '#3b82f6', // blue
    discharge: '#10b981', // green
  };
  return colors[type] || '#6b7280';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function formatPathProgress(path: TherapeuticPath): string {
  if (!path.plannedSessions) return '';
  const completed = path.completedSessions || 0;
  return `${completed}/${path.plannedSessions} sedute`;
}

export function getPathProgressPercentage(path: TherapeuticPath): number {
  if (!path.plannedSessions || path.plannedSessions === 0) return 0;
  const completed = path.completedSessions || 0;
  return Math.min(100, Math.round((completed / path.plannedSessions) * 100));
}

/**
 * Modelli per il Dialog Percorso Terapeutico
 * Layer: Models
 */

import { TherapeuticPath, PathStatus } from '../../../models/therapeutic-path.model';

/**
 * Dati di input per il dialog
 */
export interface PathDialogData {
  mode: 'create' | 'edit';
  path?: TherapeuticPath;
  patientId: string;
  currentOperatorId?: string;
}

/**
 * Risultato del form dialog
 */
export interface PathDialogFormResult {
  primaryOperatorId: string;
  name: string;
  diagnosis?: string;
  icdCode?: string;
  externalDoctorName?: string;
  externalPrescriptionRef?: string;
  notes?: string;
  status?: PathStatus;  // Solo in edit mode
}

/**
 * Opzioni per il campo status
 */
export interface PathStatusOption {
  value: PathStatus;
  label: string;
}

/**
 * Lista delle opzioni status disponibili
 */
export const PATH_STATUS_OPTIONS: PathStatusOption[] = [
  { value: 'active', label: 'Attivo' },
  { value: 'suspended', label: 'Sospeso' },
  { value: 'completed', label: 'Completato' },
  { value: 'archived', label: 'Archiviato' }
];

/**
 * Factory per creare dati dialog vuoti (create mode)
 */
export function createNewPathDialogData(patientId: string, currentOperatorId?: string): PathDialogData {
  return {
    mode: 'create',
    patientId,
    currentOperatorId
  };
}

/**
 * Factory per creare dati dialog per edit
 */
export function createEditPathDialogData(
  path: TherapeuticPath,
  patientId: string,
  currentOperatorId?: string
): PathDialogData {
  return {
    mode: 'edit',
    path,
    patientId,
    currentOperatorId
  };
}

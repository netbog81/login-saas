/**
 * Models for Start Treatment Dialog
 * Used when operator clicks "Inizia Trattamento"
 */

import { TherapeuticPath } from '../../../models/therapeutic-path.model';
import { PaymentMethod } from '../../../models/treatment.model';
import { Service } from '../../../graphql/generated/types';

/**
 * Data passed to the Start Treatment Dialog
 */
export interface StartTreatmentDialogData {
  appointmentId: string;
  patientId: number;
  patientName: string;
  activePaths: TherapeuticPath[];  // Solo percorsi ATTIVI del paziente
  operatorId: string;
  serviceName?: string;            // Nome del servizio dell'appuntamento
  servicePrice?: number;           // Prezzo default del servizio
  availableServices: Service[];    // Lista servizi disponibili
  defaultServiceId?: string;       // ServiceId dell'appuntamento (default)
  defaultPathId?: string;          // Percorso terapeutico da pre-selezionare (dalla scheda paziente)
}

/**
 * Result returned when the dialog is saved
 */
export interface StartTreatmentFormResult {
  pathId: string;                    // Percorso terapeutico selezionato (obbligatorio)
  serviceId?: string;                // Servizio selezionato
  clinicalNotes?: string;            // Note cliniche operatore
  secretaryNotes?: string;           // Note per la segreteria
  price?: number;                    // Prezzo del trattamento
  isScontoFE: boolean;               // Flag sconto fattura elettronica
  collectedByOperator?: boolean;     // Se l'operatore ha incassato (solo se sconto FE)
  paymentMethod?: PaymentMethod;     // Metodo pagamento se incassato da operatore
  painAssessment?: PainAssessment;   // Valutazione dolore VAS
  rescheduling?: ReschedulingData;   // Dati riprogrammazione
  patientNotes?: string;             // Note per il paziente
}

/**
 * Pain assessment data (VAS scale 0-10)
 */
export interface PainAssessment {
  painBefore?: number;  // Dolore prima del trattamento (0-10)
  painAfter?: number;   // Dolore dopo il trattamento (0-10)
}

/**
 * Rescheduling data for next appointment
 */
export interface ReschedulingData {
  type: ReschedulingType;
  suggestInDays?: number;           // Per tipo 'days'
  suggestDateRangeStart?: string;   // Per tipo 'range' (ISO date string)
  suggestDateRangeEnd?: string;     // Per tipo 'range' (ISO date string)
  secretaryNotes?: string;          // Note per la segreteria sulla riprogrammazione
}

export type ReschedulingType = 'none' | 'days' | 'range';

/**
 * Cash collection confirmation data
 */
export interface CashCollectionData {
  amount: number;
  paymentMethod: PaymentMethod;
  collectedBy: string;  // Operator ID
}

/**
 * Helper function to create initial dialog data
 */
export function createStartTreatmentDialogData(
  appointmentId: string,
  patientId: number,
  patientName: string,
  activePaths: TherapeuticPath[],
  operatorId: string,
  serviceName?: string,
  servicePrice?: number,
  availableServices: Service[] = [],
  defaultServiceId?: string,
  defaultPathId?: string
): StartTreatmentDialogData {
  return {
    appointmentId,
    patientId,
    patientName,
    activePaths,
    operatorId,
    serviceName,
    servicePrice,
    availableServices,
    defaultServiceId,
    defaultPathId
  };
}

/**
 * Helper function to create empty form result
 */
export function createEmptyFormResult(): Partial<StartTreatmentFormResult> {
  return {
    pathId: '',
    clinicalNotes: '',
    secretaryNotes: '',
    price: undefined,
    isScontoFE: false,
    collectedByOperator: false,
    painAssessment: {
      painBefore: undefined,
      painAfter: undefined
    },
    rescheduling: {
      type: 'none'
    },
    patientNotes: ''
  };
}

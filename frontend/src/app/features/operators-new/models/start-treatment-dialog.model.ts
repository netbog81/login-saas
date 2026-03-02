/**
 * Models for Start Treatment Dialog
 * Used when operator clicks "Inizia Trattamento"
 */

import { TherapeuticPath } from '../../../models/therapeutic-path.model';
import { PaymentMethod } from '../../../models/treatment.model';
import { Service, Instrument } from '../../../graphql/generated/types';

/**
 * Servizio associato all'appuntamento
 */
export interface AppointmentServiceData {
  serviceId: string;
  customPrice?: number;
  customDuration?: number;
  orderPosition?: number;
}

/**
 * Base interface for instrument data from appointment.
 */
export interface BaseInstrumentData {
  instrumentId: string;
  instrument?: {
    id: string;
    name: string;
  };
  startOffsetMinutes: number;
  endOffsetMinutes: number;
  instrumentCategoryId?: string;
  wasUsed?: boolean;
  notes?: string;
}

/**
 * Input for instrument in start treatment form
 */
export interface StartTreatmentInstrumentInput {
  instrumentId: string;
  instrumentCategoryId?: string;
  wasUsed?: boolean;
  startOffsetMinutes?: number;
  endOffsetMinutes?: number;
  notes?: string;
}

/**
 * Data passed to the Start Treatment Dialog
 */
export interface StartTreatmentDialogData {
  appointmentId: string;
  patientId: string;
  patientName: string;
  activePaths: TherapeuticPath[];  // Solo percorsi ATTIVI del paziente
  operatorId: string;
  serviceName?: string;            // Nome del servizio dell'appuntamento
  servicePrice?: number;           // Prezzo default del servizio
  availableServices: Service[];    // Lista servizi disponibili
  defaultServiceId?: string;       // @deprecated - usa appointmentServices
  defaultPathId?: string;          // Percorso terapeutico da pre-selezionare (dalla scheda paziente)
  appointmentServices?: AppointmentServiceData[];  // Servizi dell'appuntamento (nuovo sistema)
  availableInstruments?: Instrument[];  // Lista strumenti disponibili
  appointmentInstruments?: BaseInstrumentData[];  // Strumenti dell'appuntamento
}

/**
 * Servizio per il trattamento (output)
 */
export interface TreatmentServiceInput {
  serviceId: string;
  price?: number;
  duration?: number;
  orderPosition: number;
}

/**
 * Result returned when the dialog is saved
 */
export interface StartTreatmentFormResult {
  pathId: string;                    // Percorso terapeutico selezionato (obbligatorio)
  serviceId?: string;                // @deprecated - usa treatmentServices
  clinicalNotes?: string;            // Note cliniche operatore
  secretaryNotes?: string;           // Note per la segreteria
  price?: number;                    // Prezzo totale del trattamento
  isScontoFE: boolean;               // Flag sconto fattura elettronica
  collectedByOperator?: boolean;     // Se l'operatore ha incassato (solo se sconto FE)
  paymentMethod?: PaymentMethod;     // Metodo pagamento se incassato da operatore
  painAssessment?: PainAssessment;   // Valutazione dolore VAS
  rescheduling?: ReschedulingData;   // Dati riprogrammazione
  patientNotes?: string;             // Note per il paziente
  treatmentServices?: TreatmentServiceInput[];  // Servizi del trattamento (nuovo sistema)
  instruments?: StartTreatmentInstrumentInput[];  // Strumenti utilizzati
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
  patientId: string,
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

/**
 * Models for Edit Treatment Dialog
 * Used when operator clicks "Modifica Trattamento" on an in-progress treatment
 */

import { Service, Instrument, AppointmentInstrument } from '../../../graphql/generated/types';
import { TherapeuticPath } from '../../../models/therapeutic-path.model';
import { Treatment, TreatmentInstrument, PaymentMethod } from '../../../models/treatment.model';

/**
 * Base interface for instrument data from either treatment or appointment.
 * Both TreatmentInstrument and AppointmentInstrument have these common fields.
 */
export interface BaseInstrumentData {
  instrumentId: string;
  instrument?: {
    id: string;
    name: string;
  };
  startOffsetMinutes: number;
  endOffsetMinutes: number;
  // Optional fields that may or may not exist
  instrumentCategoryId?: string;
  wasUsed?: boolean;
  notes?: string;
}

/**
 * Data passed to the Edit Treatment Dialog
 */
export interface EditTreatmentDialogData {
  treatment: Treatment;
  availablePaths: TherapeuticPath[];
  availableServices: Service[];
  availableInstruments: Instrument[];
  appointmentInstruments?: BaseInstrumentData[];
}

/**
 * Input for instrument in edit treatment form
 */
export interface EditTreatmentInstrumentInput {
  instrumentId: string;
  instrumentName?: string;
  instrumentCategoryId?: string;
  wasUsed?: boolean;
  startOffsetMinutes?: number;
  endOffsetMinutes?: number;
  notes?: string;
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
 * Result returned when the edit dialog is saved
 */
export type ReschedulingType = 'none' | 'days' | 'range';

export interface EditTreatmentFormResult {
  therapeuticPathId?: string;
  serviceId?: string;                // @deprecated - usa treatmentServices
  clinicalNotes?: string;
  secretaryNotes?: string;
  patientNotes?: string;
  price?: number;
  scontoFE?: boolean;
  painLevel?: number;
  painBefore?: number;
  painAfter?: number;
  // Servizi multipli del trattamento (nuovo sistema)
  treatmentServices?: TreatmentServiceInput[];
  // Rescheduling fields
  reschedulingType?: ReschedulingType;
  suggestInDays?: number;
  suggestDateRangeStart?: string;
  suggestDateRangeEnd?: string;
  reschedulingNotes?: string;
  rescheduleRequested?: boolean;
  instruments: EditTreatmentInstrumentInput[];
  // Cash collection fields
  collectedByOperator?: boolean;
  paymentMethod?: PaymentMethod;
}

/**
 * Helper function to create dialog data from treatment
 */
export function createEditTreatmentDialogData(
  treatment: Treatment,
  availablePaths: TherapeuticPath[],
  availableServices: Service[],
  availableInstruments: Instrument[],
  appointmentInstruments?: BaseInstrumentData[]
): EditTreatmentDialogData {
  return {
    treatment,
    availablePaths,
    availableServices,
    availableInstruments,
    appointmentInstruments
  };
}

/**
 * Helper function to convert treatment to form result
 */
export function treatmentToFormResult(treatment: Treatment): Partial<EditTreatmentFormResult> {
  return {
    therapeuticPathId: treatment.therapeuticPathId,
    serviceId: treatment.serviceId,
    clinicalNotes: treatment.clinicalNotes || '',
    secretaryNotes: treatment.secretaryNotes || '',
    price: treatment.price,
    scontoFE: treatment.scontoFE,
    painLevel: treatment.painLevel,
    painBefore: treatment.painBefore,
    painAfter: treatment.painAfter,
    rescheduleRequested: treatment.rescheduleRequested,
    instruments: (treatment.instruments || []).map(inst => ({
      instrumentId: inst.instrumentId,
      instrumentName: inst.instrument?.name,
      instrumentCategoryId: inst.instrumentCategoryId,
      wasUsed: inst.wasUsed,
      startOffsetMinutes: inst.startOffsetMinutes,
      endOffsetMinutes: inst.endOffsetMinutes
    }))
  };
}

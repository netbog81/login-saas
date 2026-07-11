import { Appointment } from './appointment.model';
import { Operator, Service } from '../graphql/generated/types';
import { Patient } from './patient.model';
import { TherapeuticPath } from './therapeutic-path.model';

// ==================== ENUMS ====================

export type TreatmentStatus = 'in_progress' | 'operator_completed' | 'closed';

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'satispay' | 'other';

// ==================== INTERFACES ====================

export interface TreatmentInstrument {
  id: string;
  treatmentId: string;
  instrumentId: string;
  instrumentCategoryId?: string;
  wasUsed: boolean;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
  orderPosition?: number;
  // Populated fields
  instrument?: {
    id: string;
    name: string;
  };
  instrumentCategory?: {
    id: string;
    name: string;
  };
}

/**
 * Servizio associato a un trattamento (tabella di collegamento)
 * Permette prezzi e durate personalizzati per ogni servizio
 */
export interface TreatmentServiceItem {
  id?: string;
  treatmentId?: string;
  serviceId: string;
  service?: {
    id: string;
    name: string;
    defaultPrice?: number;
    discountFE?: number;
    duration?: number;
  };
  price?: number;         // Prezzo applicato per questo servizio
  duration?: number;      // Durata effettiva
  orderPosition?: number;
  /**
   * True se il prezzo è stato personalizzato manualmente dall'operatore.
   * Se false, il prezzo segue la logica scontoFE/defaultPrice.
   */
  isCustomPrice?: boolean;
}

/**
 * Input per creare/aggiornare un servizio nel trattamento
 */
export interface TreatmentServiceInputItem {
  serviceId: string;
  price?: number;
  duration?: number;
  orderPosition?: number;
  /**
   * True se il prezzo è stato personalizzato manualmente dall'operatore.
   */
  isCustomPrice?: boolean;
}

export interface Treatment {
  id: string;
  appointmentId: string;
  operatorId: string;
  patientId?: string;
  /** @deprecated Usa treatmentServices invece */
  serviceId?: string;
  therapeuticPathId: string;

  // Flags
  scontoFE: boolean;

  // Status
  status: TreatmentStatus;
  isTest: boolean;
  /**
   * True se la chiusura è stata forzata da segreteria/admin perché
   * l'operatore aveva dimenticato di completare il trattamento.
   * Mostrato in UI con un badge.
   */
  forcedClosure?: boolean;

  // Timestamps
  startedAt: Date | string;
  completedAt?: Date | string;
  closedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;

  // Notes
  clinicalNotes?: string;
  secretaryNotes?: string;
  operatorNotes?: string;
  patientNotes?: string;

  // Clinical data
  painLevel?: number;
  painBefore?: number;
  painAfter?: number;
  rescheduleRequested?: boolean;
  reschedulingType?: string;
  suggestInDays?: number;
  suggestDateRangeStart?: Date | string;
  suggestDateRangeEnd?: Date | string;
  reschedulingNotes?: string;

  // Payment (patient)
  price: number;
  isPaid: boolean;
  paymentMethod?: PaymentMethod;
  paidAt?: Date | string;
  collectedBy?: string;

  // Invoicing - Patient
  isInvoicedToPatient: boolean;
  invoicedToPatientAt?: Date | string;
  patientInvoiceNumber?: string;

  // Invoicing - Operator to Studio
  isInvoicedByOperator: boolean;
  invoicedByOperatorAt?: Date | string;
  operatorInvoiceNumber?: string;

  // Relations
  appointment?: Appointment;
  operator?: Operator;
  patient?: Patient;
  /** @deprecated Usa treatmentServices invece */
  service?: Service;
  instruments?: TreatmentInstrument[];
  therapeuticPath?: TherapeuticPath;
  /** Servizi eseguiti nel trattamento (nuovo sistema ManyToMany) */
  treatmentServices?: TreatmentServiceItem[];
}

// ==================== INPUT TYPES ====================

export interface CompleteTreatmentInput {
  clinicalNotes?: string;
  secretaryNotes?: string;
  operatorNotes?: string;
  price: number;
  isTest?: boolean;
}

export interface CloseTreatmentInput {
  secretaryNotes?: string;
}

/**
 * Riga di tender per lo split multi-riga del pagamento.
 * Stessa forma del TenderLineInput GraphQL (vedi anche feature trattamenti).
 */
export interface PaymentTenderLine {
  kind: 'method' | 'voucher' | 'voucher_fe';
  paymentMethodId?: string;
  voucherId?: string;
  voucherFeId?: string;
  amount: number;
}

export interface RecordPaymentInput {
  paymentMethod: PaymentMethod;
  collectedBy: string;
  amount?: number;
  /** Dettaglio metodi/voucher usati; se presente è la fonte di verità lato backend. */
  tenderLines?: PaymentTenderLine[];
}

export interface TreatmentInstrumentInput {
  instrumentId: string;
  instrumentCategoryId?: string;
  wasUsed: boolean;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
  orderPosition?: number;
}

export interface CancelAppointmentInput {
  reason: string;
  cancelledBy: string;
}

// ==================== HELPER FUNCTIONS ====================

export function getTreatmentStatusLabel(status: TreatmentStatus): string {
  switch (status) {
    case 'in_progress':
      return 'In corso';
    case 'operator_completed':
      return 'Completato (attesa segreteria)';
    case 'closed':
      return 'Chiuso';
    default:
      return status;
  }
}

export function getTreatmentStatusColor(status: TreatmentStatus): string {
  switch (status) {
    case 'in_progress':
      return '#3b82f6'; // blue
    case 'operator_completed':
      return '#f59e0b'; // amber/orange
    case 'closed':
      return '#10b981'; // green
    default:
      return '#6b7280'; // gray
  }
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case 'cash':
      return 'Contanti';
    case 'card':
      return 'Carta/Bancomat';
    case 'transfer':
      return 'Bonifico';
    case 'satispay':
      return 'Satispay';
    case 'other':
      return 'Altro';
    default:
      return method;
  }
}

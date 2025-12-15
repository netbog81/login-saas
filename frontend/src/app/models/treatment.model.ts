import { Appointment } from './appointment.model';
import { Operator } from './operator.model';
import { Patient } from './patient.model';
import { Service } from './service.model';

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

export interface Treatment {
  id: string;
  appointmentId: string;
  operatorId: string;
  patientId?: number;
  serviceId?: string;

  // Status
  status: TreatmentStatus;
  isTest: boolean;

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
  service?: Service;
  instruments?: TreatmentInstrument[];
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

export interface RecordPaymentInput {
  paymentMethod: PaymentMethod;
  collectedBy: string;
  amount?: number;
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
      return 'primary';
    case 'operator_completed':
      return 'warn';
    case 'closed':
      return 'accent';
    default:
      return '';
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

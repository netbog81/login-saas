/**
 * Modelli frontend per la feature Trattamenti.
 *
 * Il dominio ricalca il backend (Treatment, TreatmentService, TreatmentInvoiceLine)
 * ma è definito localmente per evitare dipendenza stretta dai tipi generated
 * (che richiedono rigenerazione ogni volta che lo schema cambia).
 *
 * Per le foreign keys usiamo l'approccio GraphQL Fragments (vedi
 * architettura-componenti.md): il server risolve paziente/operatore/servizi
 * in un unico round trip.
 */

// Enum BillingStatus importato dai generated types (defensivo contro
// typos cross-file vs stringhe hardcoded). Il backend lo serializza
// uppercase coerentemente con TreatmentStatus (vedi nota sotto).
import { TreatmentBillingStatus } from '../../../graphql/generated/types';
export { TreatmentBillingStatus };

/**
 * Gli enum GraphQL di NestJS vengono serializzati in uppercase (es. il
 * backend ritorna `"CLOSED"`, non `"closed"`). Usiamo quindi i valori
 * uppercase nel frontend per matchare quello che arriva dalla rete.
 * (I valori DB/TS lato backend sono lowercase, ma quello è trasparente
 * grazie a registerEnumType.)
 */
export enum TreatmentStatus {
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  OPERATOR_COMPLETED = 'OPERATOR_COMPLETED',
  CLOSED = 'CLOSED',
}

export enum OperatorMacroCategory {
  DOCTOR = 'DOCTOR',
  PHYSIOTHERAPIST = 'PHYSIOTHERAPIST',
  GYM_INSTRUCTOR = 'GYM_INSTRUCTOR',
  OTHER = 'OTHER',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  SATISPAY = 'SATISPAY',
  OTHER = 'OTHER',
}

// ==================== OPERATOR / PATIENT (ridotti) ====================

export interface TrattamentoOperatore {
  id: string;
  name: string;
  surname?: string | null;
  macroCategory: OperatorMacroCategory;
  professionalRegistration?: string | null;
  canCollectPayment: boolean;
  color?: string | null;
}

export interface TrattamentoPaziente {
  id: string;
  nome: string;
  cognome: string;
}

export interface TrattamentoAppuntamento {
  id: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string;       // HH:MM
  endTime: string;         // HH:MM
}

// ==================== SERVIZIO EROGATO ====================

export interface TrattamentoServizio {
  id: string;
  serviceId: string;
  price?: number | null;
  duration?: number | null;
  orderPosition: number;
  isCustomPrice: boolean;
  /**
   * Descrizione personalizzata dall'utente. Se null, il frontend mostra
   * `invoiceLineDescriptionAuto` come placeholder/fallback.
   */
  invoiceLineDescription?: string | null;
  /**
   * Campo virtuale calcolato dal backend: descrizione auto-generata come
   * "{prefisso} {data} — {servizio} — {operatore, albo}".
   */
  invoiceLineDescriptionAuto?: string | null;
  service: {
    id: string;
    name: string;
    defaultPrice?: number | null;
    discountFE?: number | null;
  };
}

// ==================== STRUMENTO UTILIZZATO ====================

export interface TrattamentoStrumento {
  id: string;
  instrumentId: string;
  wasUsed: boolean;
  instrument: {
    id: string;
    name: string;
  };
}

// ==================== RIGA FATTURA CUSTOM ====================

export interface TrattamentoInvoiceLine {
  id: string;
  treatmentId: string;
  description: string;
  amount: number;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== TRATTAMENTO CON DETTAGLI ====================

export interface Trattamento {
  id: string;
  appointmentId: string;
  operatorId: string;
  patientId?: string | null;

  status: TreatmentStatus;
  /**
   * True se la chiusura è stata forzata da segreteria/admin perché
   * l'operatore aveva dimenticato di completare il trattamento.
   * Mostrato in UI con un badge per audit visivo.
   */
  forcedClosure?: boolean;
  scontoFE: boolean;

  price: number;
  isPaid: boolean;
  paymentMethod?: PaymentMethod | null;
  paidAt?: string | null;
  collectedBy?: string | null;

  readyForBilling: boolean;
  readyForBillingAt?: string | null;

  isInvoicedToPatient: boolean;
  invoicedToPatientAt?: string | null;
  patientInvoiceNumber?: string | null;

  isInvoicedByOperator: boolean;
  invoicedByOperatorAt?: string | null;
  operatorInvoiceNumber?: string | null;

  // ==================== BILLING (sessione 6 — clinico ↔ accounting) ====================

  /**
   * Stato del trattamento nel ciclo di fatturazione cross-modulo.
   * Aggiornato sia da azioni locali (close, setReady, cancel) sia dal
   * consumer di `ex.accounting.events` lato backend.
   * Vedi backend `TreatmentBillingStatus` enum per state machine completa.
   */
  billingStatus?: TreatmentBillingStatus | null;

  /** Quante volte il treatment è stato emendato dopo l'invio iniziale (0 = mai). */
  amendmentRevision?: number | null;

  // Snapshot dati fattura ricevuti dall'accounting via `billable.invoiced`.
  accountingBillableEventId?: string | null;
  accountingInvoiceUrl?: string | null;
  accountingInvoiceIssuedAt?: string | null;
  accountingDocumentType?: string | null;
  // Snapshot dati nota credito (refund / partial-refund / reissue).
  accountingCreditNoteNumber?: string | null;
  accountingCreditNoteIssuedAt?: string | null;
  accountingRefundReason?: string | null;

  // Alert per race condition `billable.cancellation-rejected`. Mostrato
  // come banner finché l'operatore non lo dismisce (mutation
  // `dismissBillingAlert`). Vedi backend Step 3 + 7.4.
  billingAlertMessage?: string | null;
  billingAlertAt?: string | null;
  billingAlertDismissedAt?: string | null;

  // Sessione 7 — protocollo recall clinico↔accounting.
  // Operatore clicca "Richiama indietro" → recallRequestId/At valorizzati
  // (status NON cambia). Accounting risponde con:
  //  - billable.recall-accepted → handler azzera questi campi, status → NOT_READY
  //  - billable.recall-rejected → popola lastRecallRejection*, recall* azzerati
  // Banner one-way "restituito dall'amministrazione" da returned-to-clinical.
  recallRequestId?: string | null;
  recallRequestedAt?: string | null;
  lastRecallRejectionMessage?: string | null;
  lastRecallRejectionAt?: string | null;
  returnedFromAccountingReason?: string | null;
  returnedFromAccountingAt?: string | null;
  returnedFromAccountingByEmail?: string | null;
  returnedFromAccountingDismissedAt?: string | null;

  // Audit cancellation (Step 7.4 — colonne dedicate, NON soft-delete generico).
  cancelledAt?: string | null;
  cancelledByUserId?: string | null;
  cancellationReason?: string | null;

  clinicalNotes?: string | null;
  secretaryNotes?: string | null;
  operatorNotes?: string | null;
  patientNotes?: string | null;

  painLevel?: number | null;
  painBefore?: number | null;
  painAfter?: number | null;

  startedAt: string;
  completedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;

  // Relazioni popolate
  operator: TrattamentoOperatore;
  patient?: TrattamentoPaziente | null;
  appointment: TrattamentoAppuntamento;
  treatmentServices: TrattamentoServizio[];
  instruments?: TrattamentoStrumento[];
  invoiceLines?: TrattamentoInvoiceLine[];
}

// ==================== FILTRI ====================

export interface TrattamentiFilters {
  operatorId?: string | null;
  patientId?: string | null;
  statuses?: TreatmentStatus[];
  /**
   * Filtro multi-select sullo stato fatturazione clinico ↔ accounting
   * (sessione 6). Default: nessun filtro = mostra tutti. Filtraggio
   * lato client (la query server-side ritorna sempre tutti); per dataset
   * grandi valutare server-side push-down in roadmap.
   */
  billingStatuses?: TreatmentBillingStatus[];
  dateFrom?: string | null;       // YYYY-MM-DD
  dateTo?: string | null;
  readyForBilling?: boolean | null;
  isInvoicedToPatient?: boolean | null;
  scontoFE?: boolean | null;
  limit?: number;
  offset?: number;
}

// ==================== VISTA ====================

export type TrattamentiViewMode = 'flat' | 'by-patient' | 'by-operator' | 'by-day-operator';

// ==================== INPUT MUTAZIONI ====================

export interface UpdateTreatmentBySecretaryInput {
  id: string;
  price?: number;
  scontoFE?: boolean;
  secretaryNotes?: string;
  treatmentServices?: {
    serviceId: string;
    price?: number;
    duration?: number;
    orderPosition?: number;
    isCustomPrice?: boolean;
  }[];
}

export interface CreateTreatmentInvoiceLineInput {
  treatmentId: string;
  description: string;
  amount: number;
}

export interface UpdateTreatmentInvoiceLineInput {
  id: string;
  description?: string;
  amount?: number;
}

export interface UpdateTreatmentServiceInvoiceDescriptionInput {
  treatmentServiceId: string;
  description?: string;
}

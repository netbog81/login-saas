/**
 * Tipi degli eventi pubblicati dal clinico su `ex.clinical.events` e ricevuti
 * dal clinico su `ex.accounting.events`.
 *
 * Routing key: `<entity>.<action>.<tenantAlias>` (es. `treatment.closed.bdq`).
 *
 * Wrapper standard `CurandisEvent` allineato al registry
 * (vedi RegistryEventPublisher / specifica §4).
 */

// ============================================================================
// Wrapper standard
// ============================================================================

export interface CurandisEvent<P = unknown> {
  schemaVersion: '1.0';
  eventId: string;          // UUID v4, generato dal publisher
  occurredAt: string;       // ISO 8601 UTC con millisecondi
  eventType: ClinicalOutboundEventType | AccountingInboundEventType;
  tenantAlias: string;      // es. "bdq"
  correlationId?: string;   // UUID per tracing cross-modulo
  producerVersion: string;  // es. "1.0.0"
  payload: P;
}

// ============================================================================
// Eventi pubblicati dal clinico
// ============================================================================

export type ClinicalOutboundEventType =
  | 'service.upserted'
  | 'service.deleted'
  | 'product.upserted'
  | 'product.deleted'
  | 'treatment.closed'
  | 'treatment.amended'
  | 'treatment.cancelled'
  | 'sale.completed';

// ----- service.* -----

export interface ServiceUpsertedPayload {
  serviceId: string;
  serviceCode: string;
  name: string;
  description?: string | null;
  defaultPrice: string;     // numeric come string
  discountFE?: string | null;
  macroCategory?: string | null;
  isActive: boolean;
}

export interface ServiceDeletedPayload {
  serviceId: string;
  deletedAt: string;        // ISO 8601
}

// ----- product.* -----

export interface ProductUpsertedPayload {
  productId: string;
  productCode: string;
  name: string;
  description?: string | null;
  defaultPrice: string;
  category?: string | null;
  isActive: boolean;
}

export interface ProductDeletedPayload {
  productId: string;
  deletedAt: string;
}

// ----- treatment.closed / treatment.amended -----

export type TreatmentLineType = 'SERVICE' | 'CUSTOM';

export interface TreatmentLineService {
  lineId: string;                       // TreatmentService.id
  lineType: 'SERVICE';
  serviceId: string;
  serviceCode: string;
  executedByUserId: string | null;      // Keycloak sub (null se operator orfano)
  professionalRegistration?: string | null;
  macroCategory?: string | null;
  quantity: string;                     // hardcoded "1" per MVP
  duration?: number | null;             // minuti
  finalUnitPrice: string;               // numeric come string (vincolante)
  isCustomPrice: boolean;
  invoiceLineDescription?: string | null;
  diagnosis?: string | null;
  icdCode?: string | null;
  externalDoctorName?: string | null;
  externalPrescriptionRef?: string | null;
}

export interface TreatmentLineCustom {
  lineId: string;                       // TreatmentInvoiceLine.id
  lineType: 'CUSTOM';
  description: string;
  amount: string;
  quantity: string;                     // hardcoded "1"
  createdByUserId: string | null;       // Keycloak sub (null se appuser orfano)
}

export type TreatmentLine = TreatmentLineService | TreatmentLineCustom;

export interface TreatmentPayment {
  isPaid: boolean;
  paidAt?: string | null;               // ISO 8601
  paymentMethod?: string | null;
  amount: string;
  collectedByUserId: string | null;     // Keycloak sub
}

export interface TreatmentNotes {
  secretary: string | null;
  operator: string | null;
  patient: string | null;
}

export interface TreatmentClosedPayload {
  treatmentId: string;
  siteId: string;
  beneficiarySubjectId: string;
  executionDate: string;                // YYYY-MM-DD
  closedAt: string;                     // ISO 8601
  closedByUserId: string | null;        // Keycloak sub
  forcedClosure: boolean;
  lines: TreatmentLine[];
  totalAmount: string;
  payment?: TreatmentPayment;
  requestImmediateInvoice: boolean;
  notes: TreatmentNotes;
}

export interface TreatmentAmendedPayload extends TreatmentClosedPayload {
  revision: number;                     // intero monotono crescente
  amendmentReason: string;
}

// ----- treatment.cancelled -----

export interface TreatmentCancelledPayload {
  treatmentId: string;
  cancelledAt: string;
  cancelledByUserId: string | null;     // Keycloak sub
  reason: string;
}

// ----- sale.completed (vendita prodotti standalone) -----

export type SaleType = 'PRODUCT'; // 'VOUCHER' | 'PACKAGE' = roadmap futura

export interface SaleLineProduct {
  lineId: string;
  itemType: 'PRODUCT';
  productId: string;
  productCode: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
}

export interface SaleCompletedPayload {
  saleId: string;
  saleType: SaleType;
  siteId: string;
  executionDate: string;
  soldByUserId: string | null;          // Keycloak sub
  purchaserSubjectId: string;
  beneficiarySubjectId: string;
  lines: SaleLineProduct[];
  totalAmount: string;
  payment?: TreatmentPayment;
  requestImmediateInvoice: boolean;
  notes: string | null;
}

// ============================================================================
// Eventi consumati dal clinico (da accounting)
// ============================================================================

export type AccountingInboundEventType =
  | 'billable.received'
  | 'billable.invoiced'
  | 'billable.refunded'
  | 'billable.partially-refunded'
  | 'billable.reissued'
  | 'billable.cancellation-rejected';

export interface BillableReceivedPayload {
  billableEventId: string;
  treatmentId?: string;
  saleId?: string;
  status: 'PENDING';
  serviceMappingStatus: 'mapped' | 'pending_service_mapping' | 'pending_product_mapping';
  receivedAt: string;
}

export interface BillableInvoicedPayload {
  billableEventId: string;
  treatmentId?: string;
  saleId?: string;
  documentId: string;
  documentType: 'INVOICE' | 'PROFORMA' | 'CREDIT_NOTE';
  invoiceNumber: string;
  invoiceSeries?: string | null;
  invoiceYear: number;
  issuedAt: string;
  totalAmount: string;
  documentUrl?: string | null;
}

export interface BillableRefundedPayload {
  billableEventId: string;
  treatmentId?: string;
  originalDocumentId: string;
  originalInvoiceNumber: string;
  creditNoteDocumentId: string;
  creditNoteNumber: string;
  creditNoteAmount: string;
  refundedAt: string;
  reason?: string | null;
}

export interface BillablePartiallyRefundedPayload extends BillableRefundedPayload {
  refundedAmount: string;
}

export interface BillableReissuedPayload {
  billableEventId: string;
  treatmentId?: string;
  oldDocumentId: string;
  oldInvoiceNumber: string;
  creditNoteDocumentId: string;
  creditNoteNumber: string;
  newDocumentId: string;
  newInvoiceNumber: string;
  reissuedAt: string;
  reason?: string | null;
}

export interface BillableCancellationRejectedPayload {
  treatmentId: string;
  billableEventId: string;
  reason: 'already_invoiced' | string;
  currentStatus: string;
  currentInvoiceNumber: string;
  rejectedAt: string;
}

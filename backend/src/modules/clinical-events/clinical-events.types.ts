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
  | 'treatment.recall-requested'
  | 'treatment.retry-invoice-requested'
  | 'treatment.payment-recorded'
  | 'treatment.payment-cancelled'
  | 'sale.completed';

// ----- service.* -----

export interface ServiceUpsertedPayload {
  serviceId: string;
  serviceCode: string;
  name: string;
  description?: string | null;
  defaultPrice: string;     // numeric come string — somma autoritativa fatturata
  discountFE?: string | null;
  // Scomposizione introdotta 2026-06-05: tariffa servizio (base provvigione)
  // + extra studio (manutenzione strumenti, fuori provvigione). Somma =
  // defaultPrice / discountFE. Null per servizi creati prima del backfill
  // o quando il client non manda la breakdown.
  serviceFee?: string | null;
  studioExtra?: string | null;
  serviceFeeFE?: string | null;
  studioExtraFE?: string | null;
  macroCategory?: string | null;
  isActive: boolean;
  /**
   * 2026-07-07 — Descrizione riga fattura DEFAULT a livello di SOLO servizio
   * (nessun contesto operatore/data/strumenti: quei segnaposto restano vuoti
   * e vengono ripuliti dal renderer). Calcolata con la stessa config di
   * macro-categoria del TreatmentEventMapper (service_invoice_prefixes).
   * Usata da accounting come prefill modificabile per le righe manuali.
   * Assente/null per publisher legacy → accounting mantiene il valore
   * precedente.
   */
  invoiceLineDescriptionDefault?: string | null;
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

// ----- treatment.payment-recorded -----

/**
 * Una riga di "tender" di un incasso: una modalità di pagamento e l'importo
 * versato con essa. In step (a) l'incasso ha una sola riga; lo split multi-riga
 * (contanti + bancomat + voucher) riusa lo stesso array con più elementi.
 *
 * - kind 'method': pagamento con un metodo accounting (`paymentMethodId`).
 * - kind 'voucher': consumo di un voucher (`voucherId`), il metodo è implicito.
 */
export interface TreatmentTenderLine {
  kind: 'method' | 'voucher';
  paymentMethodId?: string | null; // valorizzato se kind='method'
  voucherId?: string | null;       // valorizzato se kind='voucher'
  amount: string;                  // decimal string "N.NN"
}

/**
 * Incasso registrato nel clinico DOPO l'invio a fatturazione (billingStatus IN
 * SENT/PENDING/INVOICED). Pre-invio il payment viaggia già dentro
 * `treatment.closed`, quindi questo evento NON viene pubblicato in quel caso.
 * Mai pubblicato per i treatment con scontoFE (pagamento solo nel clinico).
 *
 * `paymentId` è la chiave first-write-wins dell'INTERO incasso (non delle
 * singole righe). Accounting registra l'incasso in modo idempotente per
 * treatment (dedup `(organizationId, sourceTreatmentId)`).
 */
export interface TreatmentPaymentRecordedPayload {
  treatmentId: string;
  paymentId: string;                 // UUID, chiave first-write-wins
  isPaid: true;
  paidAt: string;                    // ISO 8601
  totalAmount: string;               // decimal string, importo totale incassato
  tenderLines: TreatmentTenderLine[];
  collectedByUserId: string | null;  // Keycloak sub
  recordedAt: string;                // ISO 8601
  /**
   * 2026-07-08 — Incasso di fattura multi-trattamento (campi additivi).
   * Quando la fattura copre N treatment, il clinico registra UN incasso a
   * saldo intero documento: un solo evento (treatmentId = primario),
   * `totalAmount` = totale documento, e qui l'elenco completo dei treatment
   * marcati pagati con lo stesso paymentId (audit lato accounting).
   */
  accountingDocumentId?: string;
  coveredTreatmentIds?: string[];
}

// ----- treatment.payment-cancelled -----

/**
 * 2026-07-08 — Annullo di un pagamento dal clinico, consentito SOLO se la
 * fattura NON è emessa (per i fatturati lo storno si fa da accounting, che
 * risponde con billable.payment-reversed). Accounting deve:
 *  - cancellare l'eventuale PaymentAllocation ORFANA (salesDocumentId NULL)
 *    con quel sourcePaymentId/sourceTreatmentId;
 *  - cancellare l'eventuale riga pending_clinical_payments;
 *  - azzerare payload.payment sui billable PENDING del treatment (altrimenti
 *    l'incasso embedded "risorgerebbe" all'emissione).
 * Idempotente: se non trova nulla, ack senza errori.
 */
export interface TreatmentPaymentCancelledPayload {
  treatmentId: string;
  /** paymentId dell'incasso annullato (quello che era stato comunicato). */
  paymentId: string;
  cancelledByUserId: string | null; // Keycloak sub
  cancelledAt: string;              // ISO 8601
}

// ----- treatment.recall-requested -----

/**
 * Richiesta di "richiamare indietro" un treatment già inviato a fatturazione,
 * per consentire all'operatore clinico di modificarlo. Accounting risponde
 * con `billable.recall-accepted` (treatment torna NOT_READY) o
 * `billable.recall-rejected` (doc fiscale già emesso).
 *
 * NOTA: il publisher NON cambia subito `Treatment.billingStatus`. Salva
 * `recallRequestId` (= eventId di QUESTO evento) e `recallRequestedAt`,
 * lo stato cambia solo all'arrivo della response accounting (handler).
 */
export interface TreatmentRecallRequestedPayload {
  treatmentId: string;
  reason?: string;
}

// ----- treatment.retry-invoice-requested -----

/**
 * 2026-06-30 — Richiesta di ri-tentare l'auto-emissione fattura per un
 * treatment rimasto bloccato (es. indirizzo paziente aggiunto). Accounting
 * ri-chiama AutoIssue: se la causa è risolta emette `billable.invoiced`,
 * altrimenti riarriva `billable.invoice-blocked` col motivo aggiornato.
 */
export interface TreatmentRetryInvoiceRequestedPayload {
  treatmentId: string;
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
  | 'billable.uninvoiced'
  | 'billable.refunded'
  | 'billable.partially-refunded'
  | 'billable.reissued'
  | 'billable.cancellation-rejected'
  | 'billable.recall-accepted'
  | 'billable.recall-rejected'
  | 'billable.returned-to-clinical'
  | 'billable.payment-recorded'
  /**
   * 2026-07-03 — Incasso cancellato in accounting (deleteDocumentPayment):
   * il clinico resetta isPaid se il paymentId combacia con quello stornato.
   */
  | 'billable.payment-reversed'
  /**
   * 2026-06-30 — Auto-emissione fattura bloccata da causa risolvibile
   * (indirizzo paziente mancante, P.IVA mancante, mapping pending). Il clinico
   * salva il motivo su `billingHoldReason*` e lo mostra all'operatore con il
   * pulsante "Verifica risoluzione e riprova".
   */
  | 'billable.invoice-blocked';

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
  // RECEIPT: pazienti privati (senza P.IVA) → accounting emette ricevuta, non
  // fattura INVOICE/SDI. Allineato al type accounting BillableInvoicedPayload.
  documentType: 'INVOICE' | 'PROFORMA' | 'CREDIT_NOTE' | 'RECEIPT';
  invoiceNumber: string;
  invoiceSeries?: string | null;
  invoiceYear: number;
  issuedAt: string;
  totalAmount: string;
  documentUrl?: string | null;
  /**
   * 2026-07-08 — Fatture multi-trattamento (campi additivi; assenti negli
   * eventi di producer accounting vecchi). `totalAmount` resta il totale
   * DOCUMENTO bollo incluso.
   */
  /** Somma delle righe del documento riferite a QUESTO treatment (senza bollo). */
  treatmentLinesAmount?: string;
  /** Quanti treatment clinici distinti copre il documento (1 = fattura singola). */
  documentTreatmentCount?: number;
  /** Tutti i billableEventId del documento riferiti a questo treatment (anti-stale a membership). */
  billableEventIds?: string[];
}

/**
 * Cancellazione di un documento (INVOICE/RECEIPT) emesso ma non ancora
 * trasmesso fiscalmente (es. allo SDI). Il billable torna disponibile per
 * nuova fatturazione: NON è un rimborso — non c'è nota credito. Il clinico
 * deve riportare `billingStatus = PENDING` e ripulire i campi `accounting*`
 * relativi alla fattura cancellata.
 */
export interface BillableUninvoicedPayload {
  billableEventId: string;
  treatmentId?: string;            // valorizzato se sourceSystem === 'clinico-treatment'
  saleId?: string;                 // valorizzato se sourceSystem === 'clinico-sale'
  cancelledDocumentId: string;
  cancelledDocumentNumber: string; // es. "I2026-00001"
  cancelledDocumentType: 'INVOICE' | 'RECEIPT';
  uninvoicedAt: string;            // ISO 8601
  reason?: string;                 // oggi sempre 'invoice_cancelled_pre_transmission'
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

/**
 * Risposta positiva al `treatment.recall-requested`: accounting ha cancellato
 * il billable (e l'eventuale fattura DRAFT collegata). Il clinico può
 * riaprire il trattamento per modifiche.
 *
 * `requestId` (= eventId del recall-requested originario) consente la
 * correlazione richiesta↔risposta lato clinico.
 */
export interface BillableRecallAcceptedPayload {
  requestId: string;
  billableEventId: string;
  treatmentId: string;
  cancelledDraftDocumentId?: string;
  cancelledDraftDocumentNumber?: string;
  acceptedAt: string;
  reason?: string;
}

/**
 * Risposta negativa al `treatment.recall-requested`: esiste già un documento
 * fiscale emesso. Il clinico mostra `message` all'utente.
 */
export interface BillableRecallRejectedPayload {
  requestId: string;
  billableEventId: string;
  treatmentId: string;
  reason: 'invoice_issued' | 'credit_note_pending' | 'not_found' | 'not_eligible';
  blockingDocumentNumber?: string;
  blockingDocumentType?: 'INVOICE' | 'RECEIPT' | 'CREDIT_NOTE';
  blockingDocumentStatus?: string;
  rejectedAt: string;
  message: string;
}

/**
 * Restituzione one-way iniziata dall'operatore amministrativo accounting.
 * Il clinico riapre il trattamento e mostra il `reason` all'utente.
 */
export interface BillableReturnedToClinicalPayload {
  billableEventId: string;
  treatmentId?: string;
  saleId?: string;
  cancelledDraftDocumentId?: string;
  cancelledDraftDocumentNumber?: string;
  returnedAt: string;
  reason: string;
  returnedByUserId?: string;
  returnedByEmail?: string;
}

export interface BillableCancellationRejectedPayload {
  treatmentId: string;
  billableEventId: string;
  reason: 'already_invoiced' | string;
  currentStatus: string;
  currentInvoiceNumber: string;
  rejectedAt: string;
}

/**
 * Incasso registrato lato accounting (un operatore amministrativo ha segnato
 * il treatment come incassato) da propagare al clinico per aggiornare
 * isPaid/paymentMethod/paidAt e notificare via SSE.
 *
 * Idempotenza first-write-wins: il clinico applica solo se isPaid passa da
 * false a true (UPDATE ... WHERE isPaid=false); se l'incasso era già stato
 * registrato nel clinico, l'evento viene scartato senza errore.
 */
export interface BillablePaymentRecordedPayload {
  billableEventId: string;
  treatmentId: string;
  paymentId: string;                 // chiave first-write-wins (lato accounting)
  paidAt: string;                    // ISO 8601
  paymentMethod?: string | null;     // code metodo accounting (best-effort)
  amount: string;                    // decimal string
  recordedByUserId?: string;
  recordedByEmail?: string;
  recordedAt: string;                // ISO 8601
}

/**
 * 2026-07-03 — `billable.payment-reversed`. Un incasso è stato CANCELLATO in
 * accounting (deleteDocumentPayment): il clinico rimette isPaid=false, ma
 * SOLO se il paymentId salvato sul treatment corrisponde a quello stornato
 * (`paymentId` = allocazione accounting, `sourcePaymentId` = eventuale
 * pagamento clinico che l'aveva originata). Un incasso diverso non si tocca.
 */
export interface BillablePaymentReversedPayload {
  billableEventId: string | null;
  treatmentId: string;
  paymentId: string;                 // allocazione accounting cancellata
  sourcePaymentId?: string | null;   // pagamento clinico d'origine (se c'era)
  reversedAt: string;                // ISO 8601
  reversedByUserId?: string;
  reversedByEmail?: string;
  reason?: string;
}

/**
 * 2026-06-30 — `billable.invoice-blocked`. Auto-emissione fattura bloccata da
 * causa risolvibile. Il clinico salva `reasonCode`/`reasonMessage` su
 * `billingHoldReason*` e mostra il motivo all'operatore.
 */
export interface BillableInvoiceBlockedPayload {
  billableEventId: string;
  treatmentId?: string;
  saleId?: string;
  reasonCode: string;                // MISSING_ADDRESS | MISSING_VAT | MAPPING_PENDING | ...
  reasonMessage: string;             // testo human-friendly
  retriesAttempted: number;
  blockedAt: string;                 // ISO 8601
}

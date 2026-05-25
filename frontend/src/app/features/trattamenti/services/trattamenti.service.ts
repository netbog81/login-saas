import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import {
  Trattamento,
  TrattamentiFilters,
  TrattamentoInvoiceLine,
  TreatmentStatus,
  UpdateTreatmentBySecretaryInput,
  UpdateTreatmentServiceInvoiceDescriptionInput,
  CreateTreatmentInvoiceLineInput,
  UpdateTreatmentInvoiceLineInput,
  PaymentMethod,
} from '../models/trattamento.model';
import {
  TREATMENTS_FOR_SECRETARY,
  TREATMENTS_FOR_OPERATOR,
  UPDATE_TREATMENT_BY_SECRETARY,
  SET_TREATMENTS_READY_FOR_BILLING,
  UPDATE_TREATMENT_SERVICE_INVOICE_DESCRIPTION,
  CREATE_TREATMENT_INVOICE_LINE,
  UPDATE_TREATMENT_INVOICE_LINE,
  DELETE_TREATMENT_INVOICE_LINE,
  RECORD_TREATMENT_PAYMENT,
  CLOSE_TREATMENT,
  REOPEN_TREATMENT,
  FORCE_CLOSE_TREATMENT,
  CANCEL_TREATMENT_BILLING,
  DISMISS_BILLING_ALERT,
  REQUEST_TREATMENT_RECALL,
  DISMISS_RETURN_FROM_ACCOUNTING_BANNER,
  RESEND_TREATMENT_TO_ACCOUNTING,
} from '../graphql/trattamenti.operations';

/**
 * Proietta il payload GraphQL `patient { id, displayName, subject: {firstName, lastName} }`
 * sulla shape piatta `TrattamentoPaziente { id, nome, cognome }` usata dai consumer.
 * Idempotente: se `patient` è già piatto o assente, no-op.
 */
function flattenPatient(t: Trattamento): Trattamento {
  const p = t.patient as any;
  if (!p) return t;
  if (p.nome != null && p.cognome != null) return t;
  return {
    ...t,
    patient: {
      id: p.id,
      nome: p.subject?.firstName ?? p.displayName?.split(' ')[0] ?? '',
      cognome: p.subject?.lastName ?? p.displayName?.split(' ').slice(1).join(' ') ?? '',
    },
  };
}

/**
 * Layer 3 - Business logic & GraphQL per la feature Trattamenti.
 * Usa BaseGraphQLService per integrazione NgZone obbligatoria.
 */
@Injectable({ providedIn: 'root' })
export class TrattamentiService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  // ==================== QUERIES ====================

  /**
   * Per segreteria/admin: tutti i trattamenti con filtri.
   * Se Apollo restituisce undefined (errore GraphQL), ritorna array vuoto
   * invece di crashare: lo stato dell'errore viene gestito dal chiamante.
   */
  getForSecretary(filters: TrattamentiFilters = {}): Observable<Trattamento[]> {
    return this.query<{ treatmentsForSecretary: Trattamento[] }>(
      TREATMENTS_FOR_SECRETARY,
      this.sanitizeFilters(filters),
    ).pipe(map(r => (r?.treatmentsForSecretary ?? []).map(flattenPatient)));
  }

  /**
   * Per operatore: solo i propri trattamenti con filtri limitati.
   */
  getForOperator(
    operatorId: string,
    filters: Omit<TrattamentiFilters, 'operatorId' | 'patientId' | 'readyForBilling' | 'isInvoicedToPatient' | 'scontoFE'> = {},
  ): Observable<Trattamento[]> {
    const vars = this.sanitizeFilters({ ...filters, operatorId });
    return this.query<{ treatmentsForOperator: Trattamento[] }>(
      TREATMENTS_FOR_OPERATOR,
      vars,
    ).pipe(map(r => (r?.treatmentsForOperator ?? []).map(flattenPatient)));
  }

  // ==================== MUTATIONS — SECRETARY ECONOMIC ====================

  updateBySecretary(input: UpdateTreatmentBySecretaryInput): Observable<Trattamento> {
    return this.mutate<{ updateTreatmentBySecretary: Trattamento }>(
      UPDATE_TREATMENT_BY_SECRETARY,
      { input },
    ).pipe(map(r => r.updateTreatmentBySecretary));
  }

  /**
   * Marca treatments come pronti per fatturazione (accounting handoff).
   *
   * @param immediateInvoice se true, payload `treatment.closed` viene
   *   emesso con `requestImmediateInvoice=true` → AutoIssue accounting
   *   fatturazione automatica (post Step 6.5bis backend).
   *   Default false: la fatturazione resta su passo separato.
   */
  setReadyForBilling(
    ids: string[],
    ready: boolean,
    immediateInvoice = false,
  ): Observable<Pick<Trattamento, 'id' | 'readyForBilling' | 'readyForBillingAt'>[]> {
    return this.mutate<{ setTreatmentsReadyForBilling: Trattamento[] }>(
      SET_TREATMENTS_READY_FOR_BILLING,
      { ids, ready, immediateInvoice },
    ).pipe(map(r => r.setTreatmentsReadyForBilling));
  }

  /**
   * "Fattura subito + incassa" UI helper (sessione 6 Step 6.5).
   *
   * Chiama `setReadyForBilling([id], true, true)` → backend serializza il
   * payload `treatment.closed` con `requestImmediateInvoice=true`. Lato
   * accounting:
   *  - mapping fiscalmente configurato (isFiscallyConfigured=true) →
   *    AutoIssue scatta automaticamente, INVOICE emessa entro pochi secondi
   *  - mapping pending → AutoIssue skippa, riparte automaticamente quando
   *    admin configura il mapping (event LOCAL_BILLABLE_MAPPING_COMPLETED).
   *
   * Niente passo manuale operatore mai (chiarimento accounting smoke 9.B
   * 2026-05-08).
   */
  setReadyForBillingImmediate(id: string): Observable<Pick<Trattamento, 'id' | 'readyForBilling' | 'readyForBillingAt'>[]> {
    return this.setReadyForBilling([id], true, true);
  }

  /**
   * Cancella un trattamento dal punto di vista billing (sessione 6 Step 7.4
   * backend). Triggera publish `treatment.cancelled.<tenant>` SOLO se il
   * treatment era già stato pubblicato (SENT/PENDING). Backend rifiuta
   * con BadRequestException per stati post-INVOICED.
   */
  cancelTreatment(id: string, reason: string): Observable<Trattamento> {
    return this.mutate<{ cancelTreatment: Trattamento }>(
      CANCEL_TREATMENT_BILLING,
      { id, reason },
    ).pipe(map(r => flattenPatient(r.cancelTreatment)));
  }

  /**
   * Dismissa il billing alert di un treatment (sessione 6 Step 6.7).
   * Setta `billingAlertDismissedAt = now`. Idempotente: backend ritorna
   * il treatment invariato se non c'è alert o è già dismissato.
   *
   * Use case: operatore clicca "Letto" sull'alert
   * `cancellation-rejected` nella BillingSection.
   */
  dismissBillingAlert(id: string): Observable<Trattamento> {
    return this.mutate<{ dismissBillingAlert: Trattamento }>(
      DISMISS_BILLING_ALERT,
      { id },
    ).pipe(map(r => flattenPatient(r.dismissBillingAlert)));
  }

  /**
   * Sessione 7 — Richiama indietro un trattamento già inviato a fatturazione.
   * Backend salva recallRequestId/At immediatamente (status invariato),
   * pubblica `treatment.recall-requested` su accounting. La risposta async
   * (recall-accepted/rejected) arriva via consumer, modifica lo stato e i
   * campi recall — il frontend la riceve al prossimo refetch/polling.
   */
  requestRecall(id: string, reason?: string): Observable<Trattamento> {
    return this.mutate<{ requestTreatmentRecall: Trattamento }>(
      REQUEST_TREATMENT_RECALL,
      { id, reason: reason ?? null },
    ).pipe(map(r => flattenPatient(r.requestTreatmentRecall)));
  }

  /**
   * Sessione 7 — Forza re-invio di un treatment ad accounting (escape hatch).
   * Backend rifiuta con 400 se non in SENT o se readyForBillingAt < 5min fa.
   */
  resendToAccounting(id: string): Observable<Trattamento> {
    return this.mutate<{ resendTreatmentToAccounting: Trattamento }>(
      RESEND_TREATMENT_TO_ACCOUNTING,
      { id },
    ).pipe(map(r => flattenPatient(r.resendTreatmentToAccounting)));
  }

  /**
   * Sessione 7 — Chiude il banner "Restituito dall'amministrazione" sul
   * treatment. UI-local, nessun evento publish.
   */
  dismissReturnFromAccountingBanner(id: string): Observable<Trattamento> {
    return this.mutate<{ dismissReturnFromAccountingBanner: Trattamento }>(
      DISMISS_RETURN_FROM_ACCOUNTING_BANNER,
      { id },
    ).pipe(map(r => flattenPatient(r.dismissReturnFromAccountingBanner)));
  }

  // ==================== INVOICE LINE DESCRIPTIONS (su TreatmentService) ====================

  updateServiceInvoiceDescription(
    input: UpdateTreatmentServiceInvoiceDescriptionInput,
  ): Observable<{ id: string; invoiceLineDescription?: string | null; invoiceLineDescriptionAuto?: string | null }> {
    return this.mutate<{
      updateTreatmentServiceInvoiceDescription: { id: string; invoiceLineDescription?: string | null; invoiceLineDescriptionAuto?: string | null };
    }>(UPDATE_TREATMENT_SERVICE_INVOICE_DESCRIPTION, { input }).pipe(
      map(r => r.updateTreatmentServiceInvoiceDescription),
    );
  }

  // ==================== INVOICE LINES (custom segreteria) ====================

  createInvoiceLine(
    input: CreateTreatmentInvoiceLineInput,
    createdBy?: string,
  ): Observable<TrattamentoInvoiceLine> {
    return this.mutate<{ createTreatmentInvoiceLine: TrattamentoInvoiceLine }>(
      CREATE_TREATMENT_INVOICE_LINE,
      { input, createdBy },
    ).pipe(map(r => r.createTreatmentInvoiceLine));
  }

  updateInvoiceLine(input: UpdateTreatmentInvoiceLineInput): Observable<TrattamentoInvoiceLine> {
    return this.mutate<{ updateTreatmentInvoiceLine: TrattamentoInvoiceLine }>(
      UPDATE_TREATMENT_INVOICE_LINE,
      { input },
    ).pipe(map(r => r.updateTreatmentInvoiceLine));
  }

  deleteInvoiceLine(id: string): Observable<boolean> {
    return this.mutate<{ deleteTreatmentInvoiceLine: boolean }>(
      DELETE_TREATMENT_INVOICE_LINE,
      { id },
    ).pipe(map(r => r.deleteTreatmentInvoiceLine));
  }

  // ==================== PAYMENT / STATUS ====================

  recordPayment(
    id: string,
    paymentMethod: PaymentMethod,
    collectedBy: string,
    amount: number | undefined,
    callerRole: 'OPERATOR' | 'SECRETARY' = 'SECRETARY',
  ): Observable<Trattamento> {
    return this.mutate<{ recordTreatmentPayment: Trattamento }>(
      RECORD_TREATMENT_PAYMENT,
      {
        id,
        input: { paymentMethod, collectedBy, amount },
        callerRole,
      },
    ).pipe(map(r => r.recordTreatmentPayment));
  }

  close(id: string, secretaryNotes?: string): Observable<Trattamento> {
    return this.mutate<{ closeTreatment: Trattamento }>(
      CLOSE_TREATMENT,
      { id, input: { secretaryNotes } },
    ).pipe(map(r => r.closeTreatment));
  }

  reopen(id: string): Observable<Trattamento> {
    return this.mutate<{ reopenTreatment: Trattamento }>(
      REOPEN_TREATMENT,
      { id },
    ).pipe(map(r => r.reopenTreatment));
  }

  /**
   * Forza la chiusura di un trattamento IN_PROGRESS (segreteria/admin),
   * tipicamente quando l'operatore ha dimenticato di completarlo.
   * Backend richiede permesso `treatment_force_close`.
   */
  forceClose(id: string, secretaryNotes?: string): Observable<Trattamento> {
    return this.mutate<{ forceCloseTreatment: Trattamento }>(
      FORCE_CLOSE_TREATMENT,
      { id, secretaryNotes },
    ).pipe(map(r => r.forceCloseTreatment));
  }

  // ==================== HELPERS ====================

  /**
   * Calcola il totale di un trattamento sommando righe servizi + righe custom.
   * Nota: se il server ha già un `treatment.price` calcolato, la segreteria
   * può volerlo override. Questo helper serve solo per il display.
   */
  computeTotal(t: Trattamento): number {
    const servicesTotal = (t.treatmentServices || []).reduce(
      (sum, ts) => sum + (Number(ts.price) || 0),
      0,
    );
    const customTotal = (t.invoiceLines || []).reduce(
      (sum, line) => sum + (Number(line.amount) || 0),
      0,
    );
    return servicesTotal + customTotal;
  }

  /**
   * Rimuove valori undefined/null dai filtri per non passarli al server
   * (Apollo invia anche i null, che sovrascrivono i default lato server).
   */
  private sanitizeFilters(filters: TrattamentiFilters): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    // billingStatuses è filtrato lato client (vedi container.applyClientFilters):
    // il backend non espone l'arg, mandarlo causerebbe errore GraphQL.
    const CLIENT_ONLY_KEYS = new Set<string>(['billingStatuses']);
    for (const [key, value] of Object.entries(filters)) {
      if (CLIENT_ONLY_KEYS.has(key)) continue;
      if (value !== undefined && value !== null) {
        out[key] = value;
      }
    }
    return out;
  }
}

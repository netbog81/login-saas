import { Injectable, Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
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
  VoucherFe,
  AccountingPaymentMethod,
  AccountingVoucher,
  PaymentTenderLine,
  OrphanDeletionResult,
} from '../models/trattamento.model';
import {
  TREATMENTS_FOR_SECRETARY,
  TREATMENTS_FOR_SECRETARY_COUNT,
  TREATMENTS_FOR_OPERATOR,
  UPDATE_TREATMENT_BY_SECRETARY,
  SET_TREATMENTS_READY_FOR_BILLING,
  UPDATE_TREATMENT_SERVICE_INVOICE_DESCRIPTION,
  CREATE_TREATMENT_INVOICE_LINE,
  UPDATE_TREATMENT_INVOICE_LINE,
  DELETE_TREATMENT_INVOICE_LINE,
  DELETE_ORPHAN_TREATMENT,
  DELETE_ORPHAN_TREATMENTS,
  RECORD_TREATMENT_PAYMENT,
  CLOSE_TREATMENT,
  REOPEN_TREATMENT,
  FORCE_CLOSE_TREATMENT,
  CANCEL_TREATMENT_BILLING,
  DISMISS_BILLING_ALERT,
  REQUEST_TREATMENT_RECALL,
  DISMISS_RETURN_FROM_ACCOUNTING_BANNER,
  RESEND_TREATMENT_TO_ACCOUNTING,
  RETRY_TREATMENT_INVOICE,
  MARK_SCONTOFE_CASH_PAYMENT,
  CANCEL_TREATMENT_PAYMENT,
  ADD_TREATMENT_SERVICE_LINE,
  UPDATE_TREATMENT_SERVICE_EXECUTOR,
  REMOVE_TREATMENT_SERVICE_LINE,
  TREATMENT_BY_ID,
  USABLE_VOUCHERS_FE,
  VOUCHERS_FE_BY_PATIENT,
  ISSUE_VOUCHER_FE,
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
  private readonly http: HttpClient;

  constructor(injector: Injector) {
    super(injector);
    this.http = injector.get(HttpClient);
  }

  // ==================== INVOICE PDF (PARTE 3) ====================

  /**
   * Scarica il PDF della fattura di un trattamento dal proxy backend clinico
   * (`GET /treatments/:id/invoice-pdf`), che inoltra ad accounting. L'auth
   * interceptor allega automaticamente Authorization + header tenant.
   * Ritorna il Blob: il chiamante lo apre in una nuova tab per la stampa.
   */
  fetchInvoicePdf(treatmentId: string): Observable<Blob> {
    return this.http.get(
      `${environment.apiUrl}/treatments/${treatmentId}/invoice-pdf`,
      { responseType: 'blob' },
    );
  }

  // ==================== QUERIES ====================

  /**
   * Per segreteria/admin: tutti i trattamenti con filtri.
   * Se Apollo restituisce undefined (errore GraphQL / sessione scaduta)
   * NON mascherare con lista vuota: propaga un errore così il container
   * mostra il banner invece di una lista vuota indistinguibile da
   * "nessun trattamento nel periodo".
   */
  getForSecretary(filters: TrattamentiFilters = {}): Observable<Trattamento[]> {
    return this.query<{ treatmentsForSecretary: Trattamento[] }>(
      TREATMENTS_FOR_SECRETARY,
      this.sanitizeFilters(filters),
    ).pipe(map(r => {
      if (!r?.treatmentsForSecretary) {
        throw new Error('Caricamento trattamenti fallito: risposta vuota dal server (sessione scaduta o errore GraphQL). Ricarica la pagina.');
      }
      return r.treatmentsForSecretary.map(flattenPatient);
    }));
  }

  /**
   * Conteggio totale (stessi filtri, senza limit/offset) per il paginator
   * della lista segreteria.
   */
  getForSecretaryCount(filters: TrattamentiFilters = {}): Observable<number> {
    const vars = this.sanitizeFilters(filters);
    delete vars['limit'];
    delete vars['offset'];
    return this.query<{ treatmentsForSecretaryCount: number }>(
      TREATMENTS_FOR_SECRETARY_COUNT,
      vars,
    ).pipe(map(r => r?.treatmentsForSecretaryCount ?? 0));
  }

  /**
   * Sessione 7 — Refetch mirato di UN singolo treatment by id. Usato dai
   * subscriber SSE (treatment_status_changed) per aggiornare la riga in
   * lista senza ricaricare tutta la query pesante TREATMENTS_FOR_SECRETARY.
   */
  getById(id: string): Observable<Trattamento | null> {
    return this.query<{ treatment: Trattamento | null }>(
      TREATMENT_BY_ID,
      { id },
    ).pipe(map(r => (r?.treatment ? flattenPatient(r.treatment) : null)));
  }

  /**
   * Per operatore: solo i propri trattamenti con filtri limitati.
   */
  getForOperator(
    operatorId: string,
    filters: Omit<TrattamentiFilters, 'operatorId' | 'patientId' | 'readyForBilling' | 'isInvoicedToPatient' | 'scontoFE' | 'withoutAppointment'> = {},
  ): Observable<Trattamento[]> {
    const vars = this.sanitizeFilters({ ...filters, operatorId });
    // La query operatore non dichiara $withoutAppointment: la pulizia degli
    // orfani è azione di segreteria. Tolto per non spedire una variabile
    // non dichiarata dall'operazione.
    delete vars['withoutAppointment'];
    return this.query<{ treatmentsForOperator: Trattamento[] }>(
      TREATMENTS_FOR_OPERATOR,
      vars,
    ).pipe(map(r => {
      if (!r?.treatmentsForOperator) {
        throw new Error('Caricamento trattamenti fallito: risposta vuota dal server (sessione scaduta o errore GraphQL). Ricarica la pagina.');
      }
      return r.treatmentsForOperator.map(flattenPatient);
    }));
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
   * Cestina un trattamento ORFANO (appuntamento cancellato dal calendario).
   *
   * Un solo round trip: il backend si occupa anche di annullare l'invio ad
   * accounting se il trattamento era già stato pubblicato (SENT/PENDING),
   * nella stessa transazione del soft-delete. Rifiuta con un messaggio
   * leggibile se il trattamento non è orfano, è già fatturato, è stato
   * pagato con un voucher FE o è già in un conguaglio operatore.
   */
  deleteOrphan(id: string): Observable<boolean> {
    return this.mutate<{ deleteOrphanTreatment: boolean }>(
      DELETE_ORPHAN_TREATMENT,
      { id },
    ).pipe(map(r => r.deleteOrphanTreatment));
  }

  /**
   * Pulizia in blocco degli orfani selezionati. Non atomica: torna l'esito
   * riga per riga così la UI può dire quanti sono stati cestinati e perché
   * gli altri no.
   */
  deleteOrphans(ids: string[]): Observable<OrphanDeletionResult[]> {
    return this.mutate<{ deleteOrphanTreatments: OrphanDeletionResult[] }>(
      DELETE_ORPHAN_TREATMENTS,
      { ids },
    ).pipe(map(r => r.deleteOrphanTreatments ?? []));
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
   * 2026-06-30 — "Verifica risoluzione e riprova": chiede ad accounting di
   * ri-tentare l'emissione fattura per un treatment bloccato (es. dopo aver
   * aggiunto l'indirizzo del paziente). Esito async via SSE.
   */
  retryTreatmentInvoice(id: string): Observable<Trattamento> {
    return this.mutate<{ retryTreatmentInvoice: Trattamento }>(
      RETRY_TREATMENT_INVOICE,
      { id },
    ).pipe(map(r => flattenPatient(r.retryTreatmentInvoice)));
  }

  /**
   * 2026-07-01 — Toggle "Segna come incassato in contanti" (trattamenti sconto
   * FE). paid=true registra l'incasso contanti sul totale; paid=false lo annulla.
   */
  markScontoFeCashPayment(id: string, paid: boolean): Observable<Trattamento> {
    return this.mutate<{ markScontoFeCashPayment: Trattamento }>(
      MARK_SCONTOFE_CASH_PAYMENT,
      { id, paid },
    ).pipe(map(r => flattenPatient(r.markScontoFeCashPayment)));
  }

  /**
   * 2026-07-08 — Annulla il pagamento registrato (solo se non fatturato).
   * Per i fatturati lo storno si fa da accounting.
   */
  cancelTreatmentPayment(id: string): Observable<Trattamento> {
    return this.mutate<{ cancelTreatmentPayment: Trattamento }>(
      CANCEL_TREATMENT_PAYMENT,
      { id },
    ).pipe(map(r => flattenPatient(r.cancelTreatmentPayment)));
  }

  /** 2026-07-02 — Aggiunge una riga servizio (dal catalogo) al trattamento. */
  addTreatmentServiceLine(
    treatmentId: string,
    serviceId: string,
    description?: string,
    price?: number,
    executorOperatorId?: string | null,
  ): Observable<Trattamento> {
    return this.mutate<{ addTreatmentServiceLine: Trattamento }>(
      ADD_TREATMENT_SERVICE_LINE,
      { treatmentId, serviceId, description, price, executorOperatorId },
    ).pipe(map(r => flattenPatient(r.addTreatmentServiceLine)));
  }

  /**
   * 2026-07-15 — Cambia l'operatore esecutore di una riga servizio
   * ("Eseguito da"). null = fallback all'operatore del trattamento.
   */
  updateTreatmentServiceExecutor(
    treatmentServiceId: string,
    executorOperatorId: string | null,
  ): Observable<{
    id: string;
    executorOperatorId?: string | null;
    executorOperator?: { id: string; name: string; surname?: string | null } | null;
  }> {
    return this.mutate<{
      updateTreatmentServiceExecutor: {
        id: string;
        executorOperatorId?: string | null;
        executorOperator?: { id: string; name: string; surname?: string | null } | null;
      };
    }>(UPDATE_TREATMENT_SERVICE_EXECUTOR, {
      treatmentServiceId,
      executorOperatorId,
    }).pipe(map(r => r.updateTreatmentServiceExecutor));
  }

  /** 2026-07-02 — Rimuove una riga servizio del trattamento. */
  removeTreatmentServiceLine(treatmentServiceId: string): Observable<Trattamento> {
    return this.mutate<{ removeTreatmentServiceLine: Trattamento }>(
      REMOVE_TREATMENT_SERVICE_LINE,
      { treatmentServiceId },
    ).pipe(map(r => flattenPatient(r.removeTreatmentServiceLine)));
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
    voucherFeId?: string,
    tenderLines?: PaymentTenderLine[],
    replaceExisting?: boolean,
    /**
     * 2026-09-04 — Incasso parziale con voucher di anticipo: il trattamento
     * non risulta pagato, il residuo resta da fatturare.
     */
    partial?: boolean,
  ): Observable<Trattamento> {
    return this.mutate<{ recordTreatmentPayment: Trattamento }>(
      RECORD_TREATMENT_PAYMENT,
      {
        id,
        input: {
          paymentMethod, collectedBy, amount, voucherFeId, tenderLines, replaceExisting, partial,
        },
        callerRole,
      },
    ).pipe(map(r => r.recordTreatmentPayment));
  }

  // ==================== VOUCHER FE / METODI ACCOUNTING (PARTE 4) ====================

  /** Voucher FE utilizzabili da un paziente (per i pagamenti sconto FE). */
  usableVouchersFe(patientId: string): Observable<VoucherFe[]> {
    return this.query<{ usableVouchersFe: VoucherFe[] }>(USABLE_VOUCHERS_FE, { patientId })
      .pipe(map(r => r.usableVouchersFe ?? []));
  }

  vouchersFeByPatient(patientId: string): Observable<VoucherFe[]> {
    return this.query<{ vouchersFeByPatient: VoucherFe[] }>(VOUCHERS_FE_BY_PATIENT, { patientId })
      .pipe(map(r => r.vouchersFeByPatient ?? []));
  }

  issueVoucherFe(
    patientId: string,
    initialAmount: number,
    expiryDate?: string,
    notes?: string,
  ): Observable<VoucherFe> {
    return this.mutate<{ issueVoucherFe: VoucherFe }>(ISSUE_VOUCHER_FE, {
      patientId,
      initialAmount,
      expiryDate,
      notes,
    }).pipe(map(r => r.issueVoucherFe));
  }

  /** Metodi di pagamento accounting per un trattamento (proxy backend). */
  fetchAccountingPaymentMethods(treatmentId: string): Observable<AccountingPaymentMethod[]> {
    return this.http.get<AccountingPaymentMethod[]>(
      `${environment.apiUrl}/treatments/${treatmentId}/payment-methods`,
    );
  }

  /** Voucher accounting (tipo 1/2) utilizzabili dal paziente (proxy backend). */
  fetchAccountingVouchers(treatmentId: string): Observable<AccountingVoucher[]> {
    return this.http.get<AccountingVoucher[]>(
      `${environment.apiUrl}/treatments/${treatmentId}/vouchers`,
    );
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

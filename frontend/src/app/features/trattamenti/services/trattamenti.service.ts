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
} from '../graphql/trattamenti.operations';

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
    ).pipe(map(r => r?.treatmentsForSecretary ?? []));
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
    ).pipe(map(r => r?.treatmentsForOperator ?? []));
  }

  // ==================== MUTATIONS — SECRETARY ECONOMIC ====================

  updateBySecretary(input: UpdateTreatmentBySecretaryInput): Observable<Trattamento> {
    return this.mutate<{ updateTreatmentBySecretary: Trattamento }>(
      UPDATE_TREATMENT_BY_SECRETARY,
      { input },
    ).pipe(map(r => r.updateTreatmentBySecretary));
  }

  setReadyForBilling(ids: string[], ready: boolean): Observable<Pick<Trattamento, 'id' | 'readyForBilling' | 'readyForBillingAt'>[]> {
    return this.mutate<{ setTreatmentsReadyForBilling: Trattamento[] }>(
      SET_TREATMENTS_READY_FOR_BILLING,
      { ids, ready },
    ).pipe(map(r => r.setTreatmentsReadyForBilling));
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
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        out[key] = value;
      }
    }
    return out;
  }
}

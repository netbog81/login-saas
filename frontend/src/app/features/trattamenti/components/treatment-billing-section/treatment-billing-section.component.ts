import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { Trattamento, TreatmentBillingStatus } from '../../models/trattamento.model';

/**
 * TreatmentBillingSectionComponent — Layer 1 (Dumb).
 *
 * Sezione "Stato fatturazione" del dettaglio trattamento (sessione 6).
 * Mostra:
 *  - Badge `billingStatus` con colore semantico
 *  - Snapshot dati fattura (numero, URL, data) se INVOICED/REISSUED
 *  - Snapshot nota credito (numero, data, motivo) se REFUNDED/PARTIALLY_REFUNDED
 *  - Badge `amendmentRevision` se > 0
 *  - Banner alert (`billingAlertMessage`) con bottone "Letto" se non dismissato
 *  - (Step 6.5) bottoni vincolati: Annulla/Riapri/Fattura subito
 *
 * Self-contained per pattern "Section": riceve `treatment` come Input ed
 * emette eventi tipizzati al container. Niente Apollo, niente service.
 *
 * I bottoni esposti in questa sezione sono gli unici per le azioni billing
 * del trattamento (NON duplicarli altrove). Container fa la logica + flag
 * `disabled` arriva via Input (Step 6.5).
 */
@Component({
  selector: 'app-treatment-billing-section',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './treatment-billing-section.component.html',
  styleUrls: ['./treatment-billing-section.component.scss'],
})
export class TreatmentBillingSectionComponent {
  @Input({ required: true }) treatment!: Trattamento;

  /**
   * Mostra i pulsanti di azione fatturazione (Fattura/incassa, Annulla invio,
   * Riapri, Richiama, Forza re-invio, dismiss alert/banner). Solo
   * segreteria/admin: per gli operatori resta visibile lo STATO di
   * fatturazione e gli alert, ma senza azioni. Coerente col BillingWriteGuard
   * backend.
   */
  @Input() actionsVisible = true;

  /**
   * Disabilita il bottone "Annulla trattamento" (gestito dal container).
   * Default true per impostazione conservativa: il container deve esplicitamente
   * abilitarlo passando `false` quando la transition è consentita.
   */
  @Input() cancelDisabled = true;
  /** Tooltip mostrato quando cancelDisabled=true. */
  @Input() cancelDisabledReason: string | null = null;

  /** Disabilita "Riapri trattamento" (logica analoga a cancel). */
  @Input() reopenDisabled = true;
  @Input() reopenDisabledReason: string | null = null;

  // ────────── Flusso "Fattura" → "Incassa" (due passi sequenziali) ──────────
  //
  // 1. "Fattura": chiede ad accounting di EMETTERE la fattura (totale vero con
  //    marca da bollo). NON registra alcun pagamento. Visibile finché il
  //    trattamento non è ancora fatturato.
  // 2. "Incassa": registra il pagamento SUL TOTALE CONFERMATO da accounting
  //    (accountingTotalAmount). Visibile solo dopo che la fattura è stata
  //    EMESSA (billingStatus=INVOICED) e non è ancora pagata.
  //
  // Idempotenza UI: il container passa `*InFlight=true` mentre l'azione è in
  // corso → il bottone si disabilita e mostra "…", così 3 click veloci
  // producono UNA sola azione.

  /** Mostra il bottone "Fattura" (nasconde quando già fatturato). */
  @Input() fatturaVisible = false;
  /** Disabilita "Fattura". */
  @Input() fatturaDisabled = true;
  @Input() fatturaDisabledReason: string | null = null;
  /** True mentre la richiesta di fatturazione è in volo (anti doppio-click). */
  @Input() fatturaInFlight = false;

  /** Mostra il bottone "Incassa" (solo dopo emissione fattura, se non pagato). */
  @Input() incassaVisible = false;
  /** Disabilita "Incassa". */
  @Input() incassaDisabled = true;
  @Input() incassaDisabledReason: string | null = null;
  /** True mentre la registrazione incasso è in volo (anti doppio-click). */
  @Input() incassaInFlight = false;

  /**
   * Banner "in attesa": il trattamento è stato inviato ad accounting
   * (SENT/PENDING) ma la fattura non è ancora stata emessa. Se è arrivato un
   * MOTIVO esplicito da accounting (billable.invoice-blocked) lo mostriamo via
   * `treatment.billingHoldReason`; altrimenti testo generico. Popolato dal
   * container.
   */
  @Input() awaitingFiscalConfig = false;

  /** Mostra il pulsante "Verifica risoluzione e riprova" (sempre, quando in attesa). */
  @Input() retryInvoiceVisible = false;
  @Input() retryInvoiceDisabled = true;
  @Input() retryInvoiceDisabledReason: string | null = null;
  /** True mentre il ri-tentativo è in volo (anti doppio-click). */
  @Input() retryInvoiceInFlight = false;

  // Sessione 7 — Recall flags
  /** Disabilita "Richiama indietro". */
  @Input() recallDisabled = true;
  @Input() recallDisabledReason: string | null = null;
  /**
   * True se c'è un recall in volo (recallRequestId valorizzato). UI mostra
   * spinner "Richiamo in corso..." al posto del bottone.
   */
  @Input() recallInFlight = false;

  // Sessione 7 — Warning SENT prolungato + bottone "Forza re-invio"
  @Input() sentWarningLevel: 'none' | 'soft' | 'hard' = 'none';
  @Input() sentWarningMessage: string | null = null;
  @Input() resendVisible = false;
  @Input() resendDisabled = true;
  @Input() resendDisabledReason: string | null = null;

  // ────────── Output ──────────
  @Output() dismissAlert = new EventEmitter<string>(); // emette treatmentId
  @Output() cancelTreatment = new EventEmitter<string>(); // emette treatmentId
  @Output() reopenTreatment = new EventEmitter<string>();
  /** "Fattura": chiede ad accounting di emettere (no pagamento). Emette treatmentId. */
  @Output() invoiceTreatment = new EventEmitter<string>();
  /** "Incassa": registra il pagamento sul totale confermato. Emette treatmentId. */
  @Output() collectPayment = new EventEmitter<string>();
  /** "Verifica risoluzione e riprova": ri-tenta l'emissione fattura. Emette treatmentId. */
  @Output() retryInvoice = new EventEmitter<string>();
  // Sessione 7 — Recall outputs
  @Output() requestRecall = new EventEmitter<string>();
  @Output() dismissReturnBanner = new EventEmitter<string>();
  // Sessione 7 — "Forza re-invio ad accounting"
  @Output() resendToAccounting = new EventEmitter<string>();
  // PARTE 3 — "Stampa fattura" (apre il PDF da accounting via proxy clinico)
  @Output() printInvoice = new EventEmitter<string>(); // emette treatmentId

  // Esposto al template per ngSwitch / classi CSS.
  readonly Status = TreatmentBillingStatus;

  /** Label umana per ogni status (pattern coerente con TreatmentStatus labels). */
  get statusLabel(): string {
    if (!this.treatment.billingStatus) return 'Non inviato';
    return BILLING_STATUS_LABELS[this.treatment.billingStatus] ?? this.treatment.billingStatus;
  }

  /** Classe CSS modificatore per il badge status. */
  get statusModifier(): string {
    if (!this.treatment.billingStatus) return 'unset';
    return this.treatment.billingStatus.toLowerCase().replace(/_/g, '-');
  }

  /**
   * "Inviato il ..." nell'header: readyForBillingAt è il timestamp di invio
   * (settato da setReadyForBilling(true)). Mostrato per SENT/PENDING; da
   * INVOICED in poi lo snapshot documento ha già la data di emissione.
   */
  get showSentAt(): boolean {
    const s = this.treatment.billingStatus;
    return (
      !!this.treatment.readyForBillingAt &&
      (s === TreatmentBillingStatus.Sent || s === TreatmentBillingStatus.Pending)
    );
  }

  /** True se va mostrato il banner alert non-dismissato. */
  get showAlert(): boolean {
    return (
      !!this.treatment.billingAlertMessage &&
      !this.treatment.billingAlertDismissedAt
    );
  }

  /** True se ha snapshot fattura emessa (INVOICED o REISSUED → INVOICED). */
  get showInvoiceData(): boolean {
    return !!this.treatment.patientInvoiceNumber || !!this.treatment.accountingInvoiceUrl;
  }

  /**
   * True se è possibile stampare il PDF della fattura: serve l'id del documento
   * fiscale lato accounting (popolato da billable.invoiced). Indipendente dal
   * legacy accountingInvoiceUrl (mai valorizzato): il PDF si recupera on-demand
   * via il proxy clinico GET /treatments/:id/invoice-pdf.
   */
  get canPrintInvoice(): boolean {
    return !!this.treatment.accountingDocumentId;
  }

  onPrintInvoice(): void {
    if (!this.canPrintInvoice) return;
    this.printInvoice.emit(this.treatment.id);
  }

  /**
   * 2026-09-03 — Prestazione fatturata su un documento che in Curandis non
   * esiste: è stata scalata da un voucher "anticipo fattura" che fa capo a
   * una fattura del gestionale precedente. È fatturata a tutti gli effetti —
   * manca solo il PDF, e la UI deve dirlo invece di limitarsi a non mostrare
   * il bottone di stampa.
   */
  get isExternallyInvoiced(): boolean {
    return !!this.treatment.accountingExternalRefNumber && !this.treatment.accountingDocumentId;
  }

  /** Data del documento esterno in formato italiano, se nota. */
  get externalRefDateLabel(): string | null {
    const iso = this.treatment.accountingExternalRefDate;
    if (!iso) return null;
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return d && m && y ? `${d}/${m}/${y}` : null;
  }

  /** True se ha snapshot nota di credito (REFUNDED / PARTIALLY_REFUNDED / REISSUED). */
  get showCreditNoteData(): boolean {
    return !!this.treatment.accountingCreditNoteNumber;
  }

  /** True se ha avuto >=1 amend (revision >= 1). */
  get showAmendmentBadge(): boolean {
    return (this.treatment.amendmentRevision ?? 0) >= 1;
  }

  /** True se è stato cancellato (cancelledAt valorizzato). */
  get showCancellationData(): boolean {
    return !!this.treatment.cancelledAt;
  }

  /** Banner "Richiamo rifiutato" — popolato dopo `billable.recall-rejected`. */
  get showRecallRejection(): boolean {
    return !!this.treatment.lastRecallRejectionMessage;
  }

  /** Banner "Restituito dall'amministrazione" — popolato da `billable.returned-to-clinical`. */
  get showReturnedFromAccounting(): boolean {
    return (
      !!this.treatment.returnedFromAccountingAt &&
      !this.treatment.returnedFromAccountingDismissedAt
    );
  }

  onDismissAlert(): void {
    this.dismissAlert.emit(this.treatment.id);
  }

  onCancel(): void {
    if (this.cancelDisabled) return;
    this.cancelTreatment.emit(this.treatment.id);
  }

  onReopen(): void {
    if (this.reopenDisabled) return;
    this.reopenTreatment.emit(this.treatment.id);
  }

  onFattura(): void {
    // Idempotenza: ignora se disabilitato o se la richiesta è già in volo.
    if (this.fatturaDisabled || this.fatturaInFlight) return;
    this.invoiceTreatment.emit(this.treatment.id);
  }

  onIncassa(): void {
    if (this.incassaDisabled || this.incassaInFlight) return;
    this.collectPayment.emit(this.treatment.id);
  }

  onRetryInvoice(): void {
    if (this.retryInvoiceDisabled || this.retryInvoiceInFlight) return;
    this.retryInvoice.emit(this.treatment.id);
  }

  /**
   * Messaggio del banner di attesa. Se accounting ha mandato un motivo reale
   * (billable.invoice-blocked → billingHoldReason) lo mostriamo; altrimenti un
   * testo generico (inviato, in attesa di emissione).
   */
  get awaitingMessage(): string {
    if (this.treatment.billingHoldReason) {
      return this.treatment.billingHoldReason;
    }
    return (
      'Il trattamento è stato inviato all\'amministrazione. La fattura verrà ' +
      'emessa automaticamente non appena eventuali dati mancanti (es. anagrafica ' +
      'del paziente) o la configurazione fiscale saranno completati.'
    );
  }

  /** Titolo del banner di attesa: distingue blocco esplicito da semplice attesa. */
  get awaitingTitle(): string {
    return this.treatment.billingHoldReason
      ? 'Emissione fattura in attesa'
      : 'Fattura in elaborazione';
  }

  /** True se la fattura è stata EMESSA (badge "Fatturato" evidenziato). */
  get isInvoiced(): boolean {
    return this.treatment.billingStatus === TreatmentBillingStatus.Invoiced;
  }

  /**
   * Totale da mostrare/incassare: quello REALE confermato da accounting (con
   * marca da bollo) se la fattura è stata emessa, altrimenti il prezzo clinico.
   */
  get displayTotal(): number {
    return this.treatment.accountingTotalAmount ?? this.treatment.price ?? 0;
  }

  /** Fattura cumulativa: il documento corrente copre più trattamenti. */
  get isMultiInvoice(): boolean {
    return (this.treatment.accountingDocumentTreatmentCount ?? 1) > 1
      && this.treatment.accountingTotalAmount != null;
  }

  onRequestRecall(): void {
    if (this.recallDisabled) return;
    this.requestRecall.emit(this.treatment.id);
  }

  onDismissReturnBanner(): void {
    this.dismissReturnBanner.emit(this.treatment.id);
  }

  onResendToAccounting(): void {
    if (this.resendDisabled) return;
    this.resendToAccounting.emit(this.treatment.id);
  }

  /** True se va mostrato il banner warning SENT prolungato. */
  get showSentWarning(): boolean {
    return this.sentWarningLevel !== 'none' && !!this.sentWarningMessage;
  }
}

/**
 * Etichette user-facing per ogni TreatmentBillingStatus.
 * Esportate per testing/altri componenti che mostrano lo status.
 */
export const BILLING_STATUS_LABELS: Record<TreatmentBillingStatus, string> = {
  [TreatmentBillingStatus.NotReady]: 'Non pronto',
  [TreatmentBillingStatus.ReadyForBilling]: 'Pronto per fatturazione',
  [TreatmentBillingStatus.Sent]: 'Inviato ad accounting',
  [TreatmentBillingStatus.Pending]: 'In attesa di fatturazione',
  [TreatmentBillingStatus.Invoiced]: 'Fatturato',
  [TreatmentBillingStatus.PartiallyRefunded]: 'Rimborso parziale',
  [TreatmentBillingStatus.Refunded]: 'Rimborsato',
  [TreatmentBillingStatus.Reissued]: 'Riemesso',
  [TreatmentBillingStatus.Cancelled]: 'Annullato',
};

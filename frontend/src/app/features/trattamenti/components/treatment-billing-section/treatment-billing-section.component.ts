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

  /** Disabilita "Fattura subito + incassa". */
  @Input() immediateInvoiceDisabled = true;
  @Input() immediateInvoiceDisabledReason: string | null = null;

  // ────────── Output ──────────
  @Output() dismissAlert = new EventEmitter<string>(); // emette treatmentId
  @Output() cancelTreatment = new EventEmitter<string>(); // emette treatmentId
  @Output() reopenTreatment = new EventEmitter<string>();
  @Output() immediateInvoice = new EventEmitter<string>();

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

  onImmediateInvoice(): void {
    if (this.immediateInvoiceDisabled) return;
    this.immediateInvoice.emit(this.treatment.id);
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

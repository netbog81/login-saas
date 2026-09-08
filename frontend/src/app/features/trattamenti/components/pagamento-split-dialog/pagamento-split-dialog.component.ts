import { ChangeDetectionStrategy, Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { TrattamentiService } from '../../services/trattamenti.service';
import {
  AccountingPaymentMethod,
  AccountingVoucher,
  PaymentTenderLine,
  VoucherFe,
} from '../../models/trattamento.model';
import {
  VoucherFeIssueDialogComponent,
  VoucherFeIssueDialogData,
  VoucherFeIssueDialogResult,
} from '../voucher-fe-issue-dialog/voucher-fe-issue-dialog.component';

export interface PagamentoSplitDialogData {
  treatmentId: string;
  patientId?: string | null;
  scontoFE: boolean;
  totalAmount: number;
  currentUserId: string;
  /** True se si sta correggendo un pagamento già registrato. */
  isCorrection?: boolean;
  /**
   * Mostra il pulsante "Emetti voucher FE" (solo segreteria/admin: il
   * backend ha comunque BillingWriteGuard su issueVoucherFe). L'operatore
   * può SCALARE i voucher esistenti ma non emetterne di nuovi.
   * Default false: i contesti segreteria lo passano esplicitamente a true.
   */
  canIssueVoucherFe?: boolean;
  /**
   * Fattura cumulativa (2026-07-08): il documento copre più trattamenti.
   * Il totale proposto è il saldo INTERO del documento; alla conferma il
   * backend marca pagati tutti i trattamenti della fattura insieme.
   */
  multiInvoice?: {
    treatmentCount: number;
    invoiceNumber?: string | null;
  };
}

export interface PagamentoSplitDialogResult {
  collectedBy: string;
  amount: number;
  tenderLines: PaymentTenderLine[];
  /**
   * 2026-09-04 — Incasso PARZIALE: le righe coprono solo una quota del
   * trattamento, il resto verrà fatturato. Il trattamento non risulta pagato
   * finché non sarà incassata la fattura del residuo.
   */
  partial?: boolean;
}

/** Riga editabile nel dialog (UI). `selection` codifica metodo o voucher scelto. */
interface UiTenderRow {
  selection: string; // 'method:<code>' | 'voucher:<id>' | 'voucherfe:<id>'
  amount: number;
}

/**
 * PARTE 2/4 — Dialog di pagamento con split multi-riga.
 *
 * Due modalità a seconda di `scontoFE`:
 *  - scontoFE=true  → metodi clinici: contanti + voucher_fe del paziente.
 *  - scontoFE=false → metodi accounting (proxy) + voucher accounting tipo 1/2.
 *
 * Più righe (es. parte contanti, parte voucher). Vincolo: somma = totale.
 */
@Component({
  selector: 'app-pagamento-split-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatCheckboxModule,
  ],
  changeDetection: ChangeDetectionStrategy.Default,
  templateUrl: './pagamento-split-dialog.component.html',
  styles: [`
    .hint { color: rgba(0,0,0,.6); font-size: 0.9em; margin: 0 0 12px; }
    .tender-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .tender-row .grow { flex: 1; }
    .tender-row .amount { width: 120px; }
    .totals { margin-top: 12px; font-size: 0.95em; }
    .totals .mismatch { color: #c62828; }
    .totals .ok { color: #2e7d32; }
    .add-row { margin-top: 4px; }
  `],
})
export class PagamentoSplitDialogComponent implements OnInit {
  rows: UiTenderRow[] = [];
  collectedBy: string;

  // Opzioni disponibili (popolate in base alla modalità).
  paymentMethods: AccountingPaymentMethod[] = [];
  accountingVouchers: AccountingVoucher[] = [];
  vouchersFe: VoucherFe[] = [];
  loading = true;
  loadError: string | null = null;

  constructor(
    private dialogRef: MatDialogRef<PagamentoSplitDialogComponent, PagamentoSplitDialogResult>,
    private service: TrattamentiService,
    private dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: PagamentoSplitDialogData,
  ) {
    this.collectedBy = data.currentUserId;
    // Prima riga precompilata con il totale.
    this.rows = [{ selection: '', amount: data.totalAmount }];
  }

  ngOnInit(): void {
    if (this.data.scontoFE) {
      // Modalità clinico: voucher_fe del paziente. Contanti è sempre disponibile.
      if (!this.data.patientId) {
        this.loading = false;
        return;
      }
      this.service.usableVouchersFe(this.data.patientId).subscribe({
        next: (v) => { this.vouchersFe = v; this.loading = false; },
        error: (e) => { this.loadError = this.errMsg(e); this.loading = false; },
      });
    } else {
      // Modalità accounting: metodi + voucher tipo 1/2 (via proxy).
      let pending = 2;
      const done = () => { if (--pending === 0) this.loading = false; };
      this.service.fetchAccountingPaymentMethods(this.data.treatmentId).subscribe({
        next: (m) => { this.paymentMethods = m ?? []; done(); },
        error: (e) => { this.loadError = this.errMsg(e); done(); },
      });
      this.service.fetchAccountingVouchers(this.data.treatmentId).subscribe({
        next: (v) => { this.accountingVouchers = v ?? []; done(); },
        error: () => { done(); }, // voucher opzionali: non bloccare se assenti
      });
    }
  }

  addRow(): void {
    const remaining = Math.max(0, this.round(this.data.totalAmount - this.sum()));
    this.rows.push({ selection: '', amount: remaining });
  }

  /** Emette un nuovo voucher FE per il paziente e ricarica la lista. */
  issueVoucherFe(): void {
    if (!this.data.patientId) return;
    const ref = this.dialog.open<
      VoucherFeIssueDialogComponent,
      VoucherFeIssueDialogData,
      VoucherFeIssueDialogResult
    >(VoucherFeIssueDialogComponent, {
      width: '380px',
      data: { patientId: this.data.patientId },
    });
    ref.afterClosed().subscribe((result) => {
      if (!result || !this.data.patientId) return;
      this.service
        .issueVoucherFe(this.data.patientId, result.initialAmount, result.expiryDate, result.notes)
        .subscribe({
          next: () => {
            this.service.usableVouchersFe(this.data.patientId!).subscribe((v) => {
              this.vouchersFe = v;
            });
          },
          error: (e) => { this.loadError = this.errMsg(e); },
        });
    });
  }

  removeRow(i: number): void {
    this.rows.splice(i, 1);
  }

  sum(): number {
    return this.round(this.rows.reduce((s, r) => s + (Number(r.amount) || 0), 0));
  }

  get sumMatches(): boolean {
    return Math.abs(this.sum() - this.data.totalAmount) <= 0.01;
  }

  /**
   * 2026-09-04 — Incasso parziale con voucher di anticipo fattura.
   *
   * Serve quando il credito del buono copre solo una parte: la quota si
   * scala subito, il residuo si fattura, e il trattamento risulta pagato
   * solo quando anche quella fattura è incassata. Senza, l'unico modo di
   * registrare il buono era dichiarare pagato l'intero trattamento.
   */
  partial = false;

  /**
   * Il parziale ha senso solo dove c'è un residuo da fatturare: mai sui
   * trattamenti scontoFE (l'incasso resta nel clinico) né sulle fatture
   * cumulative (si saldano per intero).
   */
  get canBePartial(): boolean {
    return !this.data.scontoFE && !this.data.multiInvoice;
  }

  /** Nel parziale ogni riga dev'essere un voucher di anticipo. */
  get partialRowsValid(): boolean {
    return this.rows.every((r) => r.selection.startsWith('voucher:'));
  }

  get partialAmountValid(): boolean {
    const s = this.sum();
    return s > 0 && s < this.data.totalAmount - 0.01;
  }

  /** Residuo che resterà da fatturare. */
  residual(): number {
    return this.round(Math.max(0, this.data.totalAmount - this.sum()));
  }

  onPartialChange(value: boolean): void {
    this.partial = value;
  }

  canSubmit(): boolean {
    if (this.loading) return false;
    if (!this.collectedBy) return false;
    if (this.partial) {
      if (!this.canBePartial) return false;
      if (!this.partialRowsValid || !this.partialAmountValid) return false;
    } else if (!this.sumMatches) {
      return false;
    }
    return this.rows.every((r) => !!r.selection && r.amount > 0);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (!this.canSubmit()) return;
    const tenderLines: PaymentTenderLine[] = this.rows.map((r) => {
      const [kind, value] = r.selection.split(':');
      if (kind === 'method') {
        return { kind: 'method', paymentMethodId: value, amount: this.round(r.amount) };
      }
      if (kind === 'voucher') {
        return { kind: 'voucher', voucherId: value, amount: this.round(r.amount) };
      }
      return { kind: 'voucher_fe', voucherFeId: value, amount: this.round(r.amount) };
    });
    this.dialogRef.close({
      collectedBy: this.collectedBy,
      amount: this.sum(),
      tenderLines,
      partial: this.partial || undefined,
    });
  }

  private round(n: number): number {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  private errMsg(e: unknown): string {
    const err = e as { message?: string };
    return err?.message ?? 'Errore di caricamento';
  }
}

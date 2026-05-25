import {
  ChangeDetectionStrategy,
  Component,
  Inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { PaymentMethod } from '../../models/trattamento.model';

export interface FatturaIncassaDialogData {
  /** Totale precompilato (modificabile). */
  totalAmount: number;
  /** AppUser id dell'operatore corrente (default per collectedBy). */
  currentUserId: string;
}

export interface FatturaIncassaDialogResult {
  paymentMethod: PaymentMethod;
  collectedBy: string;
  amount: number;
}

/**
 * Sessione 7 — Dialog opzione B per il bottone "Fattura e incassa".
 *
 * UX: form compatto per registrare pagamento (metodo + collectedBy + importo)
 * prima del flow fatturazione immediata. Il container, dopo submit, chiama
 * in catena:
 *   1. recordTreatmentPayment(input)  → isPaid=true, paidAt=NOW
 *   2. setReadyForBillingImmediate(id) → publish treatment.closed con
 *      requestImmediateInvoice=true ad accounting (AutoIssue)
 *
 * Cancel del dialog → no-op (treatment resta in NOT_READY).
 */
@Component({
  selector: 'app-fattura-incassa-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Registra pagamento e fattura</h2>
    <mat-dialog-content>
      <p class="hint">
        Verrà registrato l'incasso e inviata subito ad accounting la richiesta
        di emissione fattura.
      </p>
      <div class="form-row">
        <mat-form-field appearance="outline" class="grow">
          <mat-label>Metodo di pagamento</mat-label>
          <mat-select [(ngModel)]="paymentMethod" name="paymentMethod" required>
            <mat-option [value]="Method.CASH">Contanti</mat-option>
            <mat-option [value]="Method.CARD">Carta</mat-option>
            <mat-option [value]="Method.TRANSFER">Bonifico</mat-option>
            <mat-option [value]="Method.SATISPAY">Satispay</mat-option>
            <mat-option [value]="Method.OTHER">Altro</mat-option>
          </mat-select>
        </mat-form-field>
      </div>
      <div class="form-row">
        <mat-form-field appearance="outline" class="grow">
          <mat-label>Importo (€)</mat-label>
          <input matInput type="number" [(ngModel)]="amount" name="amount"
                 min="0" step="0.01" required>
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="onCancel()">Annulla</button>
      <button mat-flat-button color="primary" type="button"
              [disabled]="!canSubmit()" (click)="onConfirm()">
        Fattura e incassa
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .hint { color: rgba(0,0,0,.6); font-size: 0.9em; margin: 0 0 12px; }
    .form-row { display: flex; gap: 12px; margin-bottom: 4px; }
    .grow { flex: 1; }
  `],
})
export class FatturaIncassaDialogComponent {
  paymentMethod: PaymentMethod = PaymentMethod.CASH;
  amount: number;
  collectedBy: string;

  readonly Method = PaymentMethod;

  constructor(
    private dialogRef: MatDialogRef<FatturaIncassaDialogComponent, FatturaIncassaDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: FatturaIncassaDialogData,
  ) {
    this.amount = data.totalAmount;
    this.collectedBy = data.currentUserId;
  }

  canSubmit(): boolean {
    return !!this.paymentMethod && this.amount > 0 && !!this.collectedBy;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (!this.canSubmit()) return;
    this.dialogRef.close({
      paymentMethod: this.paymentMethod,
      collectedBy: this.collectedBy,
      amount: this.amount,
    });
  }
}

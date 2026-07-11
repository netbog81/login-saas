import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
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

export interface VoucherFeIssueDialogData {
  patientId: string;
  patientLabel?: string;
}

export interface VoucherFeIssueDialogResult {
  initialAmount: number;
  expiryDate?: string;
  notes?: string;
}

/**
 * PARTE 4.3 — Dialog compatto per emettere un voucher FE per un paziente.
 * Usato dalla segreteria (anche al volo dal dialog di pagamento sconto FE).
 */
@Component({
  selector: 'app-voucher-fe-issue-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Emetti voucher FE</h2>
    <mat-dialog-content>
      <p class="hint" *ngIf="data.patientLabel">Paziente: {{ data.patientLabel }}</p>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Importo (€)</mat-label>
        <input matInput type="number" [(ngModel)]="initialAmount" name="amount"
               min="0" step="0.01" required>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Scadenza (opzionale)</mat-label>
        <input matInput type="date" [(ngModel)]="expiryDate" name="expiry">
      </mat-form-field>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Note (opzionale)</mat-label>
        <input matInput [(ngModel)]="notes" name="notes" maxlength="2000">
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="onCancel()">Annulla</button>
      <button mat-flat-button color="primary" type="button"
              [disabled]="!(initialAmount > 0)" (click)="onConfirm()">
        Emetti
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .hint { color: rgba(0,0,0,.6); font-size: 0.9em; margin: 0 0 12px; }
    .full { width: 100%; }
  `],
})
export class VoucherFeIssueDialogComponent {
  initialAmount = 0;
  expiryDate?: string;
  notes?: string;

  constructor(
    private dialogRef: MatDialogRef<VoucherFeIssueDialogComponent, VoucherFeIssueDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: VoucherFeIssueDialogData,
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (!(this.initialAmount > 0)) return;
    this.dialogRef.close({
      initialAmount: this.initialAmount,
      expiryDate: this.expiryDate || undefined,
      notes: this.notes || undefined,
    });
  }
}

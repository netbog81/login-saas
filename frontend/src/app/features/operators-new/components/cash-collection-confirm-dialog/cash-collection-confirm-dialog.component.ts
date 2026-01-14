/**
 * Cash Collection Confirm Dialog Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Mostrare modal di conferma per incasso diretto da operatore
 * - Permettere selezione metodo di pagamento
 * - Emettere eventi confirm/cancel
 * - NO logica business, NO chiamate service
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';

import { PaymentMethod, getPaymentMethodLabel } from '../../../../models/treatment.model';
import { CashCollectionData } from '../../models/start-treatment-dialog.model';

@Component({
  selector: 'app-cash-collection-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule
  ],
  template: `
    <div class="cash-collection-dialog">
      <header class="dialog-header">
        <mat-icon class="header-icon">payments</mat-icon>
        <h2>Conferma Incasso</h2>
      </header>

      <div class="dialog-content">
        <p class="info-text">
          Stai registrando un incasso diretto dall'operatore per il trattamento.
        </p>

        @if (amount) {
          <div class="amount-display">
            <span class="amount-label">Importo da incassare:</span>
            <span class="amount-value">€ {{ amount | number:'1.2-2' }}</span>
          </div>
        }

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Metodo di Pagamento</mat-label>
          <mat-select [(value)]="selectedPaymentMethod" required panelClass="payment-method-panel">
            @for (method of paymentMethods; track method.value) {
              <mat-option [value]="method.value">
                <mat-icon>{{ method.icon }}</mat-icon>
                {{ method.label }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="warning-box">
          <mat-icon>warning</mat-icon>
          <span>Questa operazione registrerà l'incasso a nome dell'operatore.</span>
        </div>
      </div>

      <footer class="dialog-footer">
        <button mat-button (click)="onCancel()" [disabled]="confirming">
          Annulla
        </button>
        <button
          mat-raised-button
          color="accent"
          (click)="onConfirm()"
          [disabled]="!selectedPaymentMethod || confirming">
          @if (confirming) {
            <mat-icon class="spinning">sync</mat-icon>
            Conferma in corso...
          } @else {
            <mat-icon>check</mat-icon>
            Conferma Incasso
          }
        </button>
      </footer>
    </div>
  `,
  styles: [`
    .cash-collection-dialog {
      background: white;
      border-radius: 16px;
      overflow: visible;
      max-width: 400px;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
      position: relative;
      z-index: 1200;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;

      .header-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }
    }

    .dialog-content {
      padding: 24px;

      .info-text {
        margin: 0 0 20px;
        color: #64748b;
        font-size: 0.9375rem;
        line-height: 1.5;
      }
    }

    .amount-display {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border-radius: 12px;
      margin-bottom: 20px;
      border: 1px solid #bbf7d0;

      .amount-label {
        color: #166534;
        font-size: 0.875rem;
      }

      .amount-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: #166534;
      }
    }

    .full-width {
      width: 100%;

      ::ng-deep {
        .mdc-notched-outline__notch {
          border-left: none !important;
          border-right: none !important;
        }
      }
    }

    .warning-box {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      background: #fef3c7;
      border-radius: 8px;
      margin-top: 16px;

      mat-icon {
        color: #d97706;
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      span {
        color: #92400e;
        font-size: 0.8125rem;
        line-height: 1.4;
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Payment method icons in select */
    mat-option {
      mat-icon {
        margin-right: 8px;
        font-size: 18px;
        width: 18px;
        height: 18px;
        vertical-align: middle;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CashCollectionConfirmDialogComponent {
  @Input() amount?: number;
  @Input() operatorId: string = '';
  @Input() confirming = false;

  @Output() confirm = new EventEmitter<CashCollectionData>();
  @Output() cancel = new EventEmitter<void>();

  selectedPaymentMethod: PaymentMethod = 'cash';

  paymentMethods: { value: PaymentMethod; label: string; icon: string }[] = [
    { value: 'cash', label: getPaymentMethodLabel('cash'), icon: 'payments' },
    { value: 'card', label: getPaymentMethodLabel('card'), icon: 'credit_card' },
    { value: 'satispay', label: getPaymentMethodLabel('satispay'), icon: 'smartphone' },
    { value: 'transfer', label: getPaymentMethodLabel('transfer'), icon: 'account_balance' },
    { value: 'other', label: getPaymentMethodLabel('other'), icon: 'more_horiz' }
  ];

  onConfirm(): void {
    if (this.selectedPaymentMethod) {
      // Converti in maiuscolo per compatibilità con GraphQL enum (es. 'cash' -> 'CASH')
      this.confirm.emit({
        amount: this.amount || 0,
        paymentMethod: this.selectedPaymentMethod.toUpperCase() as PaymentMethod,
        collectedBy: this.operatorId
      });
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}

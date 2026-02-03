/**
 * Treatment Detail Dialog Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare dettagli completi di un trattamento in un dialog modale
 * - Solo visualizzazione, nessuna logica di business
 * - Emette eventi per azioni (chiusura, modifica)
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Treatment } from '../../../../models/treatment.model';

@Component({
  selector: 'app-treatment-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatTooltipModule
  ],
  template: `
    @if (isVisible && treatment) {
      <div class="dialog-overlay"
           (mousedown)="onOverlayMouseDown($event)"
           (click)="onOverlayClick($event)">
        <div class="dialog-container"
             (click)="$event.stopPropagation()"
             (mousedown)="$event.stopPropagation()">
          <!-- Header -->
          <div class="dialog-header">
            <div class="header-title">
              <mat-icon>medical_services</mat-icon>
              <h2>Dettagli Trattamento</h2>
            </div>
            <button mat-icon-button (click)="onClose()" matTooltip="Chiudi">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Content -->
          <div class="dialog-content">
            @if (loading) {
              <div class="loading-state">
                <div class="spinner"></div>
                <span>Caricamento...</span>
              </div>
            } @else {
              <!-- Info base -->
              <section class="detail-section info-section">
                <div class="info-row">
                  <mat-icon>event</mat-icon>
                  <span>{{ formatDate(treatment.startedAt) }}</span>
                </div>
                @if (treatment.service?.name) {
                  <div class="info-row">
                    <mat-icon>healing</mat-icon>
                    <span class="service-name">{{ treatment.service?.name }}</span>
                  </div>
                }
                @if (treatment.operator) {
                  <div class="info-row">
                    <mat-icon>person</mat-icon>
                    <span>{{ treatment.operator.name }} {{ treatment.operator.surname }}</span>
                  </div>
                }
                @if (treatment.status) {
                  <div class="info-row">
                    <mat-icon>info</mat-icon>
                    <span class="status-badge" [class]="'status-' + treatment.status.toLowerCase()">
                      {{ getStatusLabel(treatment.status) }}
                    </span>
                  </div>
                }
              </section>

              <!-- Valutazione Dolore (VAS) -->
              @if (treatment.painBefore !== undefined || treatment.painAfter !== undefined) {
                <mat-divider></mat-divider>
                <section class="detail-section">
                  <h3><mat-icon>psychology</mat-icon> Valutazione Dolore (VAS)</h3>
                  <div class="pain-comparison">
                    <div class="pain-value" [class]="getPainClass(treatment.painBefore)">
                      <span class="label">Prima</span>
                      <span class="value">{{ treatment.painBefore ?? '-' }}/10</span>
                    </div>
                    <mat-icon class="pain-arrow" [class]="getPainTrendClass()">{{ getPainTrendIcon() }}</mat-icon>
                    <div class="pain-value" [class]="getPainClass(treatment.painAfter)">
                      <span class="label">Dopo</span>
                      <span class="value">{{ treatment.painAfter ?? '-' }}/10</span>
                    </div>
                  </div>
                </section>
              }

              <!-- Note Cliniche -->
              @if (treatment.clinicalNotes) {
                <mat-divider></mat-divider>
                <section class="detail-section">
                  <h3><mat-icon>description</mat-icon> Note Cliniche</h3>
                  <p class="notes-text">{{ treatment.clinicalNotes }}</p>
                </section>
              }

              <!-- Note Segreteria -->
              @if (treatment.secretaryNotes) {
                <mat-divider></mat-divider>
                <section class="detail-section">
                  <h3><mat-icon>note</mat-icon> Note Segreteria</h3>
                  <p class="notes-text">{{ treatment.secretaryNotes }}</p>
                </section>
              }

              <!-- Note Paziente -->
              @if (treatment.patientNotes) {
                <mat-divider></mat-divider>
                <section class="detail-section">
                  <h3><mat-icon>chat</mat-icon> Note per il Paziente</h3>
                  <p class="notes-text">{{ treatment.patientNotes }}</p>
                </section>
              }

              <!-- Riprogrammazione -->
              @if (treatment.rescheduleRequested || treatment.reschedulingType && treatment.reschedulingType !== 'none') {
                <mat-divider></mat-divider>
                <section class="detail-section">
                  <h3><mat-icon>event_repeat</mat-icon> Riprogrammazione</h3>
                  @if (treatment.suggestInDays) {
                    <p class="rescheduling-info">
                      <mat-icon>schedule</mat-icon>
                      Fra {{ treatment.suggestInDays }} giorni
                    </p>
                  }
                  @if (treatment.suggestDateRangeStart && treatment.suggestDateRangeEnd) {
                    <p class="rescheduling-info">
                      <mat-icon>date_range</mat-icon>
                      Dal {{ formatShortDate(treatment.suggestDateRangeStart) }} al {{ formatShortDate(treatment.suggestDateRangeEnd) }}
                    </p>
                  }
                  @if (treatment.reschedulingNotes) {
                    <p class="notes-text">{{ treatment.reschedulingNotes }}</p>
                  }
                </section>
              }

              <!-- Prezzo e Pagamento -->
              <mat-divider></mat-divider>
              <section class="detail-section pricing">
                <h3><mat-icon>payments</mat-icon> Fatturazione</h3>
                <div class="pricing-info">
                  @if (treatment.price) {
                    <span class="price">{{ treatment.price.toFixed(2) }}</span>
                  } @else {
                    <span class="price no-price">Non definito</span>
                  }
                  @if (treatment.isPaid) {
                    <span class="badge paid">
                      <mat-icon>check_circle</mat-icon>
                      Pagato
                    </span>
                  } @else {
                    <span class="badge unpaid">
                      <mat-icon>pending</mat-icon>
                      Non pagato
                    </span>
                  }
                  @if (treatment.scontoFE) {
                    <span class="badge discount">
                      <mat-icon>loyalty</mat-icon>
                      Sconto FE
                    </span>
                  }
                </div>
                @if (treatment.paymentMethod) {
                  <p class="payment-method">
                    <mat-icon>credit_card</mat-icon>
                    Metodo: {{ getPaymentMethodLabel(treatment.paymentMethod) }}
                  </p>
                }
              </section>
            }
          </div>

          <!-- Footer -->
          <div class="dialog-footer">
            <button mat-button (click)="onClose()">Chiudi</button>
            <button mat-flat-button color="primary" (click)="onEdit()">
              <mat-icon>edit</mat-icon>
              Modifica
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1100;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .dialog-container {
      width: 90%;
      max-width: 560px;
      max-height: 85vh;
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
      background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
      border-radius: 16px 16px 0 0;

      .header-title {
        display: flex;
        align-items: center;
        gap: 12px;

        mat-icon {
          color: #667eea;
          font-size: 28px;
          width: 28px;
          height: 28px;
        }

        h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #1e293b;
        }
      }
    }

    .dialog-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      color: #64748b;

      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #e2e8f0;
        border-top-color: #667eea;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-bottom: 12px;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    }

    .detail-section {
      margin-bottom: 20px;

      &:last-child {
        margin-bottom: 0;
      }

      h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 16px 0 12px;
        font-size: 0.875rem;
        font-weight: 600;
        color: #334155;
        text-transform: uppercase;
        letter-spacing: 0.5px;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #667eea;
        }
      }
    }

    .info-section {
      .info-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;

        mat-icon {
          color: #94a3b8;
          font-size: 20px;
          width: 20px;
          height: 20px;
        }

        span {
          color: #334155;
          font-size: 0.9375rem;
        }

        .service-name {
          font-weight: 600;
          color: #1e293b;
        }
      }
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;

      &.status-in_progress {
        background: #dbeafe;
        color: #1d4ed8;
      }

      &.status-operator_completed {
        background: #fef3c7;
        color: #92400e;
      }

      &.status-closed {
        background: #dcfce7;
        color: #166534;
      }
    }

    .pain-comparison {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 16px;
      background: #f8fafc;
      border-radius: 12px;
    }

    .pain-value {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 20px;
      border-radius: 10px;
      min-width: 90px;

      .label {
        font-size: 0.75rem;
        font-weight: 500;
        color: #64748b;
        margin-bottom: 4px;
      }

      .value {
        font-size: 1.375rem;
        font-weight: 700;
      }

      &.pain-low {
        background: #dcfce7;
        .value { color: #166534; }
      }

      &.pain-medium {
        background: #fef3c7;
        .value { color: #92400e; }
      }

      &.pain-high {
        background: #fee2e2;
        .value { color: #dc2626; }
      }
    }

    .pain-arrow {
      color: #94a3b8;
      font-size: 28px;
      width: 28px;
      height: 28px;

      &.trend-down { color: #22c55e; }
      &.trend-up { color: #ef4444; }
      &.trend-flat { color: #f59e0b; }
    }

    .notes-text {
      margin: 0;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 8px;
      color: #334155;
      font-size: 0.9375rem;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .rescheduling-info {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 8px;
      color: #334155;
      font-size: 0.9375rem;

      mat-icon {
        color: #667eea;
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .pricing {
      .pricing-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .price {
        font-size: 1.5rem;
        font-weight: 700;
        color: #059669;

        &::before {
          content: '€ ';
        }

        &.no-price {
          font-size: 1rem;
          color: #94a3b8;
          font-weight: 400;

          &::before {
            content: '';
          }
        }
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 16px;
        font-size: 0.75rem;
        font-weight: 500;

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }

        &.paid {
          background: #dcfce7;
          color: #166534;
        }

        &.unpaid {
          background: #fee2e2;
          color: #dc2626;
        }

        &.discount {
          background: #dbeafe;
          color: #1d4ed8;
        }
      }

      .payment-method {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 12px 0 0;
        color: #64748b;
        font-size: 0.875rem;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 0 0 16px 16px;

      button mat-icon {
        margin-right: 4px;
      }
    }

    /* Responsive */
    @media (max-width: 599px) {
      .dialog-container {
        width: 95%;
        max-height: 90vh;
      }

      .dialog-header {
        padding: 16px;
      }

      .dialog-content {
        padding: 16px;
      }

      .pain-comparison {
        flex-direction: column;
        gap: 12px;
      }

      .pain-arrow {
        transform: rotate(90deg);
      }

      .dialog-footer {
        padding: 12px 16px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreatmentDetailDialogComponent {
  @Input() treatment: Treatment | null = null;
  @Input() isVisible = false;
  @Input() loading = false;

  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Treatment>();

  // Per gestire click-and-drag sull'overlay
  overlayMouseDownTarget: EventTarget | null = null;

  onOverlayMouseDown(event: MouseEvent): void {
    this.overlayMouseDownTarget = event.target;
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.overlayMouseDownTarget === event.currentTarget &&
        event.target === event.currentTarget) {
      this.onClose();
    }
    this.overlayMouseDownTarget = null;
  }

  onClose(): void {
    this.close.emit();
  }

  onEdit(): void {
    if (this.treatment) {
      this.edit.emit(this.treatment);
    }
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatShortDate(date: Date | string | undefined): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'in_progress': 'In corso',
      'operator_completed': 'Completato',
      'closed': 'Chiuso'
    };
    return labels[status.toLowerCase()] || status;
  }

  getPainClass(pain: number | undefined): string {
    if (pain === undefined || pain === null) return '';
    if (pain <= 3) return 'pain-low';
    if (pain <= 6) return 'pain-medium';
    return 'pain-high';
  }

  getPainTrendIcon(): string {
    if (this.treatment?.painBefore === undefined ||
        this.treatment?.painAfter === undefined) {
      return 'arrow_forward';
    }

    const diff = this.treatment.painAfter - this.treatment.painBefore;
    if (diff < 0) return 'trending_down';
    if (diff > 0) return 'trending_up';
    return 'trending_flat';
  }

  getPainTrendClass(): string {
    if (this.treatment?.painBefore === undefined ||
        this.treatment?.painAfter === undefined) {
      return '';
    }

    const diff = this.treatment.painAfter - this.treatment.painBefore;
    if (diff < 0) return 'trend-down';
    if (diff > 0) return 'trend-up';
    return 'trend-flat';
  }

  getPaymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      'cash': 'Contanti',
      'card': 'Carta',
      'transfer': 'Bonifico',
      'other': 'Altro'
    };
    return labels[method.toLowerCase()] || method;
  }
}

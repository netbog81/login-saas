/**
 * Treatment Detail Panel Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare dettagli completi di un trattamento
 * - Mostrare valutazione dolore, strumenti, note
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
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  PathTreatment,
  getTreatmentTypeLabel,
  getTreatmentTypeColor
} from '../../../../models/therapeutic-path.model';

@Component({
  selector: 'app-treatment-detail-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="treatment-detail-panel">
      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="32"></mat-spinner>
          <span>Caricamento dettagli...</span>
        </div>
      } @else if (!treatment) {
        <div class="empty-state">
          <mat-icon>info</mat-icon>
          <p>Nessun trattamento selezionato</p>
        </div>
      } @else {
        <!-- Header -->
        <header class="detail-header">
          <div class="header-info">
            <span class="treatment-type" [style.background-color]="getTypeColor()">
              {{ getTypeLabel() }}
            </span>
            <h2>{{ treatment.title || 'Trattamento' }}</h2>
            <div class="meta-row">
              <span class="date">
                <mat-icon>event</mat-icon>
                {{ formatDate(treatment.date) }}
              </span>
              @if (treatment.startTime) {
                <span class="time">
                  <mat-icon>schedule</mat-icon>
                  {{ treatment.startTime }}{{ treatment.endTime ? ' - ' + treatment.endTime : '' }}
                </span>
              }
              @if (treatment.operatorName) {
                <span class="operator">
                  <mat-icon>person</mat-icon>
                  {{ treatment.operatorName }}
                </span>
              }
            </div>
          </div>
          <button mat-icon-button (click)="onClose()">
            <mat-icon>close</mat-icon>
          </button>
        </header>

        <mat-divider></mat-divider>

        <!-- Content -->
        <div class="detail-content">
          <!-- Pain assessment -->
          @if (treatment.painScaleBefore !== undefined || treatment.painScaleAfter !== undefined) {
            <section class="detail-section">
              <h3><mat-icon>psychology</mat-icon> Valutazione Dolore</h3>
              <div class="pain-comparison">
                <div class="pain-value before" [class]="getPainClass(treatment.painScaleBefore)">
                  <span class="label">Prima</span>
                  <span class="value">{{ treatment.painScaleBefore ?? '-' }}/10</span>
                </div>
                <div class="pain-arrow">
                  <mat-icon>{{ getPainTrend() }}</mat-icon>
                </div>
                <div class="pain-value after" [class]="getPainClass(treatment.painScaleAfter)">
                  <span class="label">Dopo</span>
                  <span class="value">{{ treatment.painScaleAfter ?? '-' }}/10</span>
                </div>
              </div>
            </section>
          }

          <!-- Instruments used -->
          @if (treatment.instrumentsUsed?.length) {
            <section class="detail-section">
              <h3><mat-icon>handyman</mat-icon> Strumenti Utilizzati</h3>
              <div class="instruments-list">
                @for (instr of treatment.instrumentsUsed; track instr.instrumentId) {
                  <div class="instrument-chip">
                    <span class="name">{{ instr.instrumentName }}</span>
                    @if (instr.duration) {
                      <span class="duration">{{ instr.duration }} min</span>
                    }
                    @if (instr.settings) {
                      <span class="settings">{{ instr.settings }}</span>
                    }
                  </div>
                }
              </div>
            </section>
          }

          <!-- Clinical notes -->
          @if (treatment.treatmentDescription || treatment.clinicalNotes) {
            <section class="detail-section">
              <h3><mat-icon>description</mat-icon> Note Cliniche</h3>
              @if (treatment.treatmentDescription) {
                <div class="note-block">
                  <span class="note-label">Descrizione Trattamento</span>
                  <p>{{ treatment.treatmentDescription }}</p>
                </div>
              }
              @if (treatment.clinicalNotes) {
                <div class="note-block">
                  <span class="note-label">Note Cliniche</span>
                  <p>{{ treatment.clinicalNotes }}</p>
                </div>
              }
            </section>
          }

          <!-- Patient response -->
          @if (treatment.patientResponse) {
            <section class="detail-section">
              <h3><mat-icon>feedback</mat-icon> Risposta Paziente</h3>
              <p class="response-text">{{ treatment.patientResponse }}</p>
            </section>
          }

          <!-- Next steps -->
          @if (treatment.nextSteps || treatment.homeExercises) {
            <section class="detail-section">
              <h3><mat-icon>next_plan</mat-icon> Prossimi Passi</h3>
              @if (treatment.nextSteps) {
                <div class="note-block">
                  <span class="note-label">Indicazioni</span>
                  <p>{{ treatment.nextSteps }}</p>
                </div>
              }
              @if (treatment.homeExercises) {
                <div class="note-block">
                  <span class="note-label">Esercizi a Casa</span>
                  <p>{{ treatment.homeExercises }}</p>
                </div>
              }
            </section>
          }

          <!-- Pricing -->
          @if (treatment.price || treatment.isBillable !== undefined) {
            <section class="detail-section pricing">
              <h3><mat-icon>payments</mat-icon> Fatturazione</h3>
              <div class="pricing-info">
                @if (treatment.isBillable !== undefined) {
                  <span class="billable" [class.yes]="treatment.isBillable">
                    {{ treatment.isBillable ? 'Fatturabile' : 'Non fatturabile' }}
                  </span>
                }
                @if (treatment.price) {
                  <span class="price">€ {{ treatment.price.toFixed(2) }}</span>
                }
              </div>
            </section>
          }
        </div>

        <!-- Footer -->
        <footer class="detail-footer">
          <span class="created">
            Registrato: {{ formatDateTime(treatment.createdAt) }}
          </span>
          <button mat-flat-button color="primary" (click)="onEdit()">
            <mat-icon>edit</mat-icon>
            Modifica
          </button>
        </footer>
      }
    </div>
  `,
  styles: [`
    .treatment-detail-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: white;
      border-radius: 16px;
      overflow: hidden;
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
      color: #64748b;
      flex: 1;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #cbd5e1;
        margin-bottom: 16px;
      }

      p {
        margin: 0;
      }
    }

    .detail-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 20px 24px;
      background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
    }

    .header-info {
      flex: 1;

      .treatment-type {
        display: inline-block;
        font-size: 0.6875rem;
        font-weight: 600;
        color: white;
        padding: 4px 10px;
        border-radius: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
      }

      h2 {
        margin: 0 0 8px;
        font-size: 1.375rem;
        font-weight: 600;
        color: #1e293b;
      }

      .meta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;

        > span {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8125rem;
          color: #64748b;

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            color: #94a3b8;
          }
        }
      }
    }

    .detail-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .detail-section {
      margin-bottom: 28px;

      &:last-child {
        margin-bottom: 0;
      }

      h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 16px;
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

    .pain-comparison {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
    }

    .pain-value {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 24px;
      border-radius: 12px;
      min-width: 100px;

      .label {
        font-size: 0.75rem;
        font-weight: 500;
        color: #64748b;
        margin-bottom: 4px;
      }

      .value {
        font-size: 1.5rem;
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
      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: #22c55e;
      }
    }

    .instruments-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .instrument-chip {
      display: flex;
      flex-direction: column;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 10px;
      border: 1px solid #e2e8f0;

      .name {
        font-weight: 500;
        color: #1e293b;
      }

      .duration, .settings {
        font-size: 0.75rem;
        color: #64748b;
        margin-top: 2px;
      }
    }

    .note-block {
      margin-bottom: 16px;

      &:last-child {
        margin-bottom: 0;
      }

      .note-label {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }

      p {
        margin: 0;
        font-size: 0.9375rem;
        color: #1e293b;
        line-height: 1.6;
      }
    }

    .response-text {
      margin: 0;
      font-size: 0.9375rem;
      color: #1e293b;
      line-height: 1.6;
      padding: 12px 16px;
      background: #f0fdf4;
      border-radius: 8px;
      border-left: 3px solid #22c55e;
    }

    .pricing {
      .pricing-info {
        display: flex;
        align-items: center;
        gap: 16px;

        .billable {
          font-size: 0.8125rem;
          padding: 4px 12px;
          border-radius: 8px;
          background: #fee2e2;
          color: #dc2626;

          &.yes {
            background: #dcfce7;
            color: #166534;
          }
        }

        .price {
          font-size: 1.5rem;
          font-weight: 700;
          color: #667eea;
        }
      }
    }

    .detail-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;

      .created {
        font-size: 0.75rem;
        color: #94a3b8;
      }
    }

    /* Responsive */
    @media (max-width: 599px) {
      .detail-header {
        padding: 16px;
      }

      .detail-content {
        padding: 16px;
      }

      .pain-comparison {
        flex-direction: column;
        gap: 12px;
      }

      .pain-arrow mat-icon {
        transform: rotate(90deg);
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreatmentDetailPanelComponent {
  @Input() treatment: PathTreatment | null = null;
  @Input() loading = false;

  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<PathTreatment>();

  onClose(): void {
    this.close.emit();
  }

  onEdit(): void {
    if (this.treatment) {
      this.edit.emit(this.treatment);
    }
  }

  getTypeLabel(): string {
    return this.treatment ? getTreatmentTypeLabel(this.treatment.type) : '';
  }

  getTypeColor(): string {
    return this.treatment ? getTreatmentTypeColor(this.treatment.type) : '#6b7280';
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  formatDateTime(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getPainClass(pain: number | undefined): string {
    if (pain === undefined) return '';
    if (pain <= 3) return 'pain-low';
    if (pain <= 6) return 'pain-medium';
    return 'pain-high';
  }

  getPainTrend(): string {
    if (this.treatment?.painScaleBefore === undefined ||
        this.treatment?.painScaleAfter === undefined) {
      return 'arrow_forward';
    }

    const diff = this.treatment.painScaleAfter - this.treatment.painScaleBefore;
    if (diff < 0) return 'trending_down';
    if (diff > 0) return 'trending_up';
    return 'trending_flat';
  }
}

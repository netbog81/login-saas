/**
 * Treatments Tab Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare lista trattamenti del percorso
 * - Gestire selezione e doppio click per dettaglio
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Treatment, getTreatmentStatusLabel, getTreatmentStatusColor } from '../../../../models/treatment.model';

@Component({
  selector: 'app-treatments-tab',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="treatments-tab">
      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="32"></mat-spinner>
          <span>Caricamento trattamenti...</span>
        </div>
      } @else if (treatments.length === 0) {
        <div class="empty-state">
          <mat-icon>medical_services</mat-icon>
          <p>Nessun trattamento registrato</p>
          <span>I trattamenti appariranno qui dopo ogni seduta</span>
        </div>
      } @else {
        <div class="treatments-list">
          @for (treatment of treatments; track treatment.id) {
            <div
              class="treatment-item"
              [class.selected]="treatment.id === selectedTreatmentId"
              (click)="onTreatmentClick(treatment)"
              (dblclick)="onTreatmentDoubleClick(treatment)">

              <div class="treatment-date">
                <span class="day">{{ formatDay(treatment.startedAt) }}</span>
                <span class="month">{{ formatMonth(treatment.startedAt) }}</span>
              </div>

              <div class="treatment-content">
                <div class="treatment-header">
                  <span class="treatment-status" [style.background-color]="getStatusColor(treatment.status)">
                    {{ getStatusLabel(treatment.status) }}
                  </span>
                  <span class="treatment-time">{{ formatTime(treatment.startedAt) }}</span>
                  @if (treatment.price > 0) {
                    <span class="treatment-price">€{{ treatment.price }}</span>
                  }
                </div>

                <div class="treatment-info">
                  @if (treatment.service?.name) {
                    <h4>{{ treatment.service?.name }}</h4>
                  }
                  @if (treatment.operator) {
                    <p class="operator-name">
                      <mat-icon>person</mat-icon>
                      {{ treatment.operator.name }} {{ treatment.operator.surname }}
                    </p>
                  }
                  @if (treatment.clinicalNotes) {
                    <p class="description">{{ treatment.clinicalNotes | slice:0:100 }}{{ treatment.clinicalNotes.length > 100 ? '...' : '' }}</p>
                  }
                </div>

                <div class="treatment-badges">
                  @if (treatment.isPaid) {
                    <span class="badge badge-paid">
                      <mat-icon>check_circle</mat-icon>
                      Pagato
                    </span>
                  }
                  @if (treatment.isTest) {
                    <span class="badge badge-test">Test</span>
                  }
                </div>
              </div>

              <div class="treatment-actions">
                <button mat-icon-button matTooltip="Modifica" (click)="onTreatmentEdit(treatment); $event.stopPropagation()">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button matTooltip="Vedi dettagli" (click)="onTreatmentDoubleClick(treatment); $event.stopPropagation()">
                  <mat-icon>visibility</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>

        <div class="list-footer">
          <span class="count">{{ treatments.length }} trattamenti</span>
          <span class="hint">Doppio click per vedere i dettagli</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .treatments-tab {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
      color: #64748b;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #cbd5e1;
        margin-bottom: 16px;
      }

      p {
        margin: 0 0 4px;
        font-weight: 500;
      }

      span {
        font-size: 0.8125rem;
        color: #94a3b8;
      }
    }

    .treatments-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .treatment-item {
      display: flex;
      gap: 16px;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      border: 2px solid transparent;

      &:hover {
        background: #f1f5f9;
      }

      &.selected {
        border-color: #667eea;
        background: #eef2ff;
      }
    }

    .treatment-date {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-width: 48px;
      padding: 8px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

      .day {
        font-size: 1.25rem;
        font-weight: 700;
        color: #1e293b;
        line-height: 1;
      }

      .month {
        font-size: 0.6875rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: 2px;
      }
    }

    .treatment-content {
      flex: 1;
      min-width: 0;
    }

    .treatment-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .treatment-status {
      font-size: 0.6875rem;
      font-weight: 600;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .treatment-time {
      font-size: 0.75rem;
      color: #64748b;
      font-family: 'SF Mono', 'Roboto Mono', monospace;
    }

    .treatment-price {
      font-size: 0.75rem;
      font-weight: 600;
      color: #059669;
      background: #d1fae5;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .treatment-info {
      h4 {
        margin: 0 0 4px;
        font-size: 0.9375rem;
        font-weight: 600;
        color: #1e293b;
      }

      .operator-name {
        margin: 0 0 4px;
        font-size: 0.8125rem;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 4px;

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }
      }

      .description {
        margin: 0;
        font-size: 0.8125rem;
        color: #64748b;
        line-height: 1.4;
      }
    }

    .treatment-badges {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.6875rem;
      font-weight: 500;

      mat-icon {
        font-size: 12px;
        width: 12px;
        height: 12px;
      }
    }

    .badge-paid {
      background: #dcfce7;
      color: #166534;
    }

    .badge-test {
      background: #fef3c7;
      color: #92400e;
    }

    .treatment-actions {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .treatment-item:hover .treatment-actions {
      opacity: 1;
    }

    .list-footer {
      display: flex;
      justify-content: space-between;
      padding: 12px 0 0;
      margin-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-size: 0.75rem;
      color: #94a3b8;
    }

    /* Responsive */
    @media (max-width: 599px) {
      .treatment-item {
        flex-wrap: wrap;
      }

      .treatment-date {
        flex-direction: row;
        gap: 4px;
        min-width: auto;
        width: 100%;
        justify-content: flex-start;
      }

      .treatment-actions {
        opacity: 1;
        width: 100%;
        justify-content: flex-end;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreatmentsTabComponent {
  @Input() treatments: Treatment[] = [];
  @Input() loading = false;
  @Input() selectedTreatmentId: string | null = null;

  @Output() treatmentSelect = new EventEmitter<Treatment>();
  @Output() treatmentDoubleClick = new EventEmitter<Treatment>();
  @Output() treatmentEdit = new EventEmitter<Treatment>();

  onTreatmentClick(treatment: Treatment): void {
    this.treatmentSelect.emit(treatment);
  }

  onTreatmentDoubleClick(treatment: Treatment): void {
    this.treatmentDoubleClick.emit(treatment);
  }

  onTreatmentEdit(treatment: Treatment): void {
    this.treatmentEdit.emit(treatment);
  }

  formatDay(date: Date | string): string {
    const d = new Date(date);
    return d.getDate().toString().padStart(2, '0');
  }

  formatMonth(date: Date | string): string {
    const d = new Date(date);
    const months = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
    return months[d.getMonth()];
  }

  formatTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

  getStatusLabel(status: string): string {
    return getTreatmentStatusLabel(status?.toLowerCase() as any);
  }

  getStatusColor(status: string): string {
    return getTreatmentStatusColor(status?.toLowerCase() as any);
  }
}

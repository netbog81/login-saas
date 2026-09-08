/**
 * Pending FE List Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Elencare i trattamenti sconto FE non incassati del paziente
 * - Esporre l'azione "Incassa" riga per riga (abilitata dal backend)
 * - Nessuna chiamata GraphQL, nessuna regola di autorizzazione: `canCollect`
 *   arriva già deciso dal server.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  PendingFeCollectionItem,
  PENDING_FE_STATUS_LABELS,
} from '../../models/pending-fe.model';

@Component({
  selector: 'app-pending-fe-list',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    @if (loading) {
      <div class="state">Caricamento…</div>
    } @else if (error) {
      <div class="state state--error">{{ error }}</div>
    } @else if (items.length === 0) {
      <div class="state state--empty">
        <mat-icon>check_circle</mat-icon>
        <span>Nessuno sconto FE da incassare per questo paziente.</span>
      </div>
    } @else {
      <div class="rows">
        @for (item of items; track item.treatmentId) {
          <div class="row" [class.row--busy]="busyTreatmentId === item.treatmentId">
            <div class="row__when">
              <span class="date">{{ item.startedAt | date: 'dd/MM/yyyy' }}</span>
              <span class="time">{{ item.startedAt | date: 'HH:mm' }}</span>
            </div>

            <div class="row__what">
              <span class="services">{{ item.servicesDescription || 'Trattamento' }}</span>
              <span class="meta">
                <mat-icon
                  class="meta__icon"
                  [matTooltip]="item.isGym ? 'Seduta in palestra' : 'Seduta di fisioterapia'">
                  {{ item.isGym ? 'fitness_center' : 'medical_services' }}
                </mat-icon>
                {{ item.operatorName }}
                @if (item.therapeuticPathName) {
                  <span class="path">· {{ item.therapeuticPathName }}</span>
                }
              </span>
            </div>

            <span class="row__status" [class]="'row__status--' + item.status">
              {{ statusLabel(item.status) }}
            </span>

            <span class="row__amount">{{ item.amount | currency: 'EUR' }}</span>

            <div class="row__action">
              @if (item.amount <= 0) {
                <button
                  mat-stroked-button
                  disabled
                  matTooltip="Importo non ancora definito: completa il trattamento o aggiungi le righe servizio prima di incassare.">
                  <mat-icon>help_outline</mat-icon>
                  Incassa
                </button>
              } @else if (item.canCollect) {
                <button
                  mat-flat-button
                  color="primary"
                  [disabled]="busyTreatmentId === item.treatmentId"
                  (click)="collect.emit(item)">
                  <mat-icon>payments</mat-icon>
                  {{ busyTreatmentId === item.treatmentId ? 'Registrazione…' : 'Incassa' }}
                </button>
              } @else {
                <button
                  mat-stroked-button
                  disabled
                  [matTooltip]="item.cannotCollectReason || 'Incasso non consentito'">
                  <mat-icon>lock</mat-icon>
                  Incassa
                </button>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 32px 16px;
      color: #64748b;
      font-size: 0.9375rem;

      &--error { color: #b91c1c; }

      mat-icon { color: #16a34a; }
    }

    .rows {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .row {
      display: grid;
      grid-template-columns: 90px 1fr auto 110px auto;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      border: 1px solid #fee2e2;
      border-left: 4px solid #dc2626;
      border-radius: 10px;
      background: #fffafa;

      &--busy { opacity: 0.6; }
    }

    .row__when {
      display: flex;
      flex-direction: column;

      .date { font-weight: 600; color: #1f2937; font-size: 0.875rem; }
      .time { color: #6b7280; font-size: 0.75rem; }
    }

    .row__what {
      display: flex;
      flex-direction: column;
      min-width: 0;

      .services {
        font-weight: 500;
        color: #1f2937;
        font-size: 0.9375rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .meta {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #6b7280;
        font-size: 0.8125rem;
      }

      .meta__icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .path { color: #9ca3af; }
    }

    .row__status {
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: #e5e7eb;
      color: #374151;
      white-space: nowrap;

      &--IN_PROGRESS, &--WAITING { background: #fef3c7; color: #92400e; }
      &--CLOSED { background: #e0e7ff; color: #3730a3; }
    }

    .row__amount {
      text-align: right;
      font-weight: 700;
      color: #b91c1c;
    }

    .row__action mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 4px;
    }

    @media (max-width: 720px) {
      .row {
        grid-template-columns: 1fr auto;
        row-gap: 8px;
      }
      .row__what { grid-column: 1 / -1; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingFeListComponent {
  @Input() items: PendingFeCollectionItem[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;
  /** Trattamento con un incasso in volo (bottone disabilitato). */
  @Input() busyTreatmentId: string | null = null;

  @Output() collect = new EventEmitter<PendingFeCollectionItem>();

  statusLabel(status: string): string {
    return PENDING_FE_STATUS_LABELS[status] ?? status;
  }
}

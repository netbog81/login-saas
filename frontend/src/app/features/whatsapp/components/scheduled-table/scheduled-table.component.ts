import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  WhatsappScheduledMessage,
  WhatsappScheduledType,
  SCHEDULED_TYPE_LABELS,
  SCHEDULED_TYPE_ICONS,
} from '../../models/whatsapp.models';

@Component({
  selector: 'app-scheduled-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading) {
      <div class="table-state">
        <mat-spinner diameter="32"></mat-spinner>
      </div>
    } @else if (!messages.length) {
      <div class="table-state empty">
        <mat-icon>schedule_send</mat-icon>
        <p>Nessun messaggio in programma</p>
      </div>
    } @else {
      <table mat-table [dataSource]="messages" class="scheduled-table">
        <ng-container matColumnDef="scheduledFor">
          <th mat-header-cell *matHeaderCellDef>Invio previsto</th>
          <td mat-cell *matCellDef="let m">
            <div class="when">{{ m.scheduledFor | date: 'dd/MM/yyyy HH:mm' }}</div>
            <div class="countdown">{{ relativeTime(m.scheduledFor) }}</div>
          </td>
        </ng-container>

        <ng-container matColumnDef="type">
          <th mat-header-cell *matHeaderCellDef>Tipo</th>
          <td mat-cell *matCellDef="let m">
            <span class="type-cell">
              <mat-icon class="type-icon">{{ typeIcon(m.type) }}</mat-icon>
              {{ typeLabel(m.type) }}
            </span>
            @if (isGrouped(m.type) && m.bufferedCount) {
              <span class="badge">{{ m.bufferedCount }} appuntamenti</span>
            }
          </td>
        </ng-container>

        <ng-container matColumnDef="patient">
          <th mat-header-cell *matHeaderCellDef>Destinatario</th>
          <td mat-cell *matCellDef="let m">
            <div class="who">{{ m.patientName || '—' }}</div>
            <div class="phone">{{ m.phone }}</div>
          </td>
        </ng-container>

        <ng-container matColumnDef="content">
          <th mat-header-cell *matHeaderCellDef>Anteprima</th>
          <td mat-cell *matCellDef="let m">
            @if (m.content) {
              <span class="preview" [matTooltip]="m.content" matTooltipClass="preview-tooltip">
                {{ preview(m.content) }}
              </span>
            } @else {
              <span class="preview muted">Testo composto alla chiusura della finestra</span>
            }
          </td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let m">
            <button mat-icon-button color="warn"
                    [disabled]="cancellingJobId === m.jobId"
                    matTooltip="Annulla questo invio"
                    (click)="cancel.emit(m)">
              @if (cancellingJobId === m.jobId) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                <mat-icon>cancel_schedule_send</mat-icon>
              }
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>
    }
  `,
  styles: [`
    .scheduled-table {
      width: 100%;
    }

    .table-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 40px 0;
      color: #888;
    }

    .table-state.empty mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #ccc;
    }

    .table-state p {
      margin: 0;
      font-size: 14px;
    }

    .when {
      font-weight: 500;
    }

    .countdown, .phone {
      font-size: 12px;
      color: #888;
    }

    .type-cell {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }

    .type-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #25d366;
    }

    .badge {
      display: inline-block;
      margin-left: 8px;
      padding: 1px 8px;
      border-radius: 10px;
      background: #e8f5e9;
      font-size: 11px;
      color: #2e7d32;
    }

    .preview {
      display: inline-block;
      max-width: 380px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: middle;
    }

    .preview.muted {
      color: #999;
      font-style: italic;
    }
  `],
})
export class ScheduledTableComponent {
  @Input() messages: WhatsappScheduledMessage[] = [];
  @Input() loading = false;
  /** jobId dell'invio in corso di annullamento, per lo spinner sulla riga. */
  @Input() cancellingJobId: string | null = null;
  @Output() cancel = new EventEmitter<WhatsappScheduledMessage>();

  displayedColumns = ['scheduledFor', 'type', 'patient', 'content', 'actions'];

  typeLabel(type: WhatsappScheduledType): string {
    return SCHEDULED_TYPE_LABELS[type] || type;
  }

  typeIcon(type: WhatsappScheduledType): string {
    return SCHEDULED_TYPE_ICONS[type] || 'send';
  }

  /**
   * Messaggi ancora in composizione: il testo non esiste, esiste il conteggio
   * di quanti appuntamenti ci sono finiti dentro finora.
   */
  isGrouped(type: WhatsappScheduledType): boolean {
    return type === 'recap' || type === 'update_recap' || type === 'cancel_recap';
  }

  preview(content: string): string {
    const firstLine = content.split('\n')[0];
    return firstLine.length > 70 ? `${firstLine.slice(0, 70)}…` : firstLine;
  }

  /** "fra 3 ore", "fra 12 minuti": aiuta a capire cosa sta per partire. */
  relativeTime(scheduledFor: string): string {
    const diffMs = new Date(scheduledFor).getTime() - Date.now();
    if (diffMs <= 0) return 'in partenza';

    const minutes = Math.round(diffMs / 60000);
    if (minutes < 60) return `fra ${minutes} minut${minutes === 1 ? 'o' : 'i'}`;

    const hours = Math.round(minutes / 60);
    if (hours < 48) return `fra ${hours} or${hours === 1 ? 'a' : 'e'}`;

    return `fra ${Math.round(hours / 24)} giorni`;
  }
}

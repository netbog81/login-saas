import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  WhatsappMessageLog,
  MESSAGE_STATUS_LABELS,
  MESSAGE_STATUS_ICONS,
  MESSAGE_TYPE_LABELS,
  WhatsappMessageStatus,
} from '../../models/whatsapp.models';

@Component({
  selector: 'app-message-table',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatChipsModule,
    MatProgressSpinnerModule,
  ],
  template: `
    @if (loading) {
      <div class="loading-container">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
    } @else if (messages.length === 0) {
      <div class="empty-state">
        <mat-icon>chat_bubble_outline</mat-icon>
        <p>Nessun messaggio trovato</p>
      </div>
    } @else {
      <div class="table-container">
        <table mat-table [dataSource]="messages" class="message-table">
          <!-- Data Column -->
          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef>Data/Ora</th>
            <td mat-cell *matCellDef="let row">
              {{ row.createdAt | date:'dd/MM/yyyy HH:mm' }}
            </td>
          </ng-container>

          <!-- Paziente Column -->
          <ng-container matColumnDef="patientName">
            <th mat-header-cell *matHeaderCellDef>Paziente</th>
            <td mat-cell *matCellDef="let row">
              {{ row.patientName || '-' }}
            </td>
          </ng-container>

          <!-- Telefono Column -->
          <ng-container matColumnDef="phoneNumber">
            <th mat-header-cell *matHeaderCellDef>Telefono</th>
            <td mat-cell *matCellDef="let row">
              {{ formatPhone(row.phoneNumber) }}
            </td>
          </ng-container>

          <!-- Tipo Column -->
          <ng-container matColumnDef="messageType">
            <th mat-header-cell *matHeaderCellDef>Tipo</th>
            <td mat-cell *matCellDef="let row">
              {{ getTypeLabel(row.messageType) }}
            </td>
          </ng-container>

          <!-- Stato Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Stato</th>
            <td mat-cell *matCellDef="let row">
              <span class="status-chip" [class]="'status-' + row.status">
                <mat-icon class="status-icon">{{ getStatusIcon(row.status) }}</mat-icon>
                {{ getStatusLabel(row.status) }}
              </span>
            </td>
          </ng-container>

          <!-- Azioni Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row">
              <button mat-icon-button
                      matTooltip="Dettaglio"
                      (click)="viewDetail.emit(row)">
                <mat-icon>visibility</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"
              (click)="viewDetail.emit(row)"
              class="clickable-row">
          </tr>
        </table>
      </div>
    }
  `,
  styles: [`
    .table-container {
      overflow-x: auto;
    }

    .message-table {
      width: 100%;
    }

    .clickable-row {
      cursor: pointer;
    }

    .clickable-row:hover {
      background: #f5f5f5;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .status-pending { background: #fff3e0; color: #e65100; }
    .status-sent { background: #e3f2fd; color: #1565c0; }
    .status-delivered { background: #e8f5e9; color: #2e7d32; }
    .status-read { background: #e0f2f1; color: #00695c; }
    .status-failed { background: #ffebee; color: #c62828; }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px;
      color: #999;
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }

    @media (max-width: 768px) {
      .message-table {
        font-size: 13px;
      }
    }
  `],
})
export class MessageTableComponent {
  @Input() messages: WhatsappMessageLog[] = [];
  @Input() loading = false;
  @Output() viewDetail = new EventEmitter<WhatsappMessageLog>();

  displayedColumns = ['createdAt', 'patientName', 'phoneNumber', 'messageType', 'status', 'actions'];

  getStatusLabel(status: WhatsappMessageStatus): string {
    return MESSAGE_STATUS_LABELS[status] || status;
  }

  getStatusIcon(status: WhatsappMessageStatus): string {
    return MESSAGE_STATUS_ICONS[status] || 'help';
  }

  getTypeLabel(type: string): string {
    return MESSAGE_TYPE_LABELS[type as keyof typeof MESSAGE_TYPE_LABELS] || type;
  }

  formatPhone(phone: string): string {
    if (!phone) return '-';
    // Format: +39 351 584 7659
    if (phone.length >= 12 && phone.startsWith('39')) {
      return `+${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
    }
    return phone;
  }
}

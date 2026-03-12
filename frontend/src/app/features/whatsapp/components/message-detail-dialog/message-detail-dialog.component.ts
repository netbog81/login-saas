import { Component, Inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import {
  WhatsappMessageLog,
  MESSAGE_STATUS_LABELS,
  MESSAGE_STATUS_ICONS,
  MESSAGE_TYPE_LABELS,
  WhatsappMessageStatus,
} from '../../models/whatsapp.models';

interface TimelineStep {
  label: string;
  icon: string;
  date?: Date;
  active: boolean;
}

@Component({
  selector: 'app-message-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
  ],
  template: `
    <h2 mat-dialog-title>Dettaglio Messaggio</h2>

    <mat-dialog-content>
      <div class="detail-grid">
        <div class="detail-row">
          <span class="detail-label">Paziente</span>
          <span class="detail-value">{{ data.patientName || '-' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Telefono</span>
          <span class="detail-value">{{ data.phoneNumber }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Tipo</span>
          <span class="detail-value">{{ getTypeLabel(data.messageType) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Stato</span>
          <span class="detail-value status-chip" [class]="'status-' + data.status">
            <mat-icon class="status-icon">{{ getStatusIcon(data.status) }}</mat-icon>
            {{ getStatusLabel(data.status) }}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Correlation ID</span>
          <span class="detail-value mono">{{ data.correlationId }}</span>
        </div>
        @if (data.evolutionMessageId) {
          <div class="detail-row">
            <span class="detail-label">Evolution ID</span>
            <span class="detail-value mono">{{ data.evolutionMessageId }}</span>
          </div>
        }
        @if (data.errorMessage) {
          <div class="detail-row error">
            <span class="detail-label">Errore</span>
            <span class="detail-value">{{ data.errorMessage }}</span>
          </div>
        }
      </div>

      <mat-divider></mat-divider>

      <h3>Timeline</h3>
      <div class="timeline">
        @for (step of timeline; track step.label) {
          <div class="timeline-step" [class.active]="step.active" [class.completed]="step.date">
            <div class="timeline-dot">
              <mat-icon>{{ step.icon }}</mat-icon>
            </div>
            <div class="timeline-info">
              <span class="timeline-label">{{ step.label }}</span>
              @if (step.date) {
                <span class="timeline-date">{{ step.date | date:'dd/MM/yyyy HH:mm:ss' }}</span>
              }
            </div>
          </div>
        }
      </div>

      @if (data.messageBody) {
        <mat-divider></mat-divider>
        <h3>Contenuto Messaggio</h3>
        <div class="message-body">{{ data.messageBody }}</div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Chiudi</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .detail-grid {
      display: grid;
      gap: 12px;
      margin-bottom: 16px;
    }

    .detail-row {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .detail-label {
      font-weight: 500;
      color: #666;
      min-width: 120px;
      font-size: 13px;
    }

    .detail-value {
      color: #333;
    }

    .detail-value.mono {
      font-family: monospace;
      font-size: 12px;
      color: #999;
    }

    .detail-row.error .detail-value {
      color: #c62828;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
    }

    .status-icon { font-size: 14px; width: 14px; height: 14px; }
    .status-pending { background: #fff3e0; color: #e65100; }
    .status-sent { background: #e3f2fd; color: #1565c0; }
    .status-delivered { background: #e8f5e9; color: #2e7d32; }
    .status-read { background: #e0f2f1; color: #00695c; }
    .status-failed { background: #ffebee; color: #c62828; }

    h3 {
      margin: 16px 0 12px;
      font-size: 14px;
      font-weight: 500;
      color: #333;
    }

    .timeline {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .timeline-step {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      opacity: 0.4;
    }

    .timeline-step.completed {
      opacity: 1;
    }

    .timeline-step.active {
      opacity: 1;
    }

    .timeline-dot {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .timeline-step.completed .timeline-dot {
      background: #25d366;
      color: white;
    }

    .timeline-dot mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .timeline-info {
      display: flex;
      flex-direction: column;
    }

    .timeline-label {
      font-weight: 500;
      font-size: 13px;
    }

    .timeline-date {
      font-size: 12px;
      color: #999;
    }

    .message-body {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 8px;
      font-size: 13px;
      white-space: pre-wrap;
    }

    @media (max-width: 600px) {
      .detail-row {
        flex-direction: column;
        gap: 4px;
      }

      .detail-label {
        min-width: auto;
      }
    }
  `],
})
export class MessageDetailDialogComponent {
  timeline: TimelineStep[];

  constructor(
    public dialogRef: MatDialogRef<MessageDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: WhatsappMessageLog,
  ) {
    this.timeline = this.buildTimeline();
  }

  getStatusLabel(status: WhatsappMessageStatus): string {
    return MESSAGE_STATUS_LABELS[status] || status;
  }

  getStatusIcon(status: WhatsappMessageStatus): string {
    return MESSAGE_STATUS_ICONS[status] || 'help';
  }

  getTypeLabel(type: string): string {
    return MESSAGE_TYPE_LABELS[type as keyof typeof MESSAGE_TYPE_LABELS] || type;
  }

  private buildTimeline(): TimelineStep[] {
    return [
      {
        label: 'Creato',
        icon: 'schedule',
        date: this.data.createdAt ? new Date(this.data.createdAt) : undefined,
        active: true,
      },
      {
        label: 'Inviato',
        icon: 'send',
        date: this.data.sentAt ? new Date(this.data.sentAt) : undefined,
        active: !!this.data.sentAt,
      },
      {
        label: 'Consegnato',
        icon: 'done',
        date: this.data.deliveredAt ? new Date(this.data.deliveredAt) : undefined,
        active: !!this.data.deliveredAt,
      },
      {
        label: 'Letto',
        icon: 'done_all',
        date: this.data.readAt ? new Date(this.data.readAt) : undefined,
        active: !!this.data.readAt,
      },
    ];
  }
}

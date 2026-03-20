import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import {
  TaskMessage,
  TaskMessageStatus,
  STATUS_LABELS,
  STATUS_ICONS,
  STATUS_COLORS,
} from '../models/task-message.models';

export interface TaskMessageDetailDialogData {
  message: TaskMessage;
  currentUserId: string;
}

export interface TaskMessageDetailDialogResult {
  action?: 'markRead' | 'complete';
}

@Component({
  selector: 'app-task-message-detail-dialog',
  standalone: true,
  imports: [CommonModule, DatePipe, MatDialogModule, MatButtonModule, MatIconModule, MatDividerModule, MatChipsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="title-icon">{{ getStatusIcon(message.status) }}</mat-icon>
      Dettaglio Messaggio
    </h2>

    <mat-dialog-content>
      <div class="detail-row">
        <span class="detail-label">Da:</span>
        <span class="detail-value">{{ getUserName(message.senderUser) }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">A:</span>
        <span class="detail-value">{{ getUserName(message.recipientUser) }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Stato:</span>
        <span class="detail-value status" [style.color]="getStatusColor(message.status)">
          {{ getStatusLabel(message.status) }}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Data creazione:</span>
        <span class="detail-value">{{ message.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
      </div>
      @if (message.availableFrom) {
        <div class="detail-row">
          <span class="detail-label">Disponibile dal:</span>
          <span class="detail-value">{{ message.availableFrom | date:'dd/MM/yyyy HH:mm' }}</span>
        </div>
      }
      @if (message.readAt) {
        <div class="detail-row">
          <span class="detail-label">Letto il:</span>
          <span class="detail-value">{{ message.readAt | date:'dd/MM/yyyy HH:mm' }}</span>
        </div>
      }
      @if (message.completedAt) {
        <div class="detail-row">
          <span class="detail-label">Completato il:</span>
          <span class="detail-value">{{ message.completedAt | date:'dd/MM/yyyy HH:mm' }}</span>
        </div>
      }

      <mat-divider></mat-divider>

      <div class="message-content">
        {{ message.content }}
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (isRecipient && message.status === 'READ') {
        <button mat-raised-button color="primary" (click)="onComplete()">
          <mat-icon>check_circle</mat-icon>
          Segna come eseguito
        </button>
      }
      <button mat-button (click)="onClose()">Chiudi</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .title-icon { vertical-align: middle; margin-right: 8px; }

    .detail-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .detail-label { color: #999; min-width: 120px; }
    .detail-value { color: #333; font-weight: 500; }
    .detail-value.status { font-weight: 600; }

    mat-divider { margin: 16px 0; }

    .message-content {
      font-size: 15px;
      line-height: 1.6;
      color: #333;
      white-space: pre-wrap;
      padding: 8px 0;
    }

    mat-dialog-actions button mat-icon {
      margin-right: 4px;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `],
})
export class TaskMessageDetailDialogComponent implements OnInit {
  message: TaskMessage;
  currentUserId: string;
  isRecipient: boolean;

  constructor(
    public dialogRef: MatDialogRef<TaskMessageDetailDialogComponent, TaskMessageDetailDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: TaskMessageDetailDialogData,
  ) {
    this.message = data.message;
    this.currentUserId = data.currentUserId;
    this.isRecipient = this.message.recipientUserId === this.currentUserId;
  }

  private shouldMarkRead = false;

  ngOnInit(): void {
    // Auto-mark as read if the recipient opens an AVAILABLE message
    if (this.isRecipient && this.message.status === TaskMessageStatus.AVAILABLE) {
      this.shouldMarkRead = true;
    }

    // When user closes the dialog normally, trigger markRead if needed
    this.dialogRef.beforeClosed().subscribe(() => {
      if (this.shouldMarkRead && !this.dialogRef.disableClose) {
        // Override the close result to include markRead action
      }
    });
  }

  /**
   * Override default close to include markRead action when applicable.
   */
  onClose(): void {
    if (this.shouldMarkRead) {
      this.dialogRef.close({ action: 'markRead' });
    } else {
      this.dialogRef.close();
    }
  }

  onComplete(): void {
    this.dialogRef.close({ action: 'complete' });
  }

  getUserName(user?: { name: string; surname?: string }): string {
    if (!user) return 'Utente sconosciuto';
    return `${user.name}${user.surname ? ' ' + user.surname : ''}`;
  }

  getStatusLabel(status: TaskMessageStatus): string {
    return STATUS_LABELS[status] || status;
  }

  getStatusIcon(status: TaskMessageStatus): string {
    return STATUS_ICONS[status] || 'help';
  }

  getStatusColor(status: TaskMessageStatus): string {
    return STATUS_COLORS[status] || '#999';
  }
}

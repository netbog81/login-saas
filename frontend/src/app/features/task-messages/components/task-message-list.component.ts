import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import {
  TaskMessage,
  TaskMessageStatus,
  STATUS_LABELS,
  STATUS_ICONS,
  STATUS_COLORS,
} from '../models/task-message.models';

@Component({
  selector: 'app-task-message-list',
  standalone: true,
  imports: [CommonModule, DatePipe, MatIconModule, MatButtonModule, MatTooltipModule, MatChipsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (messages.length === 0) {
      <div class="empty-state">
        <mat-icon class="empty-icon">inbox</mat-icon>
        <p>{{ emptyText }}</p>
      </div>
    } @else {
      <div class="message-list">
        @for (msg of messages; track msg.id) {
          <div
            class="message-card"
            [class.unread]="msg.status === 'AVAILABLE'"
            (click)="open.emit(msg)">

            <div class="card-header">
              <div class="card-user">
                @if (listType === 'inbox') {
                  <span class="label">Da:</span>
                  <span class="user-name">{{ getUserName(msg.senderUser) }}</span>
                }
                @if (listType === 'sent') {
                  <span class="label">A:</span>
                  <span class="user-name">{{ getUserName(msg.recipientUser) }}</span>
                }
                @if (listType === 'completed') {
                  @if (msg.senderUserId === currentUserId) {
                    <span class="label">A:</span>
                    <span class="user-name">{{ getUserName(msg.recipientUser) }}</span>
                  } @else {
                    <span class="label">Da:</span>
                    <span class="user-name">{{ getUserName(msg.senderUser) }}</span>
                  }
                }
              </div>
              <div class="card-meta">
                @if (listType === 'completed') {
                  <span class="direction-badge" [class.sent]="msg.senderUserId === currentUserId"
                    [class.received]="msg.senderUserId !== currentUserId">
                    {{ msg.senderUserId === currentUserId ? 'Inviato' : 'Ricevuto' }}
                  </span>
                }
                <span class="card-date">
                  @if (msg.status === 'SCHEDULED' && msg.availableFrom) {
                    <span class="scheduled-label">Disponibile dal {{ msg.availableFrom | date:'dd/MM/yyyy' }}</span>
                  } @else {
                    {{ msg.createdAt | date:'dd/MM/yyyy HH:mm' }}
                  }
                </span>
              </div>
            </div>

            <div class="card-content">
              {{ msg.content.length > 120 ? msg.content.substring(0, 120) + '...' : msg.content }}
            </div>

            <div class="card-footer">
              <div class="status-chip" [style.color]="getStatusColor(msg.status)">
                <mat-icon class="status-icon">{{ getStatusIcon(msg.status) }}</mat-icon>
                <span>{{ getStatusLabel(msg.status) }}</span>
              </div>

              <div class="card-actions" (click)="$event.stopPropagation()">
                @if (listType === 'inbox' && msg.status === 'READ') {
                  <button mat-icon-button matTooltip="Segna come eseguito" color="primary"
                    (click)="complete.emit(msg)">
                    <mat-icon>check_circle</mat-icon>
                  </button>
                }
                @if (listType === 'sent' && msg.status === 'SCHEDULED') {
                  <button mat-icon-button matTooltip="Modifica" (click)="edit.emit(msg)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button matTooltip="Cancella" color="warn" (click)="delete.emit(msg)">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
                @if (listType === 'sent' && msg.status === 'AVAILABLE') {
                  <button mat-icon-button matTooltip="Cancella" color="warn" (click)="delete.emit(msg)">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 16px;
      color: #999;
    }
    .empty-icon { font-size: 48px; width: 48px; height: 48px; color: #ccc; }
    .empty-state p { margin-top: 12px; font-size: 14px; }

    .message-list { display: flex; flex-direction: column; gap: 8px; }

    .message-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px 16px;
      cursor: pointer;
      transition: box-shadow 0.2s, background 0.2s;
    }
    .message-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .message-card.unread {
      background: #e3f2fd;
      border-left: 4px solid #2196f3;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .card-user { font-size: 13px; }
    .label { color: #999; margin-right: 4px; }
    .user-name { font-weight: 500; color: #333; }
    .card-meta { display: flex; align-items: center; gap: 8px; }
    .card-date { font-size: 12px; color: #999; }
    .scheduled-label { color: #ff9800; font-weight: 500; }
    .direction-badge {
      font-size: 11px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 12px;
      white-space: nowrap;
    }
    .direction-badge.sent { background: #e3f2fd; color: #1565c0; }
    .direction-badge.received { background: #f3e5f5; color: #7b1fa2; }

    .card-content {
      font-size: 14px;
      color: #555;
      line-height: 1.4;
      margin-bottom: 8px;
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .status-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    .status-icon { font-size: 16px; width: 16px; height: 16px; }
    .card-actions { display: flex; gap: 0; }

    @media (max-width: 600px) {
      .card-header { flex-direction: column; align-items: flex-start; gap: 4px; }
      .message-card { padding: 10px 12px; }
    }
  `],
})
export class TaskMessageListComponent {
  @Input() messages: TaskMessage[] = [];
  @Input() emptyText = 'Nessun messaggio';
  @Input() currentUserId = '';
  @Input() listType: 'inbox' | 'sent' | 'completed' = 'inbox';

  @Output() open = new EventEmitter<TaskMessage>();
  @Output() delete = new EventEmitter<TaskMessage>();
  @Output() complete = new EventEmitter<TaskMessage>();
  @Output() edit = new EventEmitter<TaskMessage>();

  readonly TaskMessageStatus = TaskMessageStatus;

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

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  WhatsappConversation,
  WhatsappConversationStatus,
  conversationLabel,
  formatPhone,
} from '../../models/whatsapp-chat.model';

/**
 * Layer 1 — Dumb Component.
 *
 * Elenco delle conversazioni della inbox. Distingue visivamente i numeri
 * non collegati a un paziente: sono quelli che la segreteria deve smistare.
 */
@Component({
  selector: 'app-conversation-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  template: `
    @if (loading) {
      <div class="list-state">
        <mat-spinner diameter="32"></mat-spinner>
      </div>
    } @else if (conversations.length === 0) {
      <div class="list-state empty">
        <mat-icon>forum</mat-icon>
        <span>Nessuna conversazione.</span>
      </div>
    } @else {
      <div class="conversation-list">
        @for (conversation of conversations; track conversation.id) {
          <div class="conversation-row"
               [class.unread]="conversation.unreadCount > 0"
               (click)="open.emit(conversation)">
            <mat-icon class="row-icon"
                      [class.unknown]="!conversation.patientId">
              {{ conversation.patientId ? 'account_circle' : 'help_outline' }}
            </mat-icon>

            <div class="row-text">
              <div class="row-top">
                <span class="row-name">{{ label(conversation) }}</span>
                <span class="row-time">{{ timeLabel(conversation) }}</span>
              </div>
              <div class="row-bottom">
                <span class="row-preview">
                  @if (conversation.lastMessageDirection === 'OUTBOUND') {
                    <mat-icon class="preview-direction">reply</mat-icon>
                  }
                  {{ conversation.lastMessagePreview || phone(conversation) }}
                </span>
                @if (conversation.unreadCount > 0) {
                  <span class="row-badge">{{ conversation.unreadCount }}</span>
                }
              </div>
              @if (!conversation.patientId) {
                <span class="row-unknown">Numero non collegato a un paziente</span>
              }
            </div>

            <button mat-icon-button class="row-menu"
                    [matMenuTriggerFor]="rowMenu"
                    (click)="$event.stopPropagation()">
              <mat-icon>more_vert</mat-icon>
            </button>
            <mat-menu #rowMenu="matMenu">
              <button mat-menu-item (click)="park.emit(conversation)">
                <mat-icon>crop_square</mat-icon>
                <span>Parcheggia in Chat in corso</span>
              </button>
              <button mat-menu-item (click)="linkPatient.emit(conversation)">
                <mat-icon>person_search</mat-icon>
                <span>{{ conversation.patientId ? 'Cambia paziente collegato' : 'Collega a un paziente' }}</span>
              </button>
              @if (conversation.status !== 'ARCHIVED') {
                <button mat-menu-item (click)="changeStatus.emit({ conversation, status: 'ARCHIVED' })">
                  <mat-icon>archive</mat-icon>
                  <span>Archivia</span>
                </button>
              } @else {
                <button mat-menu-item (click)="changeStatus.emit({ conversation, status: 'OPEN' })">
                  <mat-icon>unarchive</mat-icon>
                  <span>Riapri</span>
                </button>
              }
              @if (conversation.status !== 'BLOCKED') {
                <button mat-menu-item (click)="changeStatus.emit({ conversation, status: 'BLOCKED' })">
                  <mat-icon>block</mat-icon>
                  <span>Blocca numero</span>
                </button>
              } @else {
                <button mat-menu-item (click)="changeStatus.emit({ conversation, status: 'OPEN' })">
                  <mat-icon>lock_open</mat-icon>
                  <span>Sblocca numero</span>
                </button>
              }
            </mat-menu>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .list-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 48px 16px;
      color: #64748b;
      font-size: 14px;
    }

    .list-state.empty mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      opacity: 0.4;
    }

    .conversation-list {
      display: flex;
      flex-direction: column;
    }

    .conversation-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 8px;
      border-bottom: 1px solid #eef2f7;
      cursor: pointer;

      &:hover {
        background: #f8fafc;
      }
    }

    .conversation-row.unread .row-name {
      font-weight: 600;
    }

    .row-icon {
      flex: 0 0 auto;
      color: #075e54;
      margin-top: 2px;
    }

    .row-icon.unknown {
      color: #ea580c;
    }

    .row-text {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .row-top,
    .row-bottom {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .row-name {
      flex: 1 1 auto;
      font-size: 14px;
      color: #0f172a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .row-time {
      flex: 0 0 auto;
      font-size: 11px;
      color: #94a3b8;
    }

    .row-preview {
      flex: 1 1 auto;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12.5px;
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .preview-direction {
      font-size: 14px;
      width: 14px;
      height: 14px;
      opacity: 0.7;
    }

    .row-badge {
      flex: 0 0 auto;
      background: #25d366;
      color: #08312a;
      border-radius: 10px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      font-size: 11px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .row-unknown {
      font-size: 11px;
      color: #ea580c;
    }

    .row-menu {
      flex: 0 0 auto;
    }
  `],
})
export class ConversationListComponent {
  @Input() conversations: WhatsappConversation[] = [];
  @Input() loading = false;

  @Output() open = new EventEmitter<WhatsappConversation>();
  @Output() park = new EventEmitter<WhatsappConversation>();
  @Output() linkPatient = new EventEmitter<WhatsappConversation>();
  @Output() changeStatus = new EventEmitter<{
    conversation: WhatsappConversation;
    status: WhatsappConversationStatus;
  }>();

  label(conversation: WhatsappConversation): string {
    return conversationLabel(conversation);
  }

  phone(conversation: WhatsappConversation): string {
    return formatPhone(conversation.phoneNumber);
  }

  /** Ora se oggi, altrimenti data breve: come in ogni client di messaggistica. */
  timeLabel(conversation: WhatsappConversation): string {
    if (!conversation.lastMessageAt) return '';
    const date = new Date(conversation.lastMessageAt);
    if (isNaN(date.getTime())) return '';

    const today = new Date();
    const sameDay =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();

    return sameDay
      ? date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }
}

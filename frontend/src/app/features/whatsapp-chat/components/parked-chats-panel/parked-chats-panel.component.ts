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
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  WhatsappConversation,
  conversationLabel,
  formatPhone,
} from '../../models/whatsapp-chat.model';

/**
 * Layer 1 — Dumb Component.
 *
 * Elenco delle chat parcheggiate: quelle che la segreteria vuole tenere sotto
 * mano senza lasciarne il riquadro aperto a schermo. Un click le riapre.
 */
@Component({
  selector: 'app-parked-chats-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    @if (conversations.length === 0) {
      <div class="empty">
        Nessuna chat in corso. Qui compaiono i messaggi in arrivo a cui
        rispondere e le chat messe da parte col quadratino nella barra del
        riquadro.
      </div>
    } @else {
      <div class="parked-list">
        @for (conversation of conversations; track conversation.id) {
          <div class="parked-item"
               [class.has-unread]="conversation.unreadCount > 0"
               (click)="open.emit(conversation)">
            <mat-icon class="item-icon">chat</mat-icon>
            <div class="item-text">
              <span class="item-name">{{ label(conversation) }}</span>
              <span class="item-preview">
                {{ conversation.lastMessagePreview || phone(conversation) }}
              </span>
            </div>
            @if (conversation.unreadCount > 0) {
              <span class="item-badge">{{ conversation.unreadCount }}</span>
            }
            <button mat-icon-button class="item-remove"
                    [matTooltip]="conversation.unreadCount > 0
                      ? 'Segna come letta e togli dall\\'elenco'
                      : 'Togli dalle chat in corso'"
                    (click)="remove.emit(conversation); $event.stopPropagation()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }
      </div>
    }

    <div class="panel-actions">
      <button type="button" class="panel-action" (click)="newChat.emit()">
        <mat-icon>add_comment</mat-icon>
        <span>Nuova chat</span>
      </button>
      @if (conversations.length > 0) {
        <button type="button" class="panel-action" (click)="clearAll.emit()">
          <mat-icon>playlist_remove</mat-icon>
          <span>Svuota chat in corso</span>
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .panel-actions {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
    }

    .panel-action {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 6px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: #475569;
      font-size: 12px;
      text-align: left;
      cursor: pointer;

      &:hover { background: #f1f5f9; }

      mat-icon {
        font-size: 17px;
        width: 17px;
        height: 17px;
        color: #64748b;
      }
    }

    .empty {
      padding: 8px 4px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.4;
    }

    .parked-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .parked-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 4px 6px 6px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s;

      &:hover {
        background: #f1f5f9;
      }
    }

    .parked-item.has-unread .item-name {
      font-weight: 600;
    }

    .item-icon {
      flex: 0 0 auto;
      color: #075e54;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .item-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1 1 auto;
      line-height: 1.25;
    }

    .item-name {
      font-size: 13px;
      color: #1e293b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .item-preview {
      font-size: 11px;
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .item-badge {
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

    .item-remove {
      flex: 0 0 auto;
      width: 26px;
      height: 26px;
      padding: 2px;

      mat-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
        color: #94a3b8;
      }
    }
  `],
})
export class ParkedChatsPanelComponent {
  @Input() conversations: WhatsappConversation[] = [];

  @Output() open = new EventEmitter<WhatsappConversation>();
  @Output() remove = new EventEmitter<WhatsappConversation>();
  @Output() newChat = new EventEmitter<void>();
  @Output() clearAll = new EventEmitter<void>();

  label(conversation: WhatsappConversation): string {
    return conversationLabel(conversation);
  }

  phone(conversation: WhatsappConversation): string {
    return formatPhone(conversation.phoneNumber);
  }
}

import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { WhatsappChatMessage } from '../../models/whatsapp-chat.model';

/**
 * Layer 1 — Dumb Component.
 *
 * Elenco messaggi di una conversazione, dal piu' vecchio al piu' recente.
 * Nessuna logica di caricamento: riceve i messaggi gia' pronti.
 */
@Component({
  selector: 'app-chat-message-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="message-list" #scrollRef>
      @if (loading && messages.length === 0) {
        <div class="list-placeholder">
          <mat-spinner diameter="28"></mat-spinner>
        </div>
      } @else if (messages.length === 0) {
        <div class="list-placeholder empty">
          <mat-icon>chat_bubble_outline</mat-icon>
          <span>Nessun messaggio. Scrivi per iniziare la conversazione.</span>
        </div>
      } @else {
        @for (group of groupedByDay; track group.day) {
          <div class="day-separator"><span>{{ group.label }}</span></div>
          @for (message of group.messages; track message.id) {
            <div class="bubble-row" [class.outbound]="message.direction === 'OUTBOUND'">
              <div class="bubble" [class.failed]="message.status === 'FAILED'">
                @if (message.body) {
                  <span class="bubble-text">{{ message.body }}</span>
                } @else {
                  <span class="bubble-media">
                    <mat-icon>attach_file</mat-icon>
                    {{ mediaLabel(message.mediaType) }}
                  </span>
                }
                <div class="bubble-meta">
                  @if (message.direction === 'OUTBOUND' && message.senderName) {
                    <span class="sender">{{ message.senderName }}</span>
                  }
                  <span class="time">{{ timeLabel(message) }}</span>
                  @if (message.direction === 'OUTBOUND') {
                    <mat-icon class="status-icon" [class]="'status-' + message.status"
                              [title]="statusLabel(message.status)">
                      {{ statusIcon(message.status) }}
                    </mat-icon>
                  }
                </div>
                @if (message.status === 'FAILED') {
                  <div class="bubble-error">
                    <span>{{ message.errorMessage || 'Invio fallito' }}</span>
                    <button type="button" class="retry-btn"
                            [disabled]="retryingId === message.id"
                            (click)="retry.emit(message)">
                      {{ retryingId === message.id ? 'Invio…' : 'Riprova' }}
                    </button>
                  </div>
                }
              </div>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
    }

    .message-list {
      height: 100%;
      overflow-y: auto;
      padding: 12px;
      background: #efeae2;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .list-placeholder {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #6b7280;
      font-size: 13px;
      text-align: center;
      padding: 24px 16px;
    }

    .list-placeholder.empty mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      opacity: 0.5;
    }

    .day-separator {
      display: flex;
      justify-content: center;
      margin: 8px 0 4px;

      span {
        background: rgba(255, 255, 255, 0.85);
        border-radius: 10px;
        padding: 2px 10px;
        font-size: 11px;
        color: #54656f;
        text-transform: capitalize;
      }
    }

    .bubble-row {
      display: flex;
      justify-content: flex-start;
    }

    .bubble-row.outbound {
      justify-content: flex-end;
    }

    /* Ricevuti: bianco a sinistra. Inviati: verde a destra. Stessi colori di
       WhatsApp, così il verso del messaggio si legge a colpo d'occhio. */
    .bubble {
      position: relative;
      max-width: 78%;
      background: #ffffff;
      border-radius: 8px;
      padding: 6px 9px 4px;
      box-shadow: 0 1px 0.5px rgba(11, 20, 26, 0.13);
      font-size: 13.5px;
      line-height: 1.35;
      color: #111b21;
    }

    .bubble-row.outbound .bubble {
      background: #d9fdd3;
    }

    /* Codina della bolla, come nel client vero: rafforza il verso anche
       quando due messaggi consecutivi hanno colori simili. */
    .bubble::after {
      content: '';
      position: absolute;
      top: 0;
      width: 8px;
      height: 8px;
      background: inherit;
    }

    .bubble-row:not(.outbound) .bubble {
      border-top-left-radius: 0;
    }

    .bubble-row:not(.outbound) .bubble::after {
      left: -6px;
      clip-path: polygon(100% 0, 100% 100%, 0 0);
    }

    .bubble-row.outbound .bubble {
      border-top-right-radius: 0;
    }

    .bubble-row.outbound .bubble::after {
      right: -6px;
      clip-path: polygon(0 0, 0 100%, 100% 0);
    }

    /* L'errore NON sostituisce il colore della bolla: sovrascrivendo il verde
       si perdeva la distinzione inviato/ricevuto proprio nel momento in cui
       serve di più. Si segnala con un bordo rosso. */
    .bubble.failed {
      border: 1px solid #dc2626;
      box-shadow: none;
    }

    .bubble-text {
      white-space: pre-wrap;
      word-break: break-word;
    }

    .bubble-media {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-style: italic;
      color: #54656f;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .bubble-meta {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      margin-top: 2px;
      font-size: 10.5px;
      color: #667781;
    }

    .sender {
      font-weight: 500;
    }

    .status-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .status-read {
      color: #53bdeb;
    }

    .status-failed {
      color: #dc2626;
    }

    .bubble-error {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      font-size: 11px;
      color: #b91c1c;
    }

    .retry-btn {
      flex: 0 0 auto;
      border: 1px solid #b91c1c;
      background: none;
      color: #b91c1c;
      border-radius: 4px;
      padding: 1px 6px;
      font-size: 11px;
      cursor: pointer;

      &:hover:not(:disabled) { background: rgba(185, 28, 28, 0.08); }
      &:disabled { opacity: 0.6; cursor: default; }
    }
  `],
})
export class ChatMessageListComponent implements AfterViewChecked {
  @Input() messages: WhatsappChatMessage[] = [];
  @Input() loading = false;
  /** Id del messaggio in corso di reinvio, per disabilitarne il pulsante. */
  @Input() retryingId: string | null = null;

  /** Reinvio di un messaggio rimasto in errore. */
  @Output() retry = new EventEmitter<WhatsappChatMessage>();

  @ViewChild('scrollRef') scrollRef?: ElementRef<HTMLDivElement>;

  /** Numero di messaggi all'ultimo autoscroll, per non rubare lo scroll. */
  private lastScrolledCount = -1;

  /**
   * Autoscroll in fondo solo quando arrivano messaggi nuovi: se l'operatore
   * sta rileggendo la cronologia piu' in alto, non lo si trascina giu'.
   */
  ngAfterViewChecked(): void {
    if (this.messages.length === this.lastScrolledCount) return;
    const el = this.scrollRef?.nativeElement;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const wasAtBottom = distanceFromBottom < 120 || this.lastScrolledCount === -1;
    this.lastScrolledCount = this.messages.length;
    if (wasAtBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }

  /** Messaggi raggruppati per giorno, per l'etichetta separatrice. */
  get groupedByDay(): { day: string; label: string; messages: WhatsappChatMessage[] }[] {
    const groups = new Map<string, WhatsappChatMessage[]>();
    for (const message of this.messages) {
      const day = (message.createdAt || '').slice(0, 10);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(message);
    }
    return Array.from(groups.entries()).map(([day, messages]) => ({
      day,
      label: this.dayLabel(day),
      messages,
    }));
  }

  private dayLabel(day: string): string {
    if (!day) return '';
    const date = new Date(day + 'T00:00:00');
    if (isNaN(date.getTime())) return day;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - date.getTime()) / 86_400_000);
    if (diffDays === 0) return 'Oggi';
    if (diffDays === 1) return 'Ieri';
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  timeLabel(message: WhatsappChatMessage): string {
    const raw = message.sentAt || message.createdAt;
    if (!raw) return '';
    const date = new Date(raw);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

  mediaLabel(mediaType?: string): string {
    switch (mediaType) {
      case 'image': return 'Immagine ricevuta';
      case 'audio': return 'Messaggio vocale ricevuto';
      case 'video': return 'Video ricevuto';
      case 'document': return 'Documento ricevuto';
      case 'sticker': return 'Sticker ricevuto';
      case 'location': return 'Posizione ricevuta';
      case 'contact': return 'Contatto ricevuto';
      default: return 'Allegato ricevuto';
    }
  }

  statusIcon(status: string): string {
    switch (status) {
      case 'PENDING': return 'schedule';
      case 'SENT': return 'check';
      case 'DELIVERED': return 'done_all';
      case 'READ': return 'done_all';
      case 'FAILED': return 'error_outline';
      default: return 'check';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'PENDING': return 'In invio';
      case 'SENT': return 'Inviato';
      case 'DELIVERED': return 'Consegnato';
      case 'READ': return 'Letto';
      case 'FAILED': return 'Invio fallito';
      default: return status;
    }
  }
}

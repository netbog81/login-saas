import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

/** Risposta rapida offerta nel menu del compositore. */
export interface QuickReply {
  label: string;
  text: string;
}

/** Altezza minima e massima della casella di scrittura, in px. */
export const MIN_INPUT_HEIGHT = 38;
export const MAX_INPUT_HEIGHT = 260;

/**
 * Layer 1 — Dumb Component.
 *
 * Casella di scrittura della chat. Il testo e' un `@Input`/`@Output`
 * controllato dall'esterno: la bozza vive nello stato della finestra, cosi'
 * non si perde minimizzando o parcheggiando la chat.
 */
@Component({
  selector: 'app-chat-composer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
  ],
  template: `
    <!-- Il pannello delle risposte rapide è renderizzato DENTRO il compositore
         e non con un mat-menu: i menu Material vivono nel contenitore overlay
         CDK, che sta sotto la finestra di chat e li renderebbe invisibili. -->
    <div class="composer-wrapper">
      <!-- Maniglia per alzare/abbassare la casella di scrittura: serve a chi
           deve comporre messaggi lunghi senza scrollare dentro tre righe. -->
      <div class="composer-grip"
           title="Trascina per cambiare l'altezza del campo di scrittura"
           (mousedown)="onGripMouseDown($event)">
        <span class="grip-bar"></span>
      </div>

      @if (quickRepliesOpen && quickReplies.length > 0) {
        <div class="quick-panel">
          @for (reply of quickReplies; track reply.label) {
            <button type="button" class="quick-item" (click)="applyQuickReply(reply)">
              <span class="quick-label">{{ reply.label }}</span>
              <span class="quick-text">{{ reply.text }}</span>
            </button>
          }
        </div>
      }

      <div class="composer" [class.disabled]="disabled">
        @if (quickReplies.length > 0 && !disabled) {
          <button mat-icon-button type="button" class="quick-btn"
                  [class.active]="quickRepliesOpen"
                  (click)="toggleQuickReplies()"
                  title="Risposte rapide">
            <mat-icon>bolt</mat-icon>
          </button>
        }

        @if (showRecap && !disabled) {
          <button mat-icon-button type="button" class="recap-btn"
                  [disabled]="loadingRecap"
                  (click)="appointmentsRecap.emit()"
                  title="Inserisci il riepilogo dei prossimi appuntamenti">
            <mat-icon>{{ loadingRecap ? 'hourglass_empty' : 'event_note' }}</mat-icon>
          </button>
        }

        <textarea
          class="composer-input"
          rows="1"
          [style.height.px]="inputHeight"
          [placeholder]="disabled ? disabledReason : 'Scrivi un messaggio…'"
          [disabled]="disabled"
          [ngModel]="text"
          (ngModelChange)="onTextChange($event)"
          (keydown)="onKeydown($event)"></textarea>

        <button mat-icon-button color="primary" type="button" class="send-btn"
                [disabled]="disabled || sending || !text.trim()"
                (click)="emitSend()"
                title="Invia (Invio)">
          <mat-icon>{{ sending ? 'hourglass_empty' : 'send' }}</mat-icon>
        </button>
      </div>

      @if (recapError) {
        <div class="composer-error">{{ recapError }}</div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .composer-wrapper { position: relative; }

    .composer-grip {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 10px;
      cursor: ns-resize;
      background: #f0f2f5;
      border-top: 1px solid #e2e8f0;
    }

    .grip-bar {
      width: 36px;
      height: 3px;
      border-radius: 2px;
      background: #cbd5e1;
    }

    .composer-grip:hover .grip-bar { background: #94a3b8; }

    .composer-error {
      padding: 4px 12px 6px;
      background: #f0f2f5;
      font-size: 11.5px;
      color: #b91c1c;
    }

    .quick-panel {
      position: absolute;
      bottom: 100%;
      left: 4px;
      right: 4px;
      max-height: 200px;
      overflow-y: auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 -4px 12px rgba(11, 20, 26, 0.15);
      margin-bottom: 4px;
      display: flex;
      flex-direction: column;
      z-index: 1;
    }

    .quick-item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 8px 10px;
      border: none;
      background: none;
      text-align: left;
      cursor: pointer;
      font: inherit;

      &:hover { background: #f1f5f9; }
      & + & { border-top: 1px solid #f1f5f9; }
    }

    .quick-label {
      font-size: 12.5px;
      font-weight: 600;
      color: #0f172a;
    }

    .quick-text {
      font-size: 11.5px;
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }

    .quick-btn.active mat-icon { color: #075e54; }

    .composer {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      padding: 6px 8px;
      background: #f0f2f5;
      border-top: 1px solid #e2e8f0;
    }

    .composer.disabled {
      opacity: 0.75;
    }

    /* L'altezza è pilotata dalla maniglia (style.height), non da max-height:
       serve poter comporre messaggi lunghi vedendoli tutti. */
    .composer-input {
      flex: 1;
      resize: none;
      border: none;
      outline: none;
      border-radius: 8px;
      padding: 9px 12px;
      font: inherit;
      font-size: 13.5px;
      line-height: 1.4;
      overflow-y: auto;
      background: #ffffff;
      color: #111b21;
    }

    .composer-input:disabled {
      background: #e9edef;
    }

    .quick-btn,
    .send-btn {
      flex: 0 0 auto;
    }
  `],
})
export class ChatComposerComponent implements OnDestroy {
  @Input() text = '';
  @Input() sending = false;
  @Input() disabled = false;
  @Input() disabledReason = 'Conversazione non disponibile';
  @Input() quickReplies: QuickReply[] = [];

  /** Mostra l'icona del recap appuntamenti (solo con paziente collegato). */
  @Input() showRecap = false;
  @Input() loadingRecap = false;
  /** Messaggio d'errore del recap, mostrato sotto la casella. */
  @Input() recapError = '';
  /** Altezza corrente della casella di scrittura, in px. */
  @Input() inputHeight = MIN_INPUT_HEIGHT;

  @Output() textChange = new EventEmitter<string>();
  @Output() send = new EventEmitter<string>();
  @Output() appointmentsRecap = new EventEmitter<void>();
  /** Nuova altezza della casella dopo il trascinamento della maniglia. */
  @Output() inputHeightChange = new EventEmitter<number>();

  /** Pannello risposte rapide aperto. */
  quickRepliesOpen = false;

  private dragStartY = 0;
  private dragStartHeight = 0;
  private readonly onDragMove = (event: MouseEvent) => {
    // Si trascina verso l'ALTO per ingrandire: la casella cresce verso l'alto,
    // quindi il delta va invertito.
    const next = this.dragStartHeight + (this.dragStartY - event.clientY);
    this.inputHeight = Math.min(Math.max(next, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT);
  };
  private readonly onDragEnd = () => {
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
    this.inputHeightChange.emit(this.inputHeight);
  };

  toggleQuickReplies(): void {
    this.quickRepliesOpen = !this.quickRepliesOpen;
  }

  /**
   * Avvia il trascinamento della maniglia. I listener stanno su `document` e
   * non sull'elemento: il puntatore esce quasi sempre dalla maniglia mentre si
   * trascina, e il ridimensionamento si interromperebbe.
   */
  onGripMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.dragStartY = event.clientY;
    this.dragStartHeight = this.inputHeight;
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
  }

  onTextChange(value: string): void {
    this.text = value;
    this.textChange.emit(value);
  }

  /**
   * Invio con Invio, a capo con Shift+Invio: e' la convenzione di WhatsApp e
   * di ogni chat, cambiarla farebbe partire messaggi a meta'.
   */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.emitSend();
    }
  }

  emitSend(): void {
    const value = this.text.trim();
    if (!value || this.sending || this.disabled) return;
    this.send.emit(value);
  }

  applyQuickReply(reply: QuickReply): void {
    // La risposta rapida si somma alla bozza invece di sostituirla: chi ha
    // gia' scritto qualcosa non deve perderlo.
    const next = this.text.trim() ? `${this.text.trim()} ${reply.text}` : reply.text;
    this.onTextChange(next);
    this.quickRepliesOpen = false;
  }
}

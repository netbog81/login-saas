import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragEnd } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ChatMessageListComponent } from '../chat-message-list/chat-message-list.component';
import {
  ChatComposerComponent,
  QuickReply,
  MIN_INPUT_HEIGHT,
} from '../chat-composer/chat-composer.component';
import {
  WhatsappChatMessage,
  WhatsappConversation,
  conversationLabel,
  formatPhone,
} from '../../models/whatsapp-chat.model';

/**
 * Layer 1 — Dumb Component.
 *
 * Riquadro flottante di una conversazione: trascinabile dalla barra del
 * titolo, comprimibile (resta la sola barra), ridimensionabile dall'angolo in
 * basso a destra e parcheggiabile nel pannello laterale.
 *
 * Non conosce ne' servizi ne' stato applicativo: riceve tutto via `@Input` ed
 * emette intenzioni via `@Output`.
 */
@Component({
  selector: 'app-chat-window',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DragDropModule,
    MatIconModule,
    MatButtonModule,
    ChatMessageListComponent,
    ChatComposerComponent,
  ],
  template: `
    <div class="chat-window"
         #windowRef
         [class.minimized]="minimized"
         cdkDrag
         cdkDragBoundary="body"
         [cdkDragFreeDragPosition]="{ x: x, y: y }"
         (cdkDragEnded)="onDragEnded($event)"
         [style.width.px]="minimized ? collapsedWidth : width"
         [style.height.px]="minimized ? null : height"
         (mousedown)="focus.emit()"
         (mouseup)="onWindowMouseUp()">

      <!-- Barra del titolo: maniglia di trascinamento + azioni -->
      <div class="window-header" cdkDragHandle (dblclick)="minimize.emit()">
        <div class="header-identity">
          <mat-icon class="header-avatar">account_circle</mat-icon>
          <div class="header-text">
            <span class="header-name">{{ label }}</span>
            <span class="header-phone">{{ phoneLabel }}</span>
          </div>
          @if (conversation && conversation.unreadCount > 0) {
            <span class="header-unread">{{ conversation.unreadCount }}</span>
          }
        </div>

        <!-- Le azioni non devono avviare il drag ne' minimizzare al doppio click -->
        <!-- Tooltip nativi e non matTooltip: i tooltip Material vivono nel
             contenitore overlay CDK, che sta SOTTO questa finestra (vedi
             z-index sull'host) e li renderebbe invisibili. -->
        <div class="header-actions"
             (mousedown)="$event.stopPropagation()"
             (dblclick)="$event.stopPropagation()">
          @if (conversation?.patientId) {
            <button mat-icon-button (click)="patientAppointments.emit()"
                    title="Appuntamenti del paziente">
              <mat-icon>event_note</mat-icon>
            </button>
          }
          <button mat-icon-button (click)="minimize.emit()"
                  [title]="minimized ? 'Espandi' : 'Comprimi'">
            <mat-icon>{{ minimized ? 'expand_less' : 'expand_more' }}</mat-icon>
          </button>
          <button mat-icon-button (click)="park.emit()"
                  title="Parcheggia in Chat in corso">
            <mat-icon>crop_square</mat-icon>
          </button>
          <button mat-icon-button (click)="close.emit()" title="Chiudi">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      @if (!minimized) {
        <div class="window-body">
          @if (unknownContact) {
            <div class="unknown-banner">
              <mat-icon>help_outline</mat-icon>
              <span>Numero non collegato a un paziente.</span>
              <button mat-button color="primary" (click)="linkPatient.emit()">Collega</button>
            </div>
          }

          <app-chat-message-list class="window-messages"
                                 [messages]="messages"
                                 [loading]="loadingMessages"
                                 [retryingId]="retryingId"
                                 (retry)="retry.emit($event)">
          </app-chat-message-list>

          <!-- Il recap è un'icona accanto alle risposte rapide e non un
               pulsante a tutta larghezza: nella finestra lo spazio verticale è
               quello che serve ai messaggi. Non invia: riempie la casella di
               scrittura, così l'operatore rilegge e integra prima di mandare. -->
          <app-chat-composer
            [text]="draft"
            [sending]="sending"
            [disabled]="blocked"
            [disabledReason]="'Conversazione bloccata'"
            [quickReplies]="quickReplies"
            [showRecap]="!!conversation?.patientId"
            [loadingRecap]="loadingRecap"
            [recapError]="recapError"
            [inputHeight]="inputHeight"
            (appointmentsRecap)="appointmentsRecap.emit()"
            (inputHeightChange)="inputHeightChange.emit($event)"
            (textChange)="draftChange.emit($event)"
            (send)="send.emit($event)">
          </app-chat-composer>
        </div>

        <!-- Segnaposto grafico: il ridimensionamento vero e' quello nativo del
             browser (CSS resize sul riquadro). -->
        <div class="resize-handle">
          <mat-icon>drag_handle</mat-icon>
        </div>
      }
    </div>
  `,
  styles: [`
    /* Lo z-index va QUI e non sul div interno: position fixed crea un
       contesto di impilamento, quindi un z-index sul figlio resterebbe
       confinato dentro l'host (che varrebbe auto) e qualsiasi elemento del
       calendario con z-index proprio finirebbe sopra la finestra — i click
       andrebbero alla cella sottostante invece che alla chat. */
    :host {
      position: fixed;
      top: 0;
      left: 0;
      pointer-events: none;
    }

    .chat-window {
      position: absolute;
      display: flex;
      flex-direction: column;
      pointer-events: auto;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 12px 28px rgba(11, 20, 26, 0.25);
      overflow: hidden;
      min-width: 300px;
      min-height: 260px;
      resize: both;
    }

    /* Compressa: resta la sola barra del titolo, niente resize. */
    .chat-window.minimized {
      height: auto !important;
      min-height: 0;
      resize: none;
    }

    .window-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 6px 6px 10px;
      background: #075e54;
      color: #ffffff;
      cursor: move;
      user-select: none;
      flex: 0 0 auto;
    }

    .header-identity {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1 1 auto;
    }

    .header-avatar {
      opacity: 0.9;
      flex: 0 0 auto;
    }

    .header-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
      line-height: 1.15;
    }

    .header-name {
      font-weight: 500;
      font-size: 13.5px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .header-phone {
      font-size: 11px;
      opacity: 0.8;
      font-variant-numeric: tabular-nums;
    }

    .header-unread {
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

    .header-actions {
      display: flex;
      align-items: center;
      flex: 0 0 auto;

      .mat-mdc-icon-button {
        width: 32px;
        height: 32px;
        padding: 4px;
        color: #ffffff;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .window-body {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .window-messages {
      flex: 1 1 auto;
      min-height: 0;
    }

    .unknown-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: #fff7ed;
      border-bottom: 1px solid #fed7aa;
      font-size: 12px;
      color: #9a3412;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      button {
        margin-left: auto;
      }
    }

    .resize-handle {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 16px;
      height: 16px;
      pointer-events: none;
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        transform: rotate(-45deg);
      }
    }
  `],
})
export class ChatWindowComponent {
  @Input() conversation?: WhatsappConversation;
  @Input() messages: WhatsappChatMessage[] = [];
  @Input() loadingMessages = false;
  @Input() sending = false;
  @Input() draft = '';
  @Input() minimized = false;
  @Input() x = 0;
  @Input() y = 0;
  @Input() width = 360;
  @Input() height = 480;
  @Input() zIndex = 1;
  @Input() quickReplies: QuickReply[] = [];
  /** Id del messaggio in corso di reinvio. */
  @Input() retryingId: string | null = null;
  /** Recap appuntamenti in preparazione. */
  @Input() loadingRecap = false;
  /** Motivo per cui il recap non è disponibile (es. nessun appuntamento). */
  @Input() recapError = '';
  /** Altezza della casella di scrittura, regolabile dalla maniglia. */
  @Input() inputHeight = MIN_INPUT_HEIGHT;

  @Output() close = new EventEmitter<void>();
  @Output() minimize = new EventEmitter<void>();
  @Output() park = new EventEmitter<void>();
  @Output() focus = new EventEmitter<void>();
  @Output() linkPatient = new EventEmitter<void>();
  /** Apre l'elenco appuntamenti del paziente collegato alla conversazione. */
  @Output() patientAppointments = new EventEmitter<void>();
  @Output() send = new EventEmitter<string>();
  @Output() retry = new EventEmitter<WhatsappChatMessage>();
  /** Richiesta del recap: il testo finirà nella bozza, non parte da solo. */
  @Output() appointmentsRecap = new EventEmitter<void>();
  @Output() inputHeightChange = new EventEmitter<number>();
  @Output() draftChange = new EventEmitter<string>();
  @Output() moved = new EventEmitter<{ x: number; y: number }>();
  @Output() resized = new EventEmitter<{ width: number; height: number }>();

  @ViewChild('windowRef') windowRef?: ElementRef<HTMLDivElement>;

  /**
   * Impilamento della finestra, applicato all'HOST perche' e' lui a creare il
   * contesto (`position: fixed`).
   */
  @HostBinding('style.z-index')
  get hostZIndex(): number {
    return this.zIndex;
  }

  /** Larghezza della finestra quando e' compressa alla sola barra. */
  readonly collapsedWidth = 280;

  get label(): string {
    return this.conversation ? conversationLabel(this.conversation) : 'Chat';
  }

  get phoneLabel(): string {
    return this.conversation ? formatPhone(this.conversation.phoneNumber) : '';
  }

  get blocked(): boolean {
    return this.conversation?.status === 'BLOCKED';
  }

  /** Numero senza paziente collegato: lo si segnala per invitare a smistarlo. */
  get unknownContact(): boolean {
    return !!this.conversation && !this.conversation.patientId;
  }

  onDragEnded(event: CdkDragEnd): void {
    const position = event.source.getFreeDragPosition();
    this.moved.emit({ x: position.x, y: position.y });
  }

  /**
   * Il ridimensionamento e' quello nativo del browser (`resize: both`), che non
   * emette eventi: al rilascio del mouse sul riquadro si confronta la
   * dimensione effettiva con quella nota e, se e' cambiata, la si persiste —
   * altrimenti tornerebbe ai valori in `@Input` alla prima ricomposizione.
   */
  onWindowMouseUp(): void {
    const el = this.windowRef?.nativeElement;
    if (!el || this.minimized) return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    if (width !== this.width || height !== this.height) {
      this.resized.emit({ width, height });
    }
  }
}

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Subject, takeUntil } from 'rxjs';
import {
  LinkPatientDialogComponent,
  LinkPatientDialogData,
  LinkPatientDialogResult,
} from '../components/link-patient-dialog/link-patient-dialog.component';
import { ChatWindowComponent } from '../components/chat-window/chat-window.component';
import { MIN_INPUT_HEIGHT } from '../components/chat-composer/chat-composer.component';
import { WhatsappChatService } from '../services/whatsapp-chat.service';
import { WhatsappChatStateService } from '../services/whatsapp-chat-state.service';
import { PatientService } from '../../../services/patient.service';
import { Patient } from '../../../models/patient.model';
import {
  PatientAppointmentsDialogComponent,
  PatientAppointmentsDialogData,
} from '../../operators-new/containers/patient-appointments-dialog.component';
import {
  WhatsappChatMessage,
  WhatsappConversation,
} from '../models/whatsapp-chat.model';

/** Quante righe di cronologia si caricano all'apertura della finestra. */
const HISTORY_PAGE_SIZE = 50;

/**
 * Layer 2 — Smart Container di UNA finestra di chat.
 *
 * Si occupa del caricamento dei messaggi, dell'invio e del refresh quando
 * arriva un evento realtime per questa conversazione. La disposizione a
 * schermo (posizione, dimensione, z-index) sta nello stato condiviso, gestito
 * dall'host.
 */
@Component({
  selector: 'app-whatsapp-chat-window-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ChatWindowComponent],
  template: `
    <app-chat-window
      [conversation]="conversation"
      [messages]="messages"
      [loadingMessages]="loading"
      [sending]="sending"
      [draft]="draft"
      [minimized]="minimized"
      [x]="x"
      [y]="y"
      [width]="width"
      [height]="height"
      [zIndex]="zIndex"
      [quickReplies]="state.quickReplies()"
      [retryingId]="retryingId"
      [loadingRecap]="loadingRecap"
      [recapError]="recapError"
      [inputHeight]="inputHeight"
      (appointmentsRecap)="onAppointmentsRecap()"
      (inputHeightChange)="onInputHeightChange($event)"
      (close)="onClose()"
      (minimize)="onMinimize()"
      (park)="onPark()"
      (focus)="onFocus()"
      (linkPatient)="onLinkPatient()"
      (patientAppointments)="onPatientAppointments()"
      (send)="onSend($event)"
      (retry)="onRetry($event)"
      (draftChange)="onDraftChange($event)"
      (moved)="onMoved($event)"
      (resized)="onResized($event)">
    </app-chat-window>
  `,
})
export class WhatsappChatWindowContainer implements OnInit, OnDestroy {
  @Input({ required: true }) conversationId!: string;

  private readonly chatService = inject(WhatsappChatService);
  /** Pubblico: il template legge da qui le risposte rapide configurate. */
  readonly state = inject(WhatsappChatStateService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly patientService = inject(PatientService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  conversation?: WhatsappConversation;
  messages: WhatsappChatMessage[] = [];
  loading = false;
  sending = false;
  /** Id del messaggio in corso di reinvio. */
  retryingId: string | null = null;

  /** Recap appuntamenti in preparazione + eventuale motivo di indisponibilità. */
  loadingRecap = false;
  recapError = '';

  constructor() {
    // Un evento realtime su QUESTA conversazione ricarica i messaggi. Il
    // segnale porta id + timestamp, così due eventi consecutivi sulla stessa
    // conversazione scattano entrambi.
    effect(() => {
      const changed = this.state.lastChangedConversationId();
      if (!changed.at) return;
      if (changed.id && changed.id !== this.conversationId) return;
      this.loadMessages({ silent: true });
      this.reloadConversation();
    });
  }

  ngOnInit(): void {
    this.conversation = this.state.conversations().get(this.conversationId);
    this.reloadConversation();
    this.loadMessages();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== STATO FINESTRA ====================

  private get window() {
    return this.state.getWindow(this.conversationId);
  }

  get minimized(): boolean { return this.window?.minimized ?? false; }
  get x(): number { return this.window?.x ?? 0; }
  get y(): number { return this.window?.y ?? 0; }
  get width(): number { return this.window?.width ?? 360; }
  get height(): number { return this.window?.height ?? 480; }
  get zIndex(): number { return this.window?.zIndex ?? 1; }
  get draft(): string { return this.window?.draft ?? ''; }
  get inputHeight(): number { return this.window?.inputHeight ?? MIN_INPUT_HEIGHT; }

  onInputHeightChange(height: number): void {
    this.state.updateWindow(this.conversationId, { inputHeight: height });
  }

  onClose(): void { this.state.closeWindow(this.conversationId); }
  onMinimize(): void { this.state.toggleMinimized(this.conversationId); }
  onPark(): void { this.state.park(this.conversationId); }
  onFocus(): void { this.state.bringToFront(this.conversationId); }
  onDraftChange(draft: string): void { this.state.setDraft(this.conversationId, draft); }
  onMoved(position: { x: number; y: number }): void {
    this.state.updateWindow(this.conversationId, position);
  }
  onResized(size: { width: number; height: number }): void {
    this.state.updateWindow(this.conversationId, size);
  }

  /**
   * Apre il riquadro degli appuntamenti del paziente — lo stesso raggiungibile
   * da Pazienti → scheda paziente, non una copia: da lì si annullano gli
   * appuntamenti e si invia il recap.
   *
   * Il riquadro è un MatDialog, quindi vive nel contenitore overlay CDK che sta
   * SOTTO la finestra di chat: senza `sendToBack` resterebbe nascosto dietro.
   */
  onPatientAppointments(): void {
    const patientId = this.conversation?.patientId;
    if (!patientId) return;

    this.state.sendToBack(this.conversationId);

    // Il riquadro vuole nome e cognome separati, che la conversazione non ha:
    // si legge l'anagrafica. Se non risponde si apre lo stesso col nominativo
    // denormalizzato — l'elenco appuntamenti dipende solo dall'id.
    this.patientService.getPatient(patientId).subscribe({
      next: (patient) => this.openAppointmentsDialog(patient ?? this.fallbackPatient(patientId)),
      error: (err) => {
        console.warn('[WhatsappChat] Anagrafica non raggiungibile:', err);
        this.openAppointmentsDialog(this.fallbackPatient(patientId));
      },
    });
  }

  /** Paziente minimo ricavato dalla conversazione, se l'anagrafica non risponde. */
  private fallbackPatient(patientId: string): Patient {
    const label = this.conversation?.patientName ?? '';
    const [cognome, ...rest] = label.split(' ');
    return {
      id: patientId,
      cognome: cognome ?? '',
      nome: rest.join(' '),
    } as unknown as Patient;
  }

  private openAppointmentsDialog(patient: Patient): void {
    const ref = this.dialog.open(PatientAppointmentsDialogComponent, {
      data: { patient } as PatientAppointmentsDialogData,
      width: '700px',
      height: '500px',
      panelClass: 'resizable-dialog-panel',
    });
    ref.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.state.bringToFront(this.conversationId));
  }

  /**
   * Collega il numero a un paziente dell'anagrafica. Da qui in poi la
   * conversazione smette di essere "da smistare" e mostra il nominativo.
   */
  onLinkPatient(): void {
    if (!this.conversation) return;
    // La finestra sta sopra agli overlay CDK: senza questo coprirebbe il
    // dialog che sta aprendo. Torna davanti alla chiusura.
    this.state.sendToBack(this.conversationId);

    const ref = this.dialog.open(LinkPatientDialogComponent, {
      width: '480px',
      data: {
        phoneNumber: this.conversation.phoneNumber,
        contactName: this.conversation.contactName,
      } as LinkPatientDialogData,
    });

    ref.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: LinkPatientDialogResult | undefined) => {
        if (!result) {
          this.state.bringToFront(this.conversationId);
          return;
        }
        this.chatService
          .linkPatient(this.conversationId, result.patientId, result.patientName)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (conversation) => {
              // Nessun messaggio di conferma: il nominativo compare
              // nell'intestazione e l'avviso "non collegato" sparisce.
              this.conversation = conversation;
              this.state.cacheConversation(conversation);
              this.state.bringToFront(this.conversationId);
              this.cdr.markForCheck();
            },
            error: (err) => {
              const reason = err?.graphQLErrors?.[0]?.message || err?.message || 'Errore sconosciuto';
              // La finestra resta dietro finché l'avviso è a schermo: da
              // davanti lo coprirebbe (gli snackbar stanno negli overlay CDK).
              this.snackBar
                .open(`Collegamento fallito: ${reason}`, 'OK', { duration: 5000 })
                .afterDismissed()
                .pipe(takeUntil(this.destroy$))
                .subscribe(() => this.state.bringToFront(this.conversationId));
            },
          });
      });
  }

  // ==================== DATI ====================

  private reloadConversation(): void {
    this.chatService.getConversation(this.conversationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (conversation) => {
          this.conversation = conversation;
          this.state.cacheConversation(conversation);
          // Finestra aperta e non compressa = l'operatore la sta guardando:
          // i messaggi arrivati vanno considerati letti.
          if (conversation.unreadCount > 0 && !this.minimized) {
            this.state.markAsRead(this.conversationId);
          }
          this.cdr.markForCheck();
        },
        error: (err) => console.error('[WhatsappChat] Conversazione non caricata:', err),
      });
  }

  private loadMessages(options?: { silent?: boolean }): void {
    if (!options?.silent) {
      this.loading = true;
      this.cdr.markForCheck();
    }
    this.chatService.listMessages(this.conversationId, 1, HISTORY_PAGE_SIZE)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (page) => {
          this.messages = page.items;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.cdr.markForCheck();
          console.error('[WhatsappChat] Messaggi non caricati:', err);
        },
      });
  }

  onSend(text: string): void {
    if (this.sending) return;
    this.sending = true;
    this.cdr.markForCheck();

    this.chatService.sendMessage({ conversationId: this.conversationId, text })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (message) => {
          this.messages = [...this.messages, message];
          this.state.setDraft(this.conversationId, '');
          this.sending = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.sending = false;
          // Niente snackbar: sta nel contenitore overlay CDK, che è dietro a
          // questa finestra. Il backend ha comunque salvato il messaggio come
          // FAILED, quindi ricaricando compare in rosso con il pulsante
          // Riprova — il testo non si perde e l'errore resta a vista.
          this.state.setDraft(this.conversationId, '');
          this.loadMessages({ silent: true });
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Prepara il riepilogo dei prossimi appuntamenti e lo mette nella casella di
   * scrittura. Volutamente NON lo invia: è un messaggio che parte al paziente,
   * l'operatore deve poterlo rileggere e integrare.
   */
  onAppointmentsRecap(): void {
    if (this.loadingRecap) return;
    this.loadingRecap = true;
    this.recapError = '';
    this.cdr.markForCheck();

    this.chatService.getAppointmentsRecap(this.conversationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (text) => {
          this.loadingRecap = false;
          if (!text) {
            this.recapError = 'Nessun appuntamento programmato';
            this.cdr.markForCheck();
            return;
          }
          const current = this.draft.trim();
          this.state.setDraft(this.conversationId, current ? `${current}\n\n${text}` : text);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loadingRecap = false;
          // Messaggio SEMPRE nostro e in italiano: quello che risalirebbe da
          // Apollo/Nest è tecnico e in inglese. In linea e non a snackbar,
          // perché la finestra sta sopra agli overlay CDK.
          console.warn('[WhatsappChat] Recap non disponibile:', err);
          this.recapError = 'Nessun appuntamento programmato';
          this.cdr.markForCheck();
        },
      });
  }

  /** Reinvio di un messaggio rimasto in errore, sulla stessa riga. */
  onRetry(message: WhatsappChatMessage): void {
    if (this.retryingId) return;
    this.retryingId = message.id;
    this.cdr.markForCheck();

    this.chatService.retryMessage(message.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.messages = this.messages.map((m) => (m.id === updated.id ? updated : m));
          this.retryingId = null;
          this.cdr.markForCheck();
        },
        error: () => {
          this.retryingId = null;
          // Il backend ha già riscritto l'errore sulla riga: basta ricaricare.
          this.loadMessages({ silent: true });
          this.cdr.markForCheck();
        },
      });
  }
}

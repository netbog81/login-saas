import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Subject, takeUntil } from 'rxjs';
import { ConversationListComponent } from '../components/conversation-list/conversation-list.component';
import {
  LinkPatientDialogComponent,
  LinkPatientDialogData,
  LinkPatientDialogResult,
} from '../components/link-patient-dialog/link-patient-dialog.component';
import { WhatsappChatService } from '../services/whatsapp-chat.service';
import { WhatsappChatStateService } from '../services/whatsapp-chat-state.service';
import {
  WhatsappConversation,
  WhatsappConversationStatus,
} from '../models/whatsapp-chat.model';

/**
 * Layer 2 — Smart Container.
 *
 * Inbox completa delle conversazioni WhatsApp. E' l'unico punto da cui si
 * raggiungono i messaggi arrivati da numeri NON in anagrafica: dal calendario
 * si parte sempre da un appuntamento, quindi da un paziente noto.
 */
@Component({
  selector: 'app-whatsapp-chat-inbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    ConversationListComponent,
  ],
  template: `
    <div class="inbox">
      <div class="inbox-toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
          <mat-label>Cerca</mat-label>
          <input matInput
                 [(ngModel)]="search"
                 (ngModelChange)="onSearchChange()"
                 placeholder="Nome, numero…">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="status-field">
          <mat-label>Stato</mat-label>
          <mat-select [(ngModel)]="status" (ngModelChange)="reload()">
            <mat-option value="OPEN">Aperte</mat-option>
            <mat-option value="ARCHIVED">Archiviate</mat-option>
            <mat-option value="BLOCKED">Bloccate</mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-stroked-button (click)="reload()">
          <mat-icon>refresh</mat-icon>
          Aggiorna
        </button>
      </div>

      <app-conversation-list
        [conversations]="conversations"
        [loading]="loading"
        (open)="onOpen($event)"
        (park)="onPark($event)"
        (linkPatient)="onLinkPatient($event)"
        (changeStatus)="onChangeStatus($event)">
      </app-conversation-list>
    </div>
  `,
  styles: [`
    .inbox {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 760px;
    }

    .inbox-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .search-field { flex: 1 1 240px; }
    .status-field { flex: 0 0 160px; }
  `],
})
export class WhatsappChatInboxContainer implements OnInit, OnDestroy {
  private readonly chatService = inject(WhatsappChatService);
  private readonly state = inject(WhatsappChatStateService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  conversations: WhatsappConversation[] = [];
  loading = false;
  search = '';
  status: WhatsappConversationStatus = 'OPEN';

  private searchDebounce?: ReturnType<typeof setTimeout>;

  constructor() {
    // Un messaggio in arrivo cambia l'ordine e i non letti: la lista si
    // riallinea da sola invece di costringere a premere Aggiorna.
    effect(() => {
      const changed = this.state.lastChangedConversationId();
      if (!changed.at) return;
      this.reload({ silent: true });
    });
  }

  ngOnInit(): void {
    this.state.start();
    this.reload();
  }

  ngOnDestroy(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.reload(), 300);
  }

  reload(options?: { silent?: boolean }): void {
    if (!options?.silent) {
      this.loading = true;
      this.cdr.markForCheck();
    }
    this.chatService
      .listConversations({ status: this.status, search: this.search || undefined })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (conversations) => {
          this.conversations = conversations;
          conversations.forEach((c) => this.state.cacheConversation(c));
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.cdr.markForCheck();
          console.error('[WhatsappChat] Conversazioni non caricate:', err);
        },
      });
  }

  onOpen(conversation: WhatsappConversation): void {
    this.state.openConversation(conversation);
  }

  onPark(conversation: WhatsappConversation): void {
    this.state.cacheConversation(conversation);
    this.state.park(conversation.id);
    this.snackBar.open('Chat parcheggiata in "Chat in corso".', 'OK', { duration: 3000 });
  }

  /**
   * Smistamento di un numero non riconosciuto: e' il passaggio che rende utile
   * la inbox completa, altrimenti quelle conversazioni resterebbero anonime.
   */
  onLinkPatient(conversation: WhatsappConversation): void {
    const ref = this.dialog.open(LinkPatientDialogComponent, {
      width: '480px',
      data: {
        phoneNumber: conversation.phoneNumber,
        contactName: conversation.contactName,
      } as LinkPatientDialogData,
    });

    ref.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: LinkPatientDialogResult | undefined) => {
        if (!result) return;
        this.chatService
          .linkPatient(conversation.id, result.patientId, result.patientName)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (updated) => {
              this.state.cacheConversation(updated);
              this.reload();
              this.snackBar.open('Numero collegato al paziente.', 'OK', { duration: 3000 });
            },
            error: (err) => {
              const reason = err?.graphQLErrors?.[0]?.message || err?.message || 'Errore sconosciuto';
              this.snackBar.open(`Collegamento fallito: ${reason}`, 'OK', { duration: 5000 });
            },
          });
      });
  }

  onChangeStatus(event: {
    conversation: WhatsappConversation;
    status: WhatsappConversationStatus;
  }): void {
    this.chatService.setStatus(event.conversation.id, event.status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.reload();
          this.state.refreshUnreadCount();
        },
        error: (err) => {
          const reason = err?.graphQLErrors?.[0]?.message || err?.message || 'Errore sconosciuto';
          this.snackBar.open(`Operazione fallita: ${reason}`, 'OK', { duration: 5000 });
        },
      });
  }
}

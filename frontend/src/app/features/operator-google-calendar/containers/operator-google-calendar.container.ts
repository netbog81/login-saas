/**
 * Operator Google Calendar Container
 * Layer 2: Smart Component
 *
 * Coordina il pannello Google Calendar della scheda operatore: stato,
 * indirizzo dichiarato, apertura del consenso e scollegamento.
 *
 * Tiene SOLO lo UI state; le chiamate passano da OperatorGoogleCalendarService
 * (Layer 3, BaseGraphQLService/NgZone).
 */

import {
  Component, Input, ChangeDetectionStrategy, ChangeDetectorRef, inject,
  OnInit, OnChanges, OnDestroy, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';

import {
  OperatorGoogleCalendarPanelComponent,
} from '../components/operator-google-calendar-panel/operator-google-calendar-panel.component';
import { OperatorGoogleCalendarService } from '../services/operator-google-calendar.service';
import { OperatorGoogleCalendarStatus } from '../models/operator-google-calendar.model';
import {
  ConfirmMatDialogComponent, ConfirmMatDialogData,
} from '../../../shared/components/confirm-mat-dialog/confirm-mat-dialog.component';

@Component({
  selector: 'app-operator-google-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, OperatorGoogleCalendarPanelComponent],
  template: `
    <app-operator-google-calendar-panel
      [status]="status"
      [loading]="loading"
      [error]="error"
      (connect)="onConnect($event)"
      (disconnect)="onDisconnect()"
      (saveEmail)="onSaveEmail($event)"
      (renameCalendar)="onRenameCalendar($event)"
      (syncNow)="onSyncNow()">
    </app-operator-google-calendar-panel>
  `,
})
export class OperatorGoogleCalendarContainer implements OnInit, OnChanges, OnDestroy {
  @Input() operatorId: string | null = null;

  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);
  private service = inject(OperatorGoogleCalendarService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  status: OperatorGoogleCalendarStatus | null = null;
  loading = false;
  error: string | null = null;

  /** Finestra del consenso Google, per accorgersi di quando si chiude. */
  private consentWindow: Window | null = null;
  private consentWatcher?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['operatorId'] && !changes['operatorId'].firstChange) this.load();
  }

  ngOnDestroy(): void {
    this.stopWatchingConsent();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private load(): void {
    if (!this.operatorId) {
      this.status = null;
      return;
    }
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    this.service.getStatus(this.operatorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => this.apply(status),
        error: (err: any) => {
          this.status = null;
          this.loading = false;
          this.error = err?.graphQLErrors?.[0]?.message
            || err?.message
            || 'Errore imprevisto';
          this.cdr.markForCheck();
        },
      });
  }

  onSaveEmail(email: string): void {
    if (!this.operatorId) return;
    this.loading = true;
    this.cdr.markForCheck();
    this.service.setDeclaredEmail(this.operatorId, email.trim() || null)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.apply(status);
          this.snackBar.open('Indirizzo Google salvato', 'OK', { duration: 2500 });
        },
        error: (err) => this.fail(err),
      });
  }

  /**
   * Apre il consenso Google in una finestra separata.
   *
   * Separata e non un redirect della pagina corrente: chi sta configurando un
   * operatore ha il form aperto, magari con modifiche non salvate, e
   * mandarlo via da lì per poi riportarlo indietro significherebbe fargli
   * perdere il lavoro.
   */
  onConnect(calendarName: string): void {
    if (!this.operatorId) return;
    this.loading = true;
    this.cdr.markForCheck();

    this.service.startConnect(this.operatorId, calendarName)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (url) => {
          this.loading = false;
          this.cdr.markForCheck();
          this.consentWindow = window.open(url, 'curandis-google-consent', 'width=520,height=680');
          if (!this.consentWindow) {
            this.snackBar.open(
              'Il browser ha bloccato la finestra: consenti i popup e riprova.',
              'OK', { duration: 6000 },
            );
            return;
          }
          this.watchConsentWindow();
        },
        error: (err) => this.fail(err),
      });
  }

  /**
   * Quando la finestra del consenso si chiude, ricarica lo stato.
   *
   * Non si può ascoltare l'esito direttamente: la pagina di ritorno sta su un
   * altro dominio e il browser non lascia leggere nulla di quella finestra
   * tranne il fatto che sia chiusa. Ricaricare da noi è l'unica fonte
   * attendibile di cosa sia successo davvero.
   */
  private watchConsentWindow(): void {
    this.stopWatchingConsent();
    this.consentWatcher = setInterval(() => {
      if (this.consentWindow?.closed) {
        this.stopWatchingConsent();
        this.load();
      }
    }, 1000);
  }

  private stopWatchingConsent(): void {
    if (this.consentWatcher) clearInterval(this.consentWatcher);
    this.consentWatcher = undefined;
    this.consentWindow = null;
  }

  /** Rinomina il calendario già creato: cambia su Google e da noi. */
  onRenameCalendar(calendarName: string): void {
    if (!this.operatorId) return;
    this.loading = true;
    this.cdr.markForCheck();
    this.service.renameCalendar(this.operatorId, calendarName)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.apply(status);
          this.snackBar.open('Calendario rinominato', 'OK', { duration: 3000 });
        },
        error: (err) => this.fail(err),
      });
  }

  /** Forza la riversata degli appuntamenti sul calendario Google. */
  onSyncNow(): void {
    if (!this.operatorId) return;
    this.loading = true;
    this.cdr.markForCheck();
    this.service.syncNow(this.operatorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.apply(status);
          this.snackBar.open('Appuntamenti sincronizzati su Google', 'OK', { duration: 4000 });
        },
        error: (err) => this.fail(err),
      });
  }

  async onDisconnect(): Promise<void> {
    if (!this.operatorId) return;

    const ref = this.dialog.open(ConfirmMatDialogComponent, {
      width: '460px',
      data: {
        title: 'Scollegare Google Calendar?',
        message:
          "L'autorizzazione verrà revocata anche lato Google e gli appuntamenti "
          + "smetteranno di aggiornarsi nel calendario dell'operatore.\n\n"
          + 'Il calendario già creato resta nel suo account: potrà cancellarlo lui '
          + 'quando vuole.',
        confirmText: 'Scollega',
        cancelText: 'Annulla',
        confirmColor: 'warn',
        icon: 'link_off',
      } as ConfirmMatDialogData,
    });

    const confirmed = await new Promise<boolean | undefined>(resolve => {
      ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(r => resolve(r));
    });
    if (!confirmed) return;

    this.loading = true;
    this.cdr.markForCheck();
    this.service.disconnect(this.operatorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.apply(status);
          this.snackBar.open('Google Calendar scollegato', 'OK', { duration: 3000 });
        },
        error: (err) => this.fail(err),
      });
  }

  private apply(status: OperatorGoogleCalendarStatus): void {
    this.status = status;
    this.error = null;
    this.loading = false;
    this.cdr.markForCheck();
  }

  private fail(err: any): void {
    this.loading = false;
    this.cdr.markForCheck();
    this.snackBar.open(
      err?.graphQLErrors?.[0]?.message || 'Operazione non riuscita',
      'OK', { duration: 6000 },
    );
  }
}

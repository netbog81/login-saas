/**
 * Notification Channels Container
 * Layer 2: Smart Component
 *
 * Carica le impostazioni per canale e salva ogni modifica appena avviene.
 *
 * È anche il punto in cui una modifica innocua viene distinta da una che
 * lascerebbe dei messaggi senza nessun canale: il pannello non lo sa e non
 * deve saperlo, ma qualcuno deve chiederlo prima di salvare. Il 21/08/2026
 * nessuno lo chiedeva, e per tre giorni non è partito niente.
 */

import {
  Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';

import {
  NotificationChannelsPanelComponent, ChannelChange,
} from '../components/notification-channels-panel/notification-channels-panel.component';
import { NotificationChannelService } from '../services/notification-channel.service';
import {
  CATEGORY_LABELS, uncoveredAfter,
  NotificationChannelSetting, NotificationChannel,
} from '../models/notification-channel.model';
import {
  ConfirmMatDialogComponent,
} from '../../../shared/components/confirm-mat-dialog/confirm-mat-dialog.component';

@Component({
  selector: 'app-notification-channels',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NotificationChannelsPanelComponent],
  template: `
    <app-notification-channels-panel
      [settings]="settings"
      [loading]="loading"
      [saving]="saving"
      [error]="error"
      (change)="onChange($event)"
      (makeDefault)="onMakeDefault($event)"
      (reorder)="onReorder($event)">
    </app-notification-channels-panel>
  `,
})
export class NotificationChannelsContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);
  private service = inject(NotificationChannelService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  settings: NotificationChannelSetting[] = [];
  loading = false;
  saving = false;
  error: string | null = null;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.service.list().pipe(takeUntil(this.destroy$)).subscribe({
      next: (settings) => {
        this.settings = settings;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.loading = false;
        // Distinto dallo stato "nessun canale configurato": un errore di
        // lettura raccontato come configurazione manda a cercare il problema
        // dalla parte sbagliata.
        this.error = err?.graphQLErrors?.[0]?.message || err?.message || 'Errore imprevisto';
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Salva subito, senza pulsante — sono interruttori e caselle, e un "Salva"
   * separato aggiungerebbe un modo di perdere le modifiche senza aggiungere
   * nulla.
   *
   * L'unica eccezione è la modifica che lascia una categoria senza canali:
   * quella si ferma e si fa confermare. Non è vietata — spegnere WhatsApp
   * mentre si cambia numero è legittimo — ma non deve poter succedere per
   * distrazione, perché il suo effetto è silenzioso.
   */
  onChange(change: ChannelChange): void {
    const scoperte = uncoveredAfter(this.settings, change);
    if (!scoperte.length) {
      this.save(change);
      return;
    }

    const elenco = scoperte.map(c => `• ${CATEGORY_LABELS[c].name}`).join('\n');
    this.dialog
      .open(ConfirmMatDialogComponent, {
        width: '460px',
        data: {
          title: 'Questi messaggi smetteranno di partire',
          icon: 'warning',
          confirmColor: 'warn',
          confirmText: 'Spegni comunque',
          cancelText: 'Annulla',
          message:
            `Dopo questa modifica nessun canale acceso porterà:\n\n${elenco}\n\n` +
            'I pazienti non riceveranno più quei messaggi, e non comparirà nessun ' +
            'errore: semplicemente non partiranno. Puoi riaccendere un canale ' +
            'in qualsiasi momento da questa pagina.',
        },
      })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((ok) => {
        if (ok) this.save(change);
        // Rifiutata: si ricarica per rimettere in schermo lo stato vero.
        // L'interruttore ha già girato da solo al clic.
        else this.load();
      });
  }

  private save(change: ChannelChange): void {
    this.saving = true;
    this.cdr.markForCheck();

    this.service.update(change).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.settings = this.settings.map(s => (s.channel === updated.channel ? updated : s));
        this.saving = false;
        this.cdr.markForCheck();
      },
      error: (err: any) => this.onSaveError(err),
    });
  }

  /**
   * Rende un canale il predefinito portandolo in cima.
   *
   * Il predefinito è il primo acceso dell'elenco, quindi "rendere
   * predefinito" e "spostare in prima posizione" sono la stessa operazione:
   * tenerle separate significherebbe avere due modi di dire la stessa cosa,
   * che prima o poi si contraddicono.
   */
  onMakeDefault(channel: NotificationChannel): void {
    const ordine = [
      channel,
      ...this.settings.map(s => s.channel).filter(c => c !== channel),
    ];
    this.onReorder(ordine);
  }

  onReorder(order: NotificationChannel[]): void {
    this.saving = true;
    this.cdr.markForCheck();

    this.service.reorder(order).pipe(takeUntil(this.destroy$)).subscribe({
      next: (settings) => {
        this.settings = settings;
        this.saving = false;
        this.cdr.markForCheck();
      },
      error: (err: any) => this.onSaveError(err),
    });
  }

  private onSaveError(err: any): void {
    this.saving = false;
    this.cdr.markForCheck();
    this.snackBar.open(
      err?.graphQLErrors?.[0]?.message || 'Modifica non riuscita',
      'OK', { duration: 6000 },
    );
    // Il server non ha accettato: si ricarica invece di lasciare in schermo
    // uno stato che non esiste da nessuna parte.
    this.load();
  }
}

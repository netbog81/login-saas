/**
 * Google Token Monitor Container
 * Layer 2: Smart Component
 *
 * Porta lo stato del collegamento Google nella dashboard di chi lo usa, e ne
 * gestisce le due azioni: rinnovare adesso, o farsi mandare il link.
 */

import {
  Component, Input, ChangeDetectionStrategy, ChangeDetectorRef, inject,
  OnInit, OnChanges, OnDestroy, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import {
  ConfirmMatDialogComponent, ConfirmMatDialogData,
} from '../../../shared/components/confirm-mat-dialog/confirm-mat-dialog.component';
import { Subject, takeUntil, catchError } from 'rxjs';

import {
  GoogleTokenMonitorPanelComponent,
} from '../components/google-token-monitor-panel/google-token-monitor-panel.component';
import { OperatorGoogleCalendarService } from '../services/operator-google-calendar.service';
import { OperatorGoogleCalendarStatus } from '../models/operator-google-calendar.model';

@Component({
  selector: 'app-google-token-monitor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, GoogleTokenMonitorPanelComponent],
  template: `
    <app-google-token-monitor-panel
      [status]="status"
      [loading]="loading"
      [working]="working"
      [keepCalendarOnDisconnect]="keepCalendarOnDisconnect"
      (renew)="onRenew()"
      (sendLink)="onSendLink($event)"
      (alertToggle)="onAlertToggle($event)"
      (disconnect)="onDisconnect()">
    </app-google-token-monitor-panel>
  `,
})
export class GoogleTokenMonitorContainer implements OnInit, OnChanges, OnDestroy {
  /**
   * Operatore da mostrare. Se assente, si guarda il PROPRIO collegamento
   * ricavandolo dal token.
   *
   * Due strade perche' le operazioni per operatorId richiedono
   * `operator_calendar_manage`, che hanno chi amministra e la segreteria: un
   * operatore che apre la sua dashboard deve poter vedere il suo calendario
   * senza avere il permesso di gestire quelli degli altri.
   */
  @Input() operatorId: string | null = null;

  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);
  private service = inject(OperatorGoogleCalendarService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  private consentWindow: Window | null = null;
  private consentWatcher?: ReturnType<typeof setInterval>;

  status: OperatorGoogleCalendarStatus | null = null;
  loading = false;
  working = false;

  /** Impostazione dello studio: serve a dire cosa succede scollegandosi. */
  keepCalendarOnDisconnect = true;

  ngOnInit(): void {
    this.load();
    // Non blocca niente: se non arriva, il messaggio di conferma resta quello
    // prudente ("il calendario resta").
    this.service.getSyncSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (s) => {
          this.keepCalendarOnDisconnect = s.keepCalendarOnDisconnect;
          this.cdr.markForCheck();
        },
        error: () => undefined,
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['operatorId'] && !changes['operatorId'].firstChange) this.load();
  }

  ngOnDestroy(): void {
    this.stopWatchingConsent();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Il consenso Google si apre in una finestra a parte, non al posto del
   * gestionale.
   *
   * Sostituire la pagina significava perdere il posto in cui si stava
   * lavorando: se Google dava errore, o la persona cambiava idea, si ritrovava
   * fuori dal gestionale senza una strada per rientrare. Cosi' invece dietro
   * resta tutto com'era, e quando la finestra si chiude lo stato si ricarica
   * da solo.
   */
  private openConsent(url: string): void {
    this.consentWindow = window.open(url, 'curandis-google-consent', 'width=520,height=680');
    if (!this.consentWindow) {
      // Il browser puo' bloccare la finestra: meglio dirlo che lasciare
      // l'impressione che il pulsante non faccia niente.
      this.snackBar.open(
        'Il browser ha bloccato la finestra: consenti i popup e riprova.',
        'OK', { duration: 6000 },
      );
      return;
    }
    this.watchConsent();
  }

  /**
   * Alla chiusura della finestra si ricarica.
   *
   * L'esito non si puo' leggere: la pagina di ritorno sta su un altro
   * dominio e il browser non concede nulla di quella finestra tranne il fatto
   * che sia chiusa. Rileggere da noi e' l'unica fonte attendibile.
   */
  private watchConsent(): void {
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

  private load(): void {
    this.loading = true;
    this.cdr.markForCheck();

    // Se lo stato è arrivato dal ripiego, da qui in poi si lavora su di sé.
    // Il flag serve perché la condizione non si può dedurre dal risultato:
    // sulla PROPRIA dashboard il ripiego risponde con lo stesso operatore
    // che era stato chiesto (vedi sotto).
    let ripiegoSuDiSe = !this.operatorId;

    (this.operatorId
      ? this.service.getStatus(this.operatorId).pipe(
          // Chiedere lo stato di un operatore richiede
          // `operator_calendar_manage`, che hanno chi amministra e la
          // segreteria. Chi non ce l'ha ripiega sul PROPRIO collegamento
          // invece di restare senza riquadro: la dashboard è sua, e il
          // calendario di cui gli importa è il suo.
          catchError(() => {
            ripiegoSuDiSe = true;
            return this.service.getMyStatus();
          }),
        )
      : this.service.getMyStatus())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.status = status ?? null;
          // Il riquadro appariva ma i pulsanti restavano rotti: il reset era
          // legato a `status.operatorId !== this.operatorId`, che sulla
          // propria dashboard è sempre falso — il ripiego risponde proprio
          // con te. Risultato: l'operatore vedeva il pannello (query in
          // ripiego) ma "Ricollega" chiamava la mutation da segreteria e
          // finiva in "Permesso mancante: operator_calendar_manage".
          // Conta l'aver ripiegato, non su chi si è ripiegato.
          if (ripiegoSuDiSe) {
            this.operatorId = null;
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        // Un errore non si mostra: il riquadro semplicemente non compare. È un
        // pannello accessorio in una schermata che serve ad altro, e un banner
        // rosso qui allarmerebbe per la cosa sbagliata.
        error: () => {
          this.status = null;
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  /** Rinnovo diretto: apre il consenso Google in questa scheda. */
  onRenew(): void {
    this.working = true;
    this.cdr.markForCheck();

    (this.operatorId
      ? this.service.startConnect(this.operatorId, this.status?.calendarName || undefined)
      : this.service.startMyConnect())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (url) => {
          this.working = false;
          this.cdr.markForCheck();
          this.openConsent(url);
        },
        error: (err: any) => {
          this.working = false;
          this.cdr.markForCheck();
          this.snackBar.open(
            err?.graphQLErrors?.[0]?.message || 'Non è stato possibile avviare il rinnovo',
            'OK', { duration: 6000 },
          );
        },
      });
  }

  /**
   * Manda il link di rinnovo sul canale scelto.
   *
   * Serve a chi sta guardando la dashboard da un computer ma dovrà
   * autorizzare dal telefono, dove l'account Google è già connesso.
   */
  onSendLink(channel: 'whatsapp' | 'email'): void {
    const recipient = channel === 'email'
      ? this.status?.operatorEmail
      : this.status?.operatorPhone;
    if (!recipient) return;

    this.working = true;
    this.cdr.markForCheck();

    (this.operatorId
      ? this.service.sendRenewLink(this.operatorId, channel, recipient)
      : this.service.sendMyRenewLink(channel))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.working = false;
          this.cdr.markForCheck();
          this.snackBar.open(
            channel === 'email' ? 'Link inviato per email' : 'Link inviato su WhatsApp',
            'OK', { duration: 4000 },
          );
        },
        error: (err: any) => {
          this.working = false;
          this.cdr.markForCheck();
          this.snackBar.open(
            err?.graphQLErrors?.[0]?.message || 'Invio non riuscito',
            'OK', { duration: 6000 },
          );
        },
      });
  }

  onAlertToggle(payload: { channel: 'whatsapp' | 'email'; enabled: boolean }): void {
    this.working = true;
    this.cdr.markForCheck();

    (this.operatorId
      ? this.service.setAlertChannel(this.operatorId, payload.channel, payload.enabled)
      : this.service.setMyAlertChannel(payload.channel, payload.enabled))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.status = status;
          this.working = false;
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.working = false;
          this.cdr.markForCheck();
          this.snackBar.open(
            err?.graphQLErrors?.[0]?.message || 'Modifica non riuscita',
            'OK', { duration: 6000 },
          );
          // Il server non ha accettato: si ricarica invece di lasciare
          // l'interruttore su uno stato che non esiste da nessuna parte.
          this.load();
        },
      });
  }

  /**
   * Scollega il proprio calendario, dopo conferma.
   *
   * La conferma dice cosa succede al calendario su Google — che dipende da
   * un'impostazione dello studio — e ribadisce che gli appuntamenti nel
   * gestionale non si toccano: è la paura ragionevole di chi legge
   * "scollega", ed è meglio smentirla prima che dopo.
   */
  async onDisconnect(): Promise<void> {
    const sorte = this.keepCalendarOnDisconnect
      ? 'Il calendario resta nel tuo Google con gli appuntamenti già presenti, ma smette di aggiornarsi.'
      : 'Il calendario verrà rimosso dal tuo account Google.';

    const ok = await this.confirm({
      title: 'Scollegare il calendario Google?',
      message:
        `${sorte}\n\nI tuoi appuntamenti nel gestionale non vengono toccati: `
        + 'restano tutti, passati e futuri.\n\n'
        + 'Potrai ricollegarti quando vuoi da qui, senza chiedere niente a nessuno.',
      confirmText: 'Scollega',
      cancelText: 'Annulla',
      confirmColor: 'warn',
      icon: 'link_off',
    });
    if (!ok) return;

    this.working = true;
    this.cdr.markForCheck();

    (this.operatorId
      ? this.service.disconnect(this.operatorId)
      : this.service.disconnectMine())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.status = status;
          this.working = false;
          this.cdr.markForCheck();
          this.snackBar.open('Calendario scollegato', 'OK', { duration: 4000 });
        },
        error: (err: any) => {
          this.working = false;
          this.cdr.markForCheck();
          this.snackBar.open(
            err?.graphQLErrors?.[0]?.message || 'Scollegamento non riuscito',
            'OK', { duration: 6000 },
          );
        },
      });
  }

  private async confirm(data: ConfirmMatDialogData): Promise<boolean> {
    const ref = this.dialog.open(ConfirmMatDialogComponent, { width: '460px', data });
    const result = await new Promise<boolean | undefined>(resolve => {
      ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(r => resolve(r));
    });
    return !!result;
  }
}

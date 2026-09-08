/**
 * Operator Calendar Feed Container
 * Layer 2: Smart Component
 *
 * Coordina il pannello "Sincronizzazione agenda" della scheda operatore:
 * carica lo stato, genera/rigenera/revoca il link e gestisce le conferme.
 *
 * Tiene SOLO lo UI state; le chiamate passano da OperatorCalendarFeedService
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
  OperatorCalendarFeedPanelComponent,
} from '../components/operator-calendar-feed-panel/operator-calendar-feed-panel.component';
import { OperatorCalendarFeedService } from '../services/operator-calendar-feed.service';
import { OperatorCalendarFeedStatus } from '../models/operator-calendar-feed.model';
import {
  ConfirmMatDialogComponent, ConfirmMatDialogData,
} from '../../../shared/components/confirm-mat-dialog/confirm-mat-dialog.component';

@Component({
  selector: 'app-operator-calendar-feed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, OperatorCalendarFeedPanelComponent],
  template: `
    <app-operator-calendar-feed-panel
      [status]="status"
      [loading]="loading"
      [copied]="copied"
      [error]="error"
      (generate)="onGenerate()"
      (regenerate)="onRegenerate()"
      (revoke)="onRevoke()"
      (copy)="onCopy()"
      [operatorPhone]="operatorPhone"
      [operatorEmail]="operatorEmail"
      [sending]="sending"
      (sendLink)="onSendLink($event)">
    </app-operator-calendar-feed-panel>
  `,
})
export class OperatorCalendarFeedContainer implements OnInit, OnChanges, OnDestroy {
  /** Operatore di cui si gestisce il feed. Assente in creazione (non esiste ancora). */
  @Input() operatorId: string | null = null;
  /** Recapiti noti dell'operatore, per precompilare il campo di invio. */
  @Input() operatorPhone: string | null = null;
  @Input() operatorEmail: string | null = null;

  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);
  private feedService = inject(OperatorCalendarFeedService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  status: OperatorCalendarFeedStatus | null = null;
  loading = false;
  copied = false;
  error: string | null = null;
  sending = false;

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['operatorId'] && !changes['operatorId'].firstChange) this.load();
  }

  ngOnDestroy(): void {
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
    this.feedService.getStatus(this.operatorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => this.applyStatus(status),
        error: (err: any) => {
          this.status = null;
          this.loading = false;
          this.error = err?.graphQLErrors?.[0]?.message || err?.message || 'Errore imprevisto';
          this.cdr.markForCheck();
        },
      });
  }

  onGenerate(): void {
    if (!this.operatorId) return;
    this.runAction(this.feedService.generate(this.operatorId), 'Link generato');
  }

  /**
   * Rigenerare invalida il link precedente: chi lo aveva già sottoscritto
   * smette di ricevere aggiornamenti finché non reinserisce quello nuovo.
   * È una conseguenza che va detta prima, non scoperta dopo.
   */
  async onRegenerate(): Promise<void> {
    const ok = await this.confirm({
      title: 'Rigenerare il link?',
      message:
        'Il link attuale smetterà di funzionare.\n\n' +
        "Chi lo ha già sottoscritto sul telefono non riceverà più aggiornamenti " +
        'finché non inserisce il nuovo indirizzo.',
      confirmText: 'Rigenera',
      confirmColor: 'warn',
      icon: 'autorenew',
    });
    if (!ok || !this.operatorId) return;
    this.runAction(this.feedService.generate(this.operatorId), 'Nuovo link generato');
  }

  async onRevoke(): Promise<void> {
    const ok = await this.confirm({
      title: 'Revocare la sincronizzazione?',
      message:
        "Il link smetterà di rispondere e l'agenda sparirà dal calendario " +
        "dell'operatore.\n\nSi potrà sempre generare un link nuovo.",
      confirmText: 'Revoca',
      confirmColor: 'warn',
      icon: 'link_off',
    });
    if (!ok || !this.operatorId) return;
    this.runAction(this.feedService.revoke(this.operatorId), 'Sincronizzazione revocata');
  }

  /**
   * Manda all'operatore il link usa-e-getta per sottoscrivere l'agenda.
   *
   * Il messaggio non contiene l'indirizzo del feed: quello resta nostro e
   * arriva solo alla pagina di sottoscrizione, che il link apre una volta
   * sola. Così una conversazione WhatsApp o una casella di posta non
   * conservano per sempre una credenziale sull'agenda.
   */
  onSendLink(payload: { channel: 'whatsapp' | 'email'; recipient: string }): void {
    if (!this.operatorId) return;
    this.sending = true;
    this.cdr.markForCheck();
    this.feedService.sendLink(this.operatorId, payload.channel, payload.recipient)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.sending = false;
          this.cdr.markForCheck();
          this.snackBar.open(
            payload.channel === 'email'
              ? 'Link inviato per email'
              : 'Link inviato su WhatsApp',
            'OK', { duration: 4000 },
          );
        },
        error: (err: any) => {
          this.sending = false;
          this.cdr.markForCheck();
          this.snackBar.open(
            err?.graphQLErrors?.[0]?.message || 'Invio non riuscito',
            'OK', { duration: 6000 },
          );
        },
      });
  }

  onCopy(): void {
    const url = this.status?.feedUrl;
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () => {
        this.copied = true;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.copied = false;
          this.cdr.markForCheck();
        }, 2000);
      },
      () => this.snackBar.open('Copia non riuscita: seleziona il link a mano', 'OK', { duration: 4000 }),
    );
  }

  private runAction(
    action: import('rxjs').Observable<OperatorCalendarFeedStatus>,
    successMessage: string,
  ): void {
    this.loading = true;
    this.cdr.markForCheck();
    action.pipe(takeUntil(this.destroy$)).subscribe({
      next: (status) => {
        this.applyStatus(status);
        this.snackBar.open(successMessage, 'OK', { duration: 3000 });
      },
      error: (err: any) => {
        this.loading = false;
        this.cdr.markForCheck();
        this.snackBar.open(
          err?.graphQLErrors?.[0]?.message || 'Operazione non riuscita',
          'OK',
          { duration: 5000 },
        );
      },
    });
  }

  private applyStatus(status: OperatorCalendarFeedStatus): void {
    this.status = status;
    this.error = null;
    this.loading = false;
    this.cdr.markForCheck();
  }

  private async confirm(data: ConfirmMatDialogData): Promise<boolean> {
    const ref = this.dialog.open(ConfirmMatDialogComponent, { width: '480px', data });
    const result = await new Promise<boolean | undefined>(resolve => {
      ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(r => resolve(r));
    });
    return !!result;
  }
}

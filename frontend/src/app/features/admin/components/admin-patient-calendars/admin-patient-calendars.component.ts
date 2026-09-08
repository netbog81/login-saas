import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { Subject, takeUntil } from 'rxjs';

import { PatientCalendarFeedService } from '../../../patient-calendar-feed/services/patient-calendar-feed.service';
import {
  PatientCalendarFeedRow,
  PatientCalendarFeedState,
  FEED_STATE_LABELS,
  REVOKED_BY_LABELS,
  feedState,
} from '../../../patient-calendar-feed/models/patient-calendar-feed.model';

/**
 * Calendari dei pazienti: chi l'ha ricevuto, chi lo sta davvero usando, chi
 * l'ha revocato — e le due revoche in blocco.
 *
 * La colonna che conta è "Attivo": dice quanti pazienti hanno il calendario
 * NEL TELEFONO, che è un numero sempre più basso di quelli a cui è stato
 * mandato il link. Confondere i due porterebbe a credere che la funzione stia
 * funzionando quando invece le email finiscono nello spam.
 */
@Component({
  selector: 'app-admin-patient-calendars',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatChipsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cal-admin">
      <div class="header">
        <mat-icon class="header-icon">event_available</mat-icon>
        <div class="header-text">
          <h3>Calendari dei pazienti</h3>
          <p>
            Chi riceve i propri appuntamenti sul calendario del telefono.
            Il link parte una volta sola, insieme al recap della prenotazione.
          </p>
        </div>
        <button mat-icon-button (click)="reload()" [disabled]="loading" matTooltip="Ricarica">
          <mat-icon>refresh</mat-icon>
        </button>
      </div>

      @if (loading) {
        <div class="centered"><mat-spinner diameter="32"></mat-spinner></div>
      } @else if (error) {
        <p class="error-box">
          <mat-icon>error_outline</mat-icon>
          <span>{{ error }}</span>
        </p>
      } @else {
        <div class="counters">
          <div class="counter">
            <span class="value">{{ countBy('subscribed') }}</span>
            <span class="label">Attivi sul telefono</span>
          </div>
          <div class="counter">
            <span class="value">{{ countBy('sent') }}</span>
            <span class="label">Inviati, mai attivati</span>
          </div>
          <div class="counter">
            <span class="value">{{ countBy('revoked') }}</span>
            <span class="label">Revocati</span>
          </div>
        </div>

        <div class="bulk">
          <button mat-stroked-button [disabled]="working" (click)="revokeStale()">
            <mat-icon>auto_delete</mat-icon>
            Revoca chi non ha più appuntamenti
          </button>
          <button mat-stroked-button color="warn" [disabled]="working" (click)="revokeAll()">
            <mat-icon>block</mat-icon>
            Revoca tutti
          </button>
        </div>
        <p class="bulk-hint">
          La revoca spegne il link: il calendario del paziente smette di aggiornarsi.
          Gli appuntamenti non vengono toccati.
        </p>

        @if (rows.length === 0) {
          <p class="empty">Nessun paziente ha ancora ricevuto il link del calendario.</p>
        } @else {
          <table mat-table [dataSource]="rows" class="cal-table">
            <ng-container matColumnDef="patient">
              <th mat-header-cell *matHeaderCellDef>Paziente</th>
              <td mat-cell *matCellDef="let r">{{ r.patientName || r.patientId }}</td>
            </ng-container>

            <ng-container matColumnDef="state">
              <th mat-header-cell *matHeaderCellDef>Stato</th>
              <td mat-cell *matCellDef="let r">
                <span class="state" [class]="'state-' + stateOf(r)">{{ stateLabel(r) }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="sent">
              <th mat-header-cell *matHeaderCellDef>Inviato</th>
              <td mat-cell *matCellDef="let r">
                @if (r.emailSentAt) {
                  <div>{{ r.emailSentAt | date: 'dd/MM/yyyy HH:mm' }}</div>
                  <div class="sub">{{ r.emailSentTo }}</div>
                } @else { — }
              </td>
            </ng-container>

            <ng-container matColumnDef="subscribed">
              <th mat-header-cell *matHeaderCellDef>Sottoscritto</th>
              <td mat-cell *matCellDef="let r">
                @if (r.subscribedAt) {
                  <div>{{ r.subscribedAt | date: 'dd/MM/yyyy HH:mm' }}</div>
                  @if (r.lastAccessAt) {
                    <div class="sub">ultimo: {{ r.lastAccessAt | date: 'dd/MM HH:mm' }}</div>
                  }
                } @else { — }
              </td>
            </ng-container>

            <ng-container matColumnDef="revoked">
              <th mat-header-cell *matHeaderCellDef>Revocato</th>
              <td mat-cell *matCellDef="let r">
                @if (r.revokedAt) {
                  <div>{{ r.revokedAt | date: 'dd/MM/yyyy HH:mm' }}</div>
                  <div class="sub">{{ revokedBy(r) }}</div>
                } @else { — }
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let r" class="row-actions">
                <button mat-icon-button [disabled]="working"
                        [matTooltip]="r.emailSentAt ? 'Rimanda il link' : 'Invia il link'"
                        (click)="resend(r)">
                  <mat-icon>{{ r.emailSentAt ? 'forward_to_inbox' : 'send' }}</mat-icon>
                </button>
                @if (r.active) {
                  <button mat-icon-button color="warn" [disabled]="working"
                          matTooltip="Revoca" (click)="revokeOne(r)">
                    <mat-icon>block</mat-icon>
                  </button>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        }
      }
    </div>
  `,
  styles: [`
    .cal-admin { padding: 8px 0; }
    .header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
    .header-icon { color: #1976d2; }
    .header-text { flex: 1; }
    .header-text h3 { margin: 0 0 4px; font-size: 1.05rem; }
    .header-text p { margin: 0; font-size: 0.85rem; color: #64748b; line-height: 1.45; }
    .centered { display: flex; justify-content: center; padding: 32px; }
    .error-box { display: flex; gap: 8px; align-items: center; color: #92400e;
                 background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px;
                 padding: 10px 12px; font-size: 0.86rem; }
    .counters { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .counter { flex: 1; min-width: 140px; background: #f8fafc; border: 1px solid #e2e8f0;
               border-radius: 8px; padding: 12px; display: flex; flex-direction: column; }
    .counter .value { font-size: 1.5rem; font-weight: 600; }
    .counter .label { font-size: 0.78rem; color: #64748b; }
    .bulk { display: flex; gap: 8px; flex-wrap: wrap; }
    .bulk-hint { font-size: 0.78rem; color: #64748b; margin: 8px 0 18px; }
    .empty { font-size: 0.88rem; color: #64748b; }
    .cal-table { width: 100%; }
    .sub { font-size: 0.75rem; color: #94a3b8; }
    .state { font-size: 0.78rem; padding: 3px 8px; border-radius: 10px; white-space: nowrap; }
    .state-subscribed { background: #dcfce7; color: #166534; }
    .state-sent { background: #fef3c7; color: #92400e; }
    .state-revoked { background: #f1f5f9; color: #64748b; }
    .state-none { background: #f1f5f9; color: #64748b; }
    .row-actions { white-space: nowrap; text-align: right; }
  `],
})
export class AdminPatientCalendarsComponent implements OnInit, OnDestroy {
  private readonly feedService = inject(PatientCalendarFeedService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly columns = ['patient', 'state', 'sent', 'subscribed', 'revoked', 'actions'];

  rows: PatientCalendarFeedRow[] = [];
  loading = false;
  working = false;
  error: string | null = null;

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.feedService.listAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rows) => {
          this.rows = rows;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.graphQLErrors?.[0]?.message || 'Elenco non disponibile';
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Revoca solo chi non ha più appuntamenti futuri: è la pulizia periodica,
   * quella che si può fare senza pensarci troppo.
   */
  revokeStale(): void {
    this.runBulk(
      () => this.feedService.revokeStale(),
      (n) => `Revocate ${n} sottoscrizioni senza appuntamenti futuri`,
    );
  }

  /**
   * Revoca tutto. Chiede conferma perché è irreversibile: i token spariscono,
   * e chi vuole tornare indietro deve ricevere un link nuovo.
   */
  revokeAll(): void {
    const active = this.countBy('subscribed') + this.countBy('sent');
    if (active === 0) {
      this.snackBar.open('Non c\'è nessuna sottoscrizione attiva', 'OK', { duration: 3000 });
      return;
    }
    const ok = confirm(
      `Revocare tutte le ${active} sottoscrizioni attive?\n\n`
      + 'I calendari dei pazienti smetteranno di aggiornarsi. '
      + 'Per riattivarli servirà rimandare il link a ciascuno.',
    );
    if (!ok) return;

    this.runBulk(
      () => this.feedService.revokeAll(),
      (n) => `Revocate ${n} sottoscrizioni`,
    );
  }

  /**
   * Rimanda il link a un singolo paziente.
   *
   * Chiede conferma solo per chi si era tolto da solo: rimandare il link a chi
   * ha premuto "annulla iscrizione" è una decisione, non un gesto di routine.
   */
  resend(row: PatientCalendarFeedRow): void {
    if (this.working) return;

    if (row.revokedBy === 'patient') {
      const ok = confirm(
        `${row.patientName || 'Questo paziente'} si era tolto da solo dal link in fondo `
        + "all'email.\n\nRimandarglielo comunque?",
      );
      if (!ok) return;
    }

    this.working = true;
    this.cdr.markForCheck();

    this.feedService.sendLink(row.patientId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.working = false;
          this.snackBar.open('Link inviato', 'OK', { duration: 3000 });
          this.reload();
        },
        error: (err) => {
          this.working = false;
          // Il backend dice PERCHÉ non è partito (manca l'email in anagrafica,
          // manca l'SMTP): mostrarlo è la differenza fra sapere cosa fare e no.
          const msg = err?.graphQLErrors?.[0]?.message || "Errore nell'invio";
          this.snackBar.open(msg, 'OK', { duration: 6000 });
          this.cdr.markForCheck();
        },
      });
  }

  revokeOne(row: PatientCalendarFeedRow): void {
    if (this.working) return;
    this.working = true;
    this.cdr.markForCheck();

    this.feedService.revoke(row.patientId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.working = false;
          this.snackBar.open('Sottoscrizione revocata', 'OK', { duration: 3000 });
          this.reload();
        },
        error: (err) => {
          this.working = false;
          const msg = err?.graphQLErrors?.[0]?.message || 'Revoca non riuscita';
          this.snackBar.open(msg, 'OK', { duration: 5000 });
          this.cdr.markForCheck();
        },
      });
  }

  private runBulk(
    action: () => import('rxjs').Observable<number>,
    message: (n: number) => string,
  ): void {
    this.working = true;
    this.cdr.markForCheck();

    action()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (n) => {
          this.working = false;
          this.snackBar.open(message(n), 'OK', { duration: 4000 });
          this.reload();
        },
        error: (err) => {
          this.working = false;
          const msg = err?.graphQLErrors?.[0]?.message || 'Revoca non riuscita';
          this.snackBar.open(msg, 'OK', { duration: 5000 });
          this.cdr.markForCheck();
        },
      });
  }

  stateOf(row: PatientCalendarFeedRow): PatientCalendarFeedState {
    return feedState(row);
  }

  stateLabel(row: PatientCalendarFeedRow): string {
    return FEED_STATE_LABELS[this.stateOf(row)];
  }

  revokedBy(row: PatientCalendarFeedRow): string {
    return row.revokedBy ? REVOKED_BY_LABELS[row.revokedBy] : '';
  }

  countBy(state: PatientCalendarFeedState): number {
    return this.rows.filter((r) => this.stateOf(r) === state).length;
  }
}

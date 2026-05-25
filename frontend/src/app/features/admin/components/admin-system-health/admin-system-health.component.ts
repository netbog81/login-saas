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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, interval } from 'rxjs';
import { startWith, switchMap, takeUntil, tap } from 'rxjs/operators';

import { DlqMonitorClientService, DlqStatus } from './dlq-monitor.service';

/**
 * Sessione 7 — Widget admin "Stato sistema messaggistica".
 *
 * Mostra healthy/non-healthy aggregato delle DLQ accounting↔clinico.
 * Polling lento (30s) — è un health check, non un real-time stream.
 * Click su refresh manuale ricarica subito.
 */
@Component({
  selector: 'app-admin-system-health',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="health-widget">
      <div class="header">
        <mat-icon class="header-icon">monitor_heart</mat-icon>
        <h3>Stato sistema messaggistica</h3>
        <button mat-icon-button (click)="reload()" [disabled]="loading"
                matTooltip="Aggiorna ora">
          <mat-icon>refresh</mat-icon>
        </button>
      </div>

      <div *ngIf="loading && !status" class="loading">
        <mat-spinner diameter="32"></mat-spinner>
        <span>Lettura stato in corso…</span>
      </div>

      <div *ngIf="error" class="error">
        <mat-icon>error_outline</mat-icon>
        <span>Errore lettura stato: {{ error }}</span>
      </div>

      <div *ngIf="status && !error" class="content">
        <div class="status-banner"
             [class.healthy]="status.healthy"
             [class.unhealthy]="!status.healthy">
          <mat-icon>{{ status.healthy ? 'check_circle' : 'warning' }}</mat-icon>
          <div class="status-text">
            <strong>{{ status.healthy ? 'Sistema sano' : 'Problemi rilevati' }}</strong>
            <span class="muted">
              {{ status.totalMessages }} messaggi in DLQ totali
              · letto alle {{ status.checkedAt | date:'HH:mm:ss' }}
            </span>
          </div>
        </div>

        <table class="queues-table">
          <thead>
            <tr>
              <th>Coda DLQ</th>
              <th>Messaggi pendenti</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let q of status.queues"
                [class.row-warning]="q.reachable && q.messageCount > 0"
                [class.row-error]="!q.reachable">
              <td class="queue-name">{{ q.name }}</td>
              <td>{{ q.reachable ? q.messageCount : '—' }}</td>
              <td>
                <span *ngIf="q.reachable && q.messageCount === 0" class="badge badge-ok">OK</span>
                <span *ngIf="q.reachable && q.messageCount > 0" class="badge badge-warn">
                  {{ q.messageCount }} pending
                </span>
                <span *ngIf="!q.reachable" class="badge badge-error"
                      [title]="q.errorMessage || ''">
                  Non raggiungibile
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <p class="hint" *ngIf="!status.healthy">
          Messaggi nelle DLQ indicano fallimenti del consumer accounting o clinico
          (es. incident post-rotation OpenBao, registry 401, DB irraggiungibile).
          Verifica i log dei backend e consulta RabbitMQ Management UI per maggiori
          dettagli sui messaggi non processati.
        </p>
      </div>
    </div>
  `,
  styles: [`
    .health-widget {
      background: #fff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      h3 { margin: 0; flex: 1; font-size: 1.1em; color: #333; }
    }
    .header-icon { color: #1976d2; }
    .loading, .error {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      color: #666;
    }
    .error {
      color: #c62828;
      background: #ffebee;
      border-radius: 4px;
    }
    .status-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 16px;
      &.healthy { background: #e8f5e9; color: #2a7e2a; }
      &.unhealthy { background: #ffebee; color: #c62828; }
      mat-icon { font-size: 28px; width: 28px; height: 28px; }
      .status-text {
        display: flex;
        flex-direction: column;
        .muted { font-size: 0.85em; opacity: 0.8; }
      }
    }
    .queues-table {
      width: 100%;
      border-collapse: collapse;
      th, td {
        text-align: left;
        padding: 8px 12px;
        border-bottom: 1px solid #eee;
        font-size: 0.95em;
      }
      th { color: #555; font-weight: 600; }
      .queue-name { font-family: monospace; font-size: 0.9em; }
      tr.row-warning { background: #fff8e1; }
      tr.row-error { background: #ffebee; }
    }
    .badge {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 600;
      &.badge-ok { background: #e8f5e9; color: #2a7e2a; }
      &.badge-warn { background: #fff3cd; color: #856404; }
      &.badge-error { background: #ffebee; color: #c62828; }
    }
    .hint { color: #666; font-size: 0.9em; margin-top: 16px; line-height: 1.5; }
  `],
})
export class AdminSystemHealthComponent implements OnInit, OnDestroy {
  private dlqService = inject(DlqMonitorClientService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private static readonly POLL_MS = 30_000;

  status: DlqStatus | null = null;
  loading = false;
  error: string | null = null;

  ngOnInit(): void {
    // Polling ogni 30s + manuale via bottone.
    interval(AdminSystemHealthComponent.POLL_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.fetchStatus()),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  reload(): void {
    this.fetchStatus().subscribe();
  }

  private fetchStatus() {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    return this.dlqService.getStatus().pipe(
      tap({
        next: (s) => {
          this.status = s;
          this.loading = false;
          this.error = null;
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.error = (e as Error)?.message ?? 'errore sconosciuto';
          this.loading = false;
          this.cdr.markForCheck();
        },
      }),
    );
  }
}

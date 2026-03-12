import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SelectionModel } from '@angular/cdk/collections';
import { Subject, takeUntil } from 'rxjs';
import { WhatsappService } from '../services/whatsapp.service';
import {
  WhatsappMessageLog,
  WhatsappRetentionStats,
  MESSAGE_STATUS_LABELS,
  MESSAGE_TYPE_LABELS,
} from '../models/whatsapp.models';
import { LogActionConfirmDialogComponent } from '../components/log-action-confirm-dialog/log-action-confirm-dialog.component';

@Component({
  selector: 'app-whatsapp-log-management',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatCardModule,
    MatTableModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Retention Stats -->
    <mat-card class="stats-card">
      <mat-card-header>
        <mat-card-title>
          <mat-icon class="header-icon">analytics</mat-icon>
          Statistiche Conservazione
        </mat-card-title>
      </mat-card-header>
      <mat-card-content>
        @if (loadingStats) {
          <div class="loading-center">
            <mat-spinner diameter="32"></mat-spinner>
          </div>
        } @else if (stats) {
          <div class="stats-grid">
            <div class="stat-item">
              <mat-icon>list_alt</mat-icon>
              <div class="stat-value">{{ stats.totalLogs }}</div>
              <div class="stat-label">Log totali</div>
            </div>
            <div class="stat-item warn">
              <mat-icon>schedule</mat-icon>
              <div class="stat-value">{{ stats.expiredLogs }}</div>
              <div class="stat-label">Log scaduti</div>
            </div>
            <div class="stat-item info">
              <mat-icon>visibility_off</mat-icon>
              <div class="stat-value">{{ stats.anonymizedLogs }}</div>
              <div class="stat-label">Anonimizzati</div>
            </div>
            <div class="stat-item">
              <mat-icon>event</mat-icon>
              <div class="stat-value">{{ stats.retentionDays }} giorni</div>
              <div class="stat-label">Policy conservazione</div>
            </div>
          </div>
        }
      </mat-card-content>
    </mat-card>

    <!-- Expired Logs Table -->
    <mat-card class="table-card">
      <mat-card-header>
        <mat-card-title>
          <mat-icon class="header-icon">warning</mat-icon>
          Log Scaduti
        </mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <!-- Action Bar -->
        <div class="action-bar">
          <button mat-stroked-button
                  [disabled]="selection.isEmpty() || operating"
                  (click)="onAnonymizeSelected()">
            <mat-icon>visibility_off</mat-icon>
            Anonimizza selezionati ({{ selection.selected.length }})
          </button>
          <button mat-stroked-button color="warn"
                  [disabled]="selection.isEmpty() || operating"
                  (click)="onDeleteSelected()">
            <mat-icon>delete</mat-icon>
            Elimina selezionati ({{ selection.selected.length }})
          </button>
          <span class="spacer"></span>
          <button mat-stroked-button
                  [disabled]="!stats || stats.expiredLogs === 0 || operating"
                  (click)="onAnonymizeAllExpired()">
            <mat-icon>visibility_off</mat-icon>
            Anonimizza tutti scaduti
          </button>
          <button mat-stroked-button color="warn"
                  [disabled]="!stats || stats.expiredLogs === 0 || operating"
                  (click)="onDeleteAllExpired()">
            <mat-icon>delete_sweep</mat-icon>
            Elimina tutti scaduti
          </button>
        </div>

        @if (operating) {
          <div class="loading-center">
            <mat-spinner diameter="24"></mat-spinner>
            <span>Operazione in corso...</span>
          </div>
        }

        @if (loadingLogs) {
          <div class="loading-center">
            <mat-spinner diameter="32"></mat-spinner>
          </div>
        } @else {
          <div class="table-responsive">
            <table mat-table [dataSource]="expiredLogs" class="log-table">
              <!-- Checkbox Column -->
              <ng-container matColumnDef="select">
                <th mat-header-cell *matHeaderCellDef>
                  <mat-checkbox
                    (change)="$event ? toggleAllRows() : null"
                    [checked]="selection.hasValue() && isAllSelected()"
                    [indeterminate]="selection.hasValue() && !isAllSelected()">
                  </mat-checkbox>
                </th>
                <td mat-cell *matCellDef="let row">
                  <mat-checkbox
                    (click)="$event.stopPropagation()"
                    (change)="$event ? selection.toggle(row) : null"
                    [checked]="selection.isSelected(row)"
                    [disabled]="row.isAnonymized">
                  </mat-checkbox>
                </td>
              </ng-container>

              <!-- Created At Column -->
              <ng-container matColumnDef="createdAt">
                <th mat-header-cell *matHeaderCellDef>Data</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.createdAt | date:'dd/MM/yyyy HH:mm' }}
                </td>
              </ng-container>

              <!-- Patient Name Column -->
              <ng-container matColumnDef="patientName">
                <th mat-header-cell *matHeaderCellDef>Paziente</th>
                <td mat-cell *matCellDef="let row"
                    [class.anonymized-text]="row.isAnonymized">
                  {{ row.patientName || '-' }}
                </td>
              </ng-container>

              <!-- Phone Column -->
              <ng-container matColumnDef="phoneNumber">
                <th mat-header-cell *matHeaderCellDef>Telefono</th>
                <td mat-cell *matCellDef="let row"
                    [class.anonymized-text]="row.isAnonymized">
                  {{ row.phoneNumber }}
                </td>
              </ng-container>

              <!-- Message Type Column -->
              <ng-container matColumnDef="messageType">
                <th mat-header-cell *matHeaderCellDef>Tipo</th>
                <td mat-cell *matCellDef="let row">
                  {{ getMessageTypeLabel(row.messageType) }}
                </td>
              </ng-container>

              <!-- Status Column -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Stato</th>
                <td mat-cell *matCellDef="let row">
                  {{ getStatusLabel(row.status) }}
                </td>
              </ng-container>

              <!-- Anonymized Column -->
              <ng-container matColumnDef="isAnonymized">
                <th mat-header-cell *matHeaderCellDef>Anonimizzato</th>
                <td mat-cell *matCellDef="let row">
                  @if (row.isAnonymized) {
                    <mat-icon class="anon-icon"
                              [matTooltip]="'Anonimizzato il ' + (row.anonymizedAt | date:'dd/MM/yyyy HH:mm')">
                      visibility_off
                    </mat-icon>
                  }
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                  [class.anonymized-row]="row.isAnonymized"></tr>
            </table>
          </div>

          @if (expiredLogs.length === 0) {
            <div class="empty-state">
              <mat-icon>check_circle</mat-icon>
              <p>Nessun log scaduto trovato</p>
            </div>
          }

          <mat-paginator
            [length]="totalExpired"
            [pageSize]="pageSize"
            [pageIndex]="page - 1"
            [pageSizeOptions]="[25, 50, 100]"
            (page)="onPageChange($event)"
            showFirstLastButtons>
          </mat-paginator>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .header-icon {
      vertical-align: middle;
      margin-right: 8px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      padding: 16px 0;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
      border-radius: 8px;
      background: rgba(0,0,0,0.03);
    }

    .stat-item mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      margin-bottom: 8px;
      color: #666;
    }

    .stat-item.warn mat-icon { color: #e65100; }
    .stat-item.info mat-icon { color: #1565c0; }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
    }

    .stat-label {
      font-size: 13px;
      color: #666;
      margin-top: 4px;
    }

    .action-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }

    .spacer { flex: 1; }

    .table-responsive {
      overflow-x: auto;
    }

    .log-table {
      width: 100%;
    }

    .anonymized-row {
      opacity: 0.6;
    }

    .anonymized-text {
      text-decoration: line-through;
      color: #999;
    }

    .anon-icon {
      color: #1565c0;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .loading-center {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 24px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px;
      color: #666;
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #4caf50;
      margin-bottom: 8px;
    }

    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .action-bar {
        flex-direction: column;
        align-items: stretch;
      }

      .spacer { display: none; }
    }
  `],
})
export class WhatsappLogManagementContainer implements OnInit, OnDestroy {
  stats: WhatsappRetentionStats | null = null;
  expiredLogs: WhatsappMessageLog[] = [];
  totalExpired = 0;
  page = 1;
  pageSize = 50;

  loadingStats = false;
  loadingLogs = false;
  operating = false;

  selection = new SelectionModel<WhatsappMessageLog>(true, []);
  displayedColumns = ['select', 'createdAt', 'patientName', 'phoneNumber', 'messageType', 'status', 'isAnonymized'];

  private destroy$ = new Subject<void>();

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.loadStats();
    this.loadExpiredLogs();
  }

  private loadStats(): void {
    this.loadingStats = true;
    this.cdr.markForCheck();

    this.ngZone.run(() => {
      this.whatsappService.getRetentionStats()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (stats) => {
            this.stats = stats;
            this.loadingStats = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.loadingStats = false;
            this.cdr.markForCheck();
          },
        });
    });
  }

  private loadExpiredLogs(): void {
    this.loadingLogs = true;
    this.selection.clear();
    this.cdr.markForCheck();

    this.ngZone.run(() => {
      this.whatsappService.getExpiredLogs(this.page, this.pageSize)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            this.expiredLogs = result.items;
            this.totalExpired = result.total;
            this.loadingLogs = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.loadingLogs = false;
            this.cdr.markForCheck();
          },
        });
    });
  }

  isAllSelected(): boolean {
    return this.selection.selected.length === this.expiredLogs.filter(l => !l.isAnonymized).length;
  }

  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.expiredLogs.filter(l => !l.isAnonymized).forEach(row => this.selection.select(row));
    }
  }

  onPageChange(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadExpiredLogs();
  }

  getStatusLabel(status: string): string {
    return MESSAGE_STATUS_LABELS[status as keyof typeof MESSAGE_STATUS_LABELS] || status;
  }

  getMessageTypeLabel(type: string): string {
    return MESSAGE_TYPE_LABELS[type as keyof typeof MESSAGE_TYPE_LABELS] || type;
  }

  onAnonymizeSelected(): void {
    const count = this.selection.selected.length;
    this.confirmAction('anonymize', count, false, () => {
      const logIds = this.selection.selected.map(l => l.id);
      this.operating = true;
      this.cdr.markForCheck();

      this.ngZone.run(() => {
        this.whatsappService.anonymizeLogs(logIds)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (result) => {
              this.operating = false;
              this.snackBar.open(result.message || `${result.affectedCount} log anonimizzati`, 'OK', { duration: 3000 });
              this.loadData();
            },
            error: (err) => {
              this.operating = false;
              this.snackBar.open('Errore durante l\'anonimizzazione', 'OK', { duration: 3000 });
              this.cdr.markForCheck();
            },
          });
      });
    });
  }

  onDeleteSelected(): void {
    const count = this.selection.selected.length;
    this.confirmAction('delete', count, false, () => {
      const logIds = this.selection.selected.map(l => l.id);
      this.operating = true;
      this.cdr.markForCheck();

      this.ngZone.run(() => {
        this.whatsappService.deleteLogs(logIds)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (result) => {
              this.operating = false;
              this.snackBar.open(result.message || `${result.affectedCount} log eliminati`, 'OK', { duration: 3000 });
              this.loadData();
            },
            error: () => {
              this.operating = false;
              this.snackBar.open('Errore durante l\'eliminazione', 'OK', { duration: 3000 });
              this.cdr.markForCheck();
            },
          });
      });
    });
  }

  onAnonymizeAllExpired(): void {
    const count = this.stats?.expiredLogs || 0;
    this.confirmAction('anonymize', count, true, () => {
      this.operating = true;
      this.cdr.markForCheck();

      this.ngZone.run(() => {
        this.whatsappService.anonymizeExpiredLogs()
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (result) => {
              this.operating = false;
              this.snackBar.open(result.message || `${result.affectedCount} log anonimizzati`, 'OK', { duration: 3000 });
              this.loadData();
            },
            error: () => {
              this.operating = false;
              this.snackBar.open('Errore durante l\'anonimizzazione', 'OK', { duration: 3000 });
              this.cdr.markForCheck();
            },
          });
      });
    });
  }

  onDeleteAllExpired(): void {
    const count = this.stats?.expiredLogs || 0;
    this.confirmAction('delete', count, true, () => {
      this.operating = true;
      this.cdr.markForCheck();

      this.ngZone.run(() => {
        this.whatsappService.deleteExpiredLogs()
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (result) => {
              this.operating = false;
              this.snackBar.open(result.message || `${result.affectedCount} log eliminati`, 'OK', { duration: 3000 });
              this.loadData();
            },
            error: () => {
              this.operating = false;
              this.snackBar.open('Errore durante l\'eliminazione', 'OK', { duration: 3000 });
              this.cdr.markForCheck();
            },
          });
      });
    });
  }

  private confirmAction(action: 'anonymize' | 'delete', count: number, isAll: boolean, onConfirm: () => void): void {
    const dialogRef = this.dialog.open(LogActionConfirmDialogComponent, {
      data: { action, count, isAll },
      width: '400px',
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(confirmed => {
      if (confirmed) onConfirm();
    });
  }
}

import { Component, OnInit, OnDestroy, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';

import { AbsenceManagementService } from '../services/absence-management.service';
import { OperatorAbsence } from '../models/absence.model';
import { AbsenceDialogContainerComponent } from './absence-dialog.container';
import { OperatorService } from '../../../../services/operator.service';
import { Operator, OperatorMacroCategory } from '../../../../graphql/generated/types';

/**
 * Pagina "Gestione assenze" (menu principale, accanto a Statistiche).
 *
 * Lista le assenze di operatori e medici (AvailabilityException) con filtri
 * per operatore e periodo; permette la cancellazione singola o dell'intero
 * gruppo (assenze create in blocco: range dal…al / multi-operatore).
 * La cancellazione ripristina automaticamente i conflitti generati.
 */
@Component({
  selector: 'app-absence-management-container',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTableModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>
          <mat-icon>event_busy</mat-icon>
          Gestione assenze
        </h1>
        <button mat-flat-button color="primary" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon>
          Nuova assenza
        </button>
      </div>

      <p class="page-hint">
        Assenze di operatori e medici. Gli appuntamenti impattati vengono
        marcati come conflitti e si gestiscono dalla pagina
        <strong>Conflitti</strong> (spostamento su altro operatore/orario).
        Per gli istruttori palestra usare le eccezioni in
        <strong>Configurazioni palestra</strong> (con sostituto).
      </p>

      <!-- Filtri -->
      <div class="filters">
        <mat-form-field appearance="outline">
          <mat-label>Operatore</mat-label>
          <mat-select [(ngModel)]="filterOperatorId" (selectionChange)="load()">
            <mat-option [value]="null">Tutti</mat-option>
            <mat-option *ngFor="let op of operators" [value]="op.id">
              {{ op.name }} {{ op.surname }}
            </mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Dal</mat-label>
          <input matInput [matDatepicker]="pFrom" [(ngModel)]="filterFrom" (ngModelChange)="load()" />
          <mat-datepicker-toggle matSuffix [for]="pFrom"></mat-datepicker-toggle>
          <mat-datepicker #pFrom></mat-datepicker>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Al</mat-label>
          <input matInput [matDatepicker]="pTo" [(ngModel)]="filterTo" (ngModelChange)="load()" />
          <mat-datepicker-toggle matSuffix [for]="pTo"></mat-datepicker-toggle>
          <mat-datepicker #pTo></mat-datepicker>
        </mat-form-field>
      </div>

      <div *ngIf="loading" class="loading-inline">
        <mat-spinner diameter="24"></mat-spinner>
        Caricamento assenze...
      </div>

      <p *ngIf="!loading && absences.length === 0" class="empty-hint">
        Nessuna assenza nel periodo selezionato.
      </p>

      <table
        mat-table
        [dataSource]="absences"
        class="mat-elevation-z1 absence-table"
        *ngIf="!loading && absences.length > 0"
      >
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Data</th>
          <td mat-cell *matCellDef="let a">{{ formatDate(a.exceptionDate) }}</td>
        </ng-container>

        <ng-container matColumnDef="operator">
          <th mat-header-cell *matHeaderCellDef>Operatore</th>
          <td mat-cell *matCellDef="let a">
            {{ a.operator?.name }} {{ a.operator?.surname }}
          </td>
        </ng-container>

        <ng-container matColumnDef="window">
          <th mat-header-cell *matHeaderCellDef>Fascia</th>
          <td mat-cell *matCellDef="let a">
            <ng-container *ngIf="a.startTime && a.endTime">
              {{ shortTime(a.startTime) }}–{{ shortTime(a.endTime) }}
            </ng-container>
            <ng-container *ngIf="!a.startTime || !a.endTime">Giornata intera</ng-container>
          </td>
        </ng-container>

        <ng-container matColumnDef="type">
          <th mat-header-cell *matHeaderCellDef>Tipo</th>
          <td mat-cell *matCellDef="let a">
            {{ a.absenceTypeSnapshot?.name || typeLabel(a.exceptionType) }}
          </td>
        </ng-container>

        <ng-container matColumnDef="reason">
          <th mat-header-cell *matHeaderCellDef>Motivo</th>
          <td mat-cell *matCellDef="let a">{{ a.reason || '—' }}</td>
        </ng-container>

        <ng-container matColumnDef="group">
          <th mat-header-cell *matHeaderCellDef>Gruppo</th>
          <td mat-cell *matCellDef="let a">
            <mat-icon
              *ngIf="a.sourceGroupId"
              class="group-icon"
              [matTooltip]="'Creata in blocco (' + groupSize(a.sourceGroupId) + ' voci)'"
            >link</mat-icon>
          </td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef class="actions-col">Azioni</th>
          <td mat-cell *matCellDef="let a" class="actions-col">
            <button
              mat-icon-button
              color="warn"
              matTooltip="Elimina questa assenza (ripristina i conflitti)"
              (click)="deleteOne(a)"
            >
              <mat-icon>delete</mat-icon>
            </button>
            <button
              *ngIf="a.sourceGroupId && groupSize(a.sourceGroupId) > 1"
              mat-icon-button
              color="warn"
              matTooltip="Elimina TUTTO il gruppo ({{ groupSize(a.sourceGroupId) }} voci)"
              (click)="deleteGroup(a.sourceGroupId)"
            >
              <mat-icon>delete_sweep</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
    </div>
  `,
  styles: [
    `
      .page {
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .page-header h1 {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0;
        font-size: 24px;
      }
      .page-hint {
        color: rgba(0, 0, 0, 0.6);
        margin: 0 0 16px;
        font-size: 13px;
      }
      .filters {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }
      .filters mat-form-field {
        min-width: 200px;
      }
      .loading-inline {
        display: flex;
        align-items: center;
        gap: 10px;
        color: rgba(0, 0, 0, 0.54);
        padding: 16px 0;
      }
      .empty-hint {
        padding: 24px;
        background: #fafafa;
        border-radius: 4px;
        color: rgba(0, 0, 0, 0.54);
      }
      .absence-table {
        width: 100%;
      }
      .actions-col {
        width: 120px;
        text-align: right;
      }
      .group-icon {
        color: #607d8b;
        font-size: 20px;
      }
    `,
  ],
})
export class AbsenceManagementContainerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private absenceService = inject(AbsenceManagementService);
  private operatorService = inject(OperatorService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private ngZone = inject(NgZone);

  columns = ['date', 'operator', 'window', 'type', 'reason', 'group', 'actions'];

  operators: Operator[] = [];
  absences: OperatorAbsence[] = [];
  loading = false;

  filterOperatorId: string | null = null;
  filterFrom: Date = new Date();
  filterTo: Date = this.addDays(new Date(), 90);

  private groupCounts = new Map<string, number>();

  ngOnInit(): void {
    this.operatorService
      .getOperators(undefined, undefined, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ops) =>
          this.ngZone.run(() => {
            this.operators = (ops || []).filter(
              (o) => o.macroCategory !== OperatorMacroCategory.GymInstructor,
            );
          }),
        error: (err) => console.error('Errore caricamento operatori:', err),
      });
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    if (!this.filterFrom || !this.filterTo) return;
    this.loading = true;
    this.absenceService
      .list({
        operatorId: this.filterOperatorId || undefined,
        startDate: this.toIso(this.filterFrom),
        endDate: this.toIso(this.filterTo),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (absences) =>
          this.ngZone.run(() => {
            // Nasconde le eccezioni degli istruttori palestra (hanno la
            // loro gestione in Configurazioni palestra).
            this.absences = absences.filter(
              (a) => a.operator?.macroCategory !== OperatorMacroCategory.GymInstructor,
            );
            this.groupCounts.clear();
            for (const a of this.absences) {
              if (a.sourceGroupId) {
                this.groupCounts.set(
                  a.sourceGroupId,
                  (this.groupCounts.get(a.sourceGroupId) || 0) + 1,
                );
              }
            }
            this.loading = false;
          }),
        error: (err) =>
          this.ngZone.run(() => {
            console.error('Errore caricamento assenze:', err);
            this.loading = false;
            this.snackBar.open('Errore nel caricamento delle assenze', 'Chiudi', {
              duration: 4000,
            });
          }),
      });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(AbsenceDialogContainerComponent, {
      width: '760px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      disableClose: true,
    });
    ref.afterClosed().subscribe((created) => {
      if (created) {
        this.snackBar.open('Assenza creata. Eventuali conflitti sono nella pagina Conflitti.', 'Chiudi', {
          duration: 5000,
        });
        this.load();
      }
    });
  }

  deleteOne(absence: OperatorAbsence): void {
    const who = `${absence.operator?.name ?? ''} ${absence.operator?.surname ?? ''}`.trim();
    if (!confirm(`Eliminare l'assenza di ${who} del ${this.formatDate(absence.exceptionDate)}?\nI conflitti generati verranno ripristinati.`)) {
      return;
    }
    this.absenceService
      .deleteAbsence(absence.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.ngZone.run(() => this.load()),
        error: () =>
          this.ngZone.run(() =>
            this.snackBar.open('Errore nella cancellazione', 'Chiudi', { duration: 4000 }),
          ),
      });
  }

  deleteGroup(sourceGroupId: string): void {
    const count = this.groupSize(sourceGroupId);
    if (!confirm(`Eliminare TUTTO il gruppo di assenze (${count} voci)?\nI conflitti generati verranno ripristinati.`)) {
      return;
    }
    this.absenceService
      .deleteAbsenceGroup(sourceGroupId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (deleted) =>
          this.ngZone.run(() => {
            this.snackBar.open(`Eliminate ${deleted} assenze`, 'Chiudi', { duration: 4000 });
            this.load();
          }),
        error: () =>
          this.ngZone.run(() =>
            this.snackBar.open('Errore nella cancellazione del gruppo', 'Chiudi', {
              duration: 4000,
            }),
          ),
      });
  }

  groupSize(sourceGroupId: string): number {
    return this.groupCounts.get(sourceGroupId) || 0;
  }

  typeLabel(type: string): string {
    const labels: Record<string, string> = {
      SICK: 'Malattia',
      VACATION: 'Ferie',
      HOLIDAY: 'Festività',
      PERSONAL_LEAVE: 'Permesso',
      UNAVAILABLE: 'Non disponibile',
      MODIFIED: 'Orario modificato',
    };
    return labels[type] || type;
  }

  formatDate(date: string): string {
    const d = String(date).slice(0, 10);
    const [y, m, dd] = d.split('-');
    return `${dd}/${m}/${y}`;
  }

  shortTime(t: string): string {
    return (t || '').slice(0, 5);
  }

  private toIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }
}

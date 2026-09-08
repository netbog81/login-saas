/**
 * Conflict Filters
 * Layer 1: Dumb Component (presentazionale, OnPush)
 *
 * Barra filtri della pagina conflitti: operatore, intervallo di date, motivo.
 *
 * I filtri NON si applicano da soli a ogni battuta. Ogni applicazione fa
 * girare al backend la revalidazione completa (`revalidateAll`), che non è
 * una query da lanciare mentre l'utente sceglie una data: si applica con il
 * pulsante o con Invio.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { ConflictReason, conflictReasonLabel } from '../../models/conflict.model';

/** Operatore selezionabile nel filtro. */
export interface ConflictFilterOperator {
  id: string;
  label: string;
}

/** Valori correnti dei filtri, nella forma che il container passa al service. */
export interface ConflictFilterValues {
  operatorId?: string;
  dateFrom?: string;
  dateTo?: string;
  conflictReason?: ConflictReason;
}

@Component({
  selector: 'app-conflict-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <form class="filters" (ngSubmit)="emitApply()">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="operator-field">
        <mat-label>Operatore</mat-label>
        <mat-select [(ngModel)]="operatorId" name="operatorId">
          <mat-option [value]="''">Tutti gli operatori</mat-option>
          <mat-option *ngFor="let op of operators" [value]="op.id">{{ op.label }}</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date-field">
        <mat-label>Da</mat-label>
        <input matInput [matDatepicker]="fromPicker" [(ngModel)]="dateFrom" name="dateFrom">
        <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
        <mat-datepicker #fromPicker></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date-field">
        <mat-label>A</mat-label>
        <input matInput [matDatepicker]="toPicker" [(ngModel)]="dateTo" name="dateTo">
        <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
        <mat-datepicker #toPicker></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="reason-field">
        <mat-label>Motivo</mat-label>
        <mat-select [(ngModel)]="conflictReason" name="conflictReason">
          <mat-option [value]="''">Tutti i motivi</mat-option>
          <mat-option *ngFor="let r of reasons" [value]="r">{{ labelFor(r) }}</mat-option>
        </mat-select>
      </mat-form-field>

      <div class="filter-actions">
        <button mat-flat-button color="primary" type="submit" [disabled]="loading">
          <mat-icon>filter_alt</mat-icon>
          Filtra
        </button>
        <button mat-stroked-button type="button" [disabled]="loading" (click)="emitClear()">
          Azzera
        </button>
        <button mat-icon-button type="button" [disabled]="loading"
                aria-label="Aggiorna" (click)="refresh.emit()">
          <mat-icon [class.spinning]="loading">refresh</mat-icon>
        </button>
      </div>
    </form>
  `,
  styles: [`
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .operator-field { flex: 1 1 220px; min-width: 0; }
    .reason-field { flex: 1 1 200px; min-width: 0; }
    .date-field { flex: 0 1 160px; min-width: 0; }

    .filter-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }

    .filter-actions mat-icon { vertical-align: middle; }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 599px) {
      .operator-field, .reason-field, .date-field { flex: 1 1 100%; }
      .filter-actions { width: 100%; }
      .filter-actions button[mat-flat-button],
      .filter-actions button[mat-stroked-button] { flex: 1 1 auto; }
    }
  `],
})
export class ConflictFiltersComponent {
  @Input() operators: ConflictFilterOperator[] = [];
  @Input() loading = false;

  @Output() apply = new EventEmitter<ConflictFilterValues>();
  @Output() clear = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();

  operatorId = '';
  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  conflictReason: ConflictReason | '' = '';

  readonly reasons: ConflictReason[] = [
    ConflictReason.TemplateChange,
    ConflictReason.OperatorSick,
    ConflictReason.OperatorVacation,
    ConflictReason.OperatorUnavailable,
    ConflictReason.RecurringAppointment,
    ConflictReason.AvailabilityRemoved,
  ];

  labelFor(reason: ConflictReason): string {
    return conflictReasonLabel(reason);
  }

  emitApply(): void {
    this.apply.emit({
      operatorId: this.operatorId || undefined,
      dateFrom: this.toDateString(this.dateFrom),
      dateTo: this.toDateString(this.dateTo),
      conflictReason: this.conflictReason || undefined,
    });
  }

  emitClear(): void {
    this.operatorId = '';
    this.dateFrom = null;
    this.dateTo = null;
    this.conflictReason = '';
    this.clear.emit();
  }

  /** Data locale in 'YYYY-MM-DD': mai via toISOString (sposta di un giorno). */
  private toDateString(d: Date | null): string | undefined {
    if (!d) return undefined;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}

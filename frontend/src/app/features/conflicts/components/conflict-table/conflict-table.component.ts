/**
 * Conflict Table
 * Layer 1: Dumb Component (presentazionale, OnPush)
 *
 * L'elenco degli appuntamenti in conflitto, con selezione multipla e azioni
 * per riga.
 *
 * DUE RENDER PER LO STESSO DATO. Sopra i 960px è una `mat-table`: nove
 * colonne che si leggono per confronto verticale, che è il modo in cui la
 * segreteria lavora quando i conflitti sono trenta. Sotto è una lista di
 * card. Non è una scelta estetica — una tabella a nove colonne su un telefono
 * o scrolla in orizzontale (e le azioni finiscono fuori schermo) o comprime le
 * colonne fino a una parola per riga.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';

import { ConflictedAppointment, conflictReasonLabel } from '../../models/conflict.model';

/** Azione richiesta su una singola riga. */
export interface ConflictRowAction {
  type: 'move' | 'resolve' | 'open';
  conflict: ConflictedAppointment;
}

@Component({
  selector: 'app-conflict-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatTableModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  template: `
    <!-- ===== Tabella (desktop) ===== -->
    <div class="table-wrap">
      <table mat-table [dataSource]="conflicts" class="conflict-table">
        <ng-container matColumnDef="select">
          <th mat-header-cell *matHeaderCellDef>
            <mat-checkbox [checked]="allSelected"
                          [indeterminate]="someSelected"
                          (change)="toggleAll.emit()"
                          aria-label="Seleziona tutti"></mat-checkbox>
          </th>
          <td mat-cell *matCellDef="let c">
            <mat-checkbox [checked]="isSelected(c)"
                          (change)="toggleOne.emit(c)"
                          [attr.aria-label]="'Seleziona ' + (c.clientName || '')"></mat-checkbox>
          </td>
        </ng-container>

        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Data</th>
          <td mat-cell *matCellDef="let c">{{ formatDate(c.appointmentDate) }}</td>
        </ng-container>

        <ng-container matColumnDef="time">
          <th mat-header-cell *matHeaderCellDef>Orario</th>
          <td mat-cell *matCellDef="let c">{{ hhmm(c.startTime) }} - {{ hhmm(c.endTime) }}</td>
        </ng-container>

        <ng-container matColumnDef="client">
          <th mat-header-cell *matHeaderCellDef>Paziente</th>
          <td mat-cell *matCellDef="let c">
            <div class="client-cell">
              <span class="client-name">{{ c.clientName || '—' }}</span>
              <span class="client-phone" *ngIf="c.clientPhone">{{ c.clientPhone }}</span>
            </div>
          </td>
        </ng-container>

        <ng-container matColumnDef="operator">
          <th mat-header-cell *matHeaderCellDef>Operatore</th>
          <td mat-cell *matCellDef="let c">
            <span class="operator-badge" *ngIf="c.operatorName"
                  [style.background]="c.operatorColor || '#64748b'">
              {{ c.operatorName }}
            </span>
            <span *ngIf="!c.operatorName">—</span>
          </td>
        </ng-container>

        <ng-container matColumnDef="service">
          <th mat-header-cell *matHeaderCellDef>Servizio</th>
          <td mat-cell *matCellDef="let c">{{ c.serviceName || '—' }}</td>
        </ng-container>

        <ng-container matColumnDef="reason">
          <th mat-header-cell *matHeaderCellDef>Motivo</th>
          <td mat-cell *matCellDef="let c">
            <span class="reason-chip">{{ reasonLabel(c) }}</span>
          </td>
        </ng-container>

        <ng-container matColumnDef="detected">
          <th mat-header-cell *matHeaderCellDef>Rilevato</th>
          <td mat-cell *matCellDef="let c">{{ formatDate(c.conflictDetectedAt) }}</td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef aria-label="Azioni"></th>
          <td mat-cell *matCellDef="let c">
            <div class="row-actions">
              <button mat-icon-button type="button"
                      matTooltip="Sposta su uno slot libero"
                      [disabled]="!c.patientId"
                      (click)="action.emit({ type: 'move', conflict: c })">
                <mat-icon>swap_horiz</mat-icon>
              </button>
              <button mat-icon-button type="button"
                      matTooltip="Risolvi conflitto"
                      (click)="action.emit({ type: 'resolve', conflict: c })">
                <mat-icon>rule</mat-icon>
              </button>
            </div>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"
            [class.selected]="isSelected(row)"></tr>
      </table>
    </div>

    <!-- ===== Card (mobile) ===== -->
    <div class="card-list">
      <div class="conflict-card" *ngFor="let c of conflicts" [class.selected]="isSelected(c)">
        <div class="card-head">
          <mat-checkbox [checked]="isSelected(c)" (change)="toggleOne.emit(c)"></mat-checkbox>
          <div class="card-title">
            <span class="client-name">{{ c.clientName || '—' }}</span>
            <span class="card-when">
              {{ formatDate(c.appointmentDate) }} · {{ hhmm(c.startTime) }}-{{ hhmm(c.endTime) }}
            </span>
          </div>
        </div>

        <div class="card-meta">
          <span class="operator-badge" *ngIf="c.operatorName"
                [style.background]="c.operatorColor || '#64748b'">{{ c.operatorName }}</span>
          <span class="reason-chip">{{ reasonLabel(c) }}</span>
        </div>

        <div class="card-actions">
          <button mat-stroked-button type="button"
                  [disabled]="!c.patientId"
                  (click)="action.emit({ type: 'move', conflict: c })">
            <mat-icon>swap_horiz</mat-icon> Sposta
          </button>
          <button mat-flat-button color="primary" type="button"
                  (click)="action.emit({ type: 'resolve', conflict: c })">
            <mat-icon>rule</mat-icon> Risolvi
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .table-wrap {
      /* Anche in tabella il contenuto può eccedere su schermi stretti:
         lo scroll deve restare qui dentro, mai sul body della pagina. */
      overflow-x: auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
    }

    .conflict-table { width: 100%; }

    tr.selected td { background: #eff6ff; }

    .client-cell { display: flex; flex-direction: column; line-height: 1.25; }
    .client-name { font-weight: 600; }
    .client-phone { font-size: 0.75rem; color: #64748b; }

    .operator-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      color: #fff;
      font-size: 0.8125rem;
      white-space: nowrap;
    }

    .reason-chip {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      font-size: 0.8125rem;
      white-space: nowrap;
    }

    .row-actions { display: flex; gap: 2px; justify-content: flex-end; }

    /* ===== Card list ===== */
    .card-list { display: none; flex-direction: column; gap: 10px; }

    .conflict-card {
      border: 1px solid #e2e8f0;
      border-left: 4px solid #dc2626;
      border-radius: 8px;
      background: #fff;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .conflict-card.selected { background: #eff6ff; }

    .card-head { display: flex; align-items: flex-start; gap: 8px; }
    .card-title { display: flex; flex-direction: column; min-width: 0; }
    .card-when { font-size: 0.8125rem; color: #64748b; }

    .card-meta { display: flex; flex-wrap: wrap; gap: 6px; }

    .card-actions { display: flex; gap: 8px; }
    .card-actions button { flex: 1 1 auto; }
    .card-actions mat-icon {
      font-size: 18px; width: 18px; height: 18px; vertical-align: middle;
    }

    @media (max-width: 959px) {
      .table-wrap { display: none; }
      .card-list { display: flex; }
    }
  `],
})
export class ConflictTableComponent {
  @Input() conflicts: ConflictedAppointment[] = [];
  @Input() selectedIds = new Set<string>();

  @Output() toggleOne = new EventEmitter<ConflictedAppointment>();
  @Output() toggleAll = new EventEmitter<void>();
  @Output() action = new EventEmitter<ConflictRowAction>();

  readonly columns = [
    'select', 'date', 'time', 'client', 'operator', 'service', 'reason', 'detected', 'actions',
  ];

  isSelected(c: ConflictedAppointment): boolean {
    return this.selectedIds.has(c.id);
  }

  get allSelected(): boolean {
    return this.conflicts.length > 0 && this.selectedIds.size === this.conflicts.length;
  }

  get someSelected(): boolean {
    return this.selectedIds.size > 0 && !this.allSelected;
  }

  reasonLabel(c: ConflictedAppointment): string {
    return conflictReasonLabel(c.conflictReason);
  }

  hhmm(time: string | null | undefined): string {
    return (time ?? '').slice(0, 5);
  }

  formatDate(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }
}

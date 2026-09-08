/**
 * Conflict Stats
 * Layer 1: Dumb Component (presentazionale, OnPush)
 *
 * La riga di contatori in testa alla pagina conflitti: totale e ripartizione
 * per motivo. I motivi mostrati sono fissi e non derivati dai dati: una
 * causa che scende a zero deve restare visibile con lo zero, altrimenti la
 * riga cambia larghezza a ogni aggiornamento e non si riesce più a leggere
 * a colpo d'occhio se una categoria è migliorata o è solo sparita.
 */

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

import { ConflictReason, conflictReasonLabel } from '../../models/conflict.model';

/** Statistiche nella forma minima che serve al riquadro. */
export interface ConflictStatsView {
  totalConflicts: number;
  byReason: Record<string, number>;
}

@Component({
  selector: 'app-conflict-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatCardModule],
  template: `
    <div class="stats-row">
      <mat-card class="stat-card total" appearance="outlined">
        <div class="stat-value">{{ stats?.totalConflicts || 0 }}</div>
        <div class="stat-label">Conflitti totali</div>
      </mat-card>

      <mat-card class="stat-card" appearance="outlined" *ngFor="let r of reasons">
        <div class="stat-value">{{ countFor(r) }}</div>
        <div class="stat-label">{{ labelFor(r) }}</div>
      </mat-card>
    </div>
  `,
  styles: [`
    .stats-row {
      display: grid;
      /* auto-fit + minmax: da cinque colonne sul desktop a una sola sul
         telefono senza media query, e senza che una card scenda sotto la
         larghezza in cui il numero resta leggibile. */
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
    }

    .stat-card {
      padding: 14px 16px;
      text-align: center;
    }

    .stat-card.total {
      border-color: #dc2626;
      background: #fef2f2;
    }

    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      line-height: 1.1;
      color: #0f172a;
    }

    .stat-card.total .stat-value { color: #b91c1c; }

    .stat-label {
      margin-top: 4px;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #64748b;
    }
  `],
})
export class ConflictStatsComponent {
  @Input() stats: ConflictStatsView | null = null;

  readonly reasons: ConflictReason[] = [
    ConflictReason.TemplateChange,
    ConflictReason.OperatorSick,
    ConflictReason.OperatorVacation,
    ConflictReason.OperatorUnavailable,
  ];

  /**
   * Il backend indicizza `byReason` con i valori dell'enum in minuscolo
   * (`operator_sick`), ma l'enum generato è in PascalCase: leggere per chiave
   * diretta dava zero su tutto. Si prova entrambe le forme.
   */
  countFor(reason: ConflictReason): number {
    const map = this.stats?.byReason ?? {};
    const raw = String(reason);
    return map[raw] ?? map[raw.toLowerCase()] ?? map[raw.toUpperCase()] ?? 0;
  }

  labelFor(reason: ConflictReason): string {
    return conflictReasonLabel(reason);
  }
}

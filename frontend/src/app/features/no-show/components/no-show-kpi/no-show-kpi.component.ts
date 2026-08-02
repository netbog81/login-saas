import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { NoShowSummary } from '../../models/no-show.model';

/**
 * KPI in testa alla pagina No Show (componente dumb).
 *
 * Le "assenze che pesano" sono il numero grande: no-show + disdette
 * tardive + disdette storiche senza preavviso calcolato. Disdette con
 * preavviso e ritardi restano a lato, come contesto: non sono penalità.
 */
@Component({
  selector: 'app-no-show-kpi',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (summary) {
      <div class="kpi-grid">
        <div class="kpi primary">
          <span class="kpi-label">Assenze ingiustificate</span>
          <span class="kpi-value">{{ summary.counts.unjustified }}</span>
          <span class="kpi-hint">{{ summary.patientsInvolved }} pazienti coinvolti</span>
        </div>
        <div class="kpi">
          <span class="kpi-label"><mat-icon>person_off</mat-icon> Non presentati</span>
          <span class="kpi-value">{{ summary.counts.noShow }}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label"><mat-icon>event_busy</mat-icon> Disdette tardive</span>
          <span class="kpi-value">{{ summary.counts.cancelledLate }}</span>
          <span class="kpi-hint">sotto {{ summary.lateCancellationHours }}h di preavviso</span>
        </div>
        <div class="kpi muted">
          <span class="kpi-label"><mat-icon>schedule</mat-icon> Ritardi</span>
          <span class="kpi-value">{{ summary.counts.lateArrival }}</span>
          <span class="kpi-hint">oltre {{ summary.lateArrivalToleranceMinutes }} min</span>
        </div>
        <div class="kpi muted">
          <span class="kpi-label"><mat-icon>event_available</mat-icon> Disdette con preavviso</span>
          <span class="kpi-value">{{ summary.counts.cancelledEarly }}</span>
          <span class="kpi-hint">nessuna penalità</span>
        </div>
      </div>

      <div class="decision-bar">
        <span class="chip pending">
          <mat-icon>pending_actions</mat-icon> Da valutare: <b>{{ summary.pendingReviews }}</b>
        </span>
        <span class="chip charge">
          <mat-icon>payments</mat-icon> Da addebitare: <b>{{ summary.toCharge }}</b>
        </span>
        <span class="chip waived">
          <mat-icon>volunteer_activism</mat-icon> Esonerate: <b>{{ summary.waived }}</b>
        </span>
        <span class="chip justified">
          <mat-icon>verified</mat-icon> Giustificate: <b>{{ summary.justified }}</b>
        </span>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .kpi-grid {
      display: grid; gap: 12px; margin-bottom: 12px;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }
    .kpi {
      background: #fff; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px;
      padding: 12px 14px; display: flex; flex-direction: column; gap: 2px;
    }
    .kpi.primary { border-color: #d32f2f; background: #fff5f5; }
    .kpi.muted { background: #fafafa; }
    .kpi-label {
      display: flex; align-items: center; gap: 4px;
      font-size: 12px; color: rgba(0,0,0,0.6); text-transform: uppercase;
      letter-spacing: .3px;
    }
    .kpi-label mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .kpi-value { font-size: 26px; font-weight: 600; line-height: 1.1; }
    .kpi.primary .kpi-value { color: #d32f2f; }
    .kpi-hint { font-size: 11px; color: rgba(0,0,0,0.5); }

    .decision-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .chip {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 10px; border-radius: 14px; font-size: 12.5px;
      background: #f0f0f0; color: rgba(0,0,0,0.75);
    }
    .chip mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .chip.pending { background: #fff3e0; color: #e65100; }
    .chip.charge { background: #ffebee; color: #c62828; }
    .chip.waived { background: #e8f5e9; color: #2e7d32; }
    .chip.justified { background: #e3f2fd; color: #1565c0; }
  `],
})
export class NoShowKpiComponent {
  @Input() summary: NoShowSummary | null = null;
}

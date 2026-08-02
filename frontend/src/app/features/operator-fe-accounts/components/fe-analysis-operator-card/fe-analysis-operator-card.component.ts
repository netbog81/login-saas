import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  FE_STATE_LABELS,
  OperatorFeAnalysis,
} from '../../models/operator-fe-accounts.model';

/**
 * CONTI FE — card riepilogo compensi di UN operatore con dettaglio
 * espandibile (Layer 1 — dumb component, solo Input/Output).
 * Colonne dettaglio sui campi FE: Totale Sconto FE (prezzo praticato),
 * Extra studio FE, Imponibile (≈ Tariffa servizio FE per le righe da listino).
 */
@Component({
  selector: 'app-fe-analysis-operator-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule, MatCheckboxModule],
  template: `
    <div class="card" [class.selected]="selected">
      <div class="head">
        <mat-checkbox [checked]="selected" (change)="selectedChange.emit($event.checked)"
                      matTooltip="Includi nella generazione conteggi" />
        <div class="who">
          <span class="name">{{ data.operatorName }}</span>
          <span class="pct" [class.warn]="!data.hasOperator"
                [matTooltip]="data.hasOperator ? 'Percentuale su prestazioni (scheda operatore)' : 'Nessuna scheda operatore collegata a questo utente: percentuale 0.'">
            {{ data.hasOperator ? (data.royaltyPercentage | number: '1.0-2') + '%' : 'senza scheda' }}
          </span>
        </div>
        <div class="counts">
          <span class="chip total">{{ data.counts.total }} prestazioni</span>
          <span class="chip ok">{{ data.counts.paid }} incassate</span>
          <span class="chip mid">{{ data.counts.unpaid }} da incassare</span>
          <span class="chip todo">{{ data.counts.open }} in corso</span>
        </div>
        <div class="totals">
          <div class="tot"><label>Prestazioni FE</label><b>{{ data.totals.gross | currency: 'EUR' }}</b></div>
          <div class="tot main"><label>Compenso</label><b>{{ data.totals.compensation | currency: 'EUR' }}</b></div>
          <div class="tot"><label>Quota studio</label><b>{{ data.totals.studioShare | currency: 'EUR' }}</b></div>
          <div class="tot"><label>Extra studio FE</label><b>{{ data.totals.studioExtra | currency: 'EUR' }}</b></div>
        </div>
        <button mat-icon-button (click)="toggle.emit()"
                [matTooltip]="expanded ? 'Chiudi dettaglio' : 'Dettaglio prestazioni'">
          <mat-icon>{{ expanded ? 'expand_less' : 'expand_more' }}</mat-icon>
        </button>
      </div>

      @if (expanded) {
        <div class="detail">
          <table>
            <thead>
              <tr>
                <th>Data</th><th>Paziente</th><th>Descrizione</th>
                <th class="r">Prezzo FE</th><th class="r">Extra studio FE</th>
                <th class="r">Imponibile</th><th class="r">%</th>
                <th class="r">Compenso</th><th>Stato</th>
              </tr>
            </thead>
            <tbody>
              @for (row of data.rows; track row.treatmentServiceId) {
                <tr>
                  <td>{{ row.executionDate | date: 'dd/MM/yyyy' }}</td>
                  <td>{{ row.patientName ?? '—' }}</td>
                  <td>
                    {{ row.description }}
                    @if (row.isCustomPrice) {
                      <mat-icon class="inline-ico" matTooltip="Prezzo personalizzato">edit_attributes</mat-icon>
                    }
                    @if (row.missingBreakdown) {
                      <mat-icon class="inline-ico warn" matTooltip="Extra studio FE non compilato sul servizio: extra considerato 0.">warning</mat-icon>
                    }
                  </td>
                  <td class="r">{{ row.unitPrice | currency: 'EUR' }}</td>
                  <td class="r">{{ row.studioExtraAmount | currency: 'EUR' }}</td>
                  <td class="r">{{ row.baseAmount | currency: 'EUR' }}</td>
                  <td class="r">{{ row.percentage | number: '1.0-2' }}</td>
                  <td class="r"><b>{{ row.compensationAmount | currency: 'EUR' }}</b></td>
                  <td><span class="state" [class]="'state-' + row.state">{{ stateLabels[row.state] }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .card {
      background: #fff;
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 10px;
    }
    .card.selected { border-color: #3f51b5; }
    .head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .who { display: flex; flex-direction: column; min-width: 180px; }
    .name { font-weight: 600; }
    .pct { font-size: 12px; color: rgba(0,0,0,0.55); }
    .pct.warn { color: #c62828; font-weight: 600; }
    .counts { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip {
      border-radius: 10px; padding: 2px 8px; font-size: 11px; font-weight: 600;
      background: rgba(0,0,0,0.06);
    }
    .chip.ok { background: rgba(76,175,80,0.15); color: #2e7d32; }
    .chip.mid { background: rgba(255,167,38,0.18); color: #b26a00; }
    .chip.todo { background: rgba(66,165,245,0.15); color: #1565c0; }
    .totals { display: flex; gap: 16px; margin-left: auto; flex-wrap: wrap; }
    .tot { display: flex; flex-direction: column; align-items: flex-end; }
    .tot label { font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: rgba(0,0,0,0.55); }
    .tot.main b { color: #2e7d32; }
    .detail { margin-top: 10px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .4px;
         color: rgba(0,0,0,0.55); padding: 4px 8px;
         border-bottom: 1px solid rgba(0,0,0,0.12); }
    td { padding: 4px 8px; border-bottom: 1px solid rgba(0,0,0,0.06); }
    .r { text-align: right; }
    .inline-ico { font-size: 15px; width: 15px; height: 15px; vertical-align: middle; color: rgba(0,0,0,0.4); }
    .inline-ico.warn { color: #ef6c00; }
    .state { border-radius: 8px; padding: 1px 6px; font-size: 11px; font-weight: 600; }
    .state-PAID { background: rgba(76,175,80,0.15); color: #2e7d32; }
    .state-UNPAID { background: rgba(255,167,38,0.18); color: #b26a00; }
    .state-OPEN { background: rgba(66,165,245,0.15); color: #1565c0; }
  `],
})
export class FeAnalysisOperatorCardComponent {
  @Input({ required: true }) data!: OperatorFeAnalysis;
  @Input() expanded = false;
  @Input() selected = false;

  @Output() toggle = new EventEmitter<void>();
  @Output() selectedChange = new EventEmitter<boolean>();

  readonly stateLabels = FE_STATE_LABELS;
}

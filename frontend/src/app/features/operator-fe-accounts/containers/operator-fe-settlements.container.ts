import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { OperatorFeAccountsService } from '../services/operator-fe-accounts.service';
import { OperatorFePrintService } from '../services/operator-fe-print.service';
import {
  FeOperator,
  FeSettlementBatch,
  OperatorFeSettlement,
  PatchFeSettlementInput,
  feOperatorDisplayName,
  groupFeSettlementsIntoBatches,
} from '../models/operator-fe-accounts.model';

/**
 * CONTI FE — conteggi salvati raggruppati per LOTTO di generazione (Layer 2
 * — smart container). Vista ad albero: "Conteggio del … alle …" espandibile
 * sugli operatori inclusi; selezione multipla per eliminare; workflow per
 * riga (comunicato/verificato/pagato + data pagamento — niente metodo,
 * banca o riferimento fattura nei Conti FE).
 */
@Component({
  selector: 'app-operator-fe-settlements',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="page-head">
      <a mat-icon-button routerLink=".." matTooltip="Torna all'analisi">
        <mat-icon>arrow_back</mat-icon>
      </a>
      <div>
        <h1 class="title">Conteggi FE salvati</h1>
        <p class="subtitle">Ogni lotto raggruppa i conteggi generati insieme; i valori sono snapshot immutabili.</p>
      </div>
      <span class="spacer"></span>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="ops-select">
        <mat-label>Operatore</mat-label>
        <mat-select [(ngModel)]="filterOperatorId" (ngModelChange)="reload()">
          <mat-option [value]="''">Tutti</mat-option>
          @for (op of operators(); track op.id) {
            @if (op.appUserId) {
              <mat-option [value]="op.appUserId">{{ displayName(op) }}</mat-option>
            }
          }
        </mat-select>
      </mat-form-field>
      <button mat-stroked-button color="warn" [disabled]="!selectedIds().size" (click)="bulkDelete()">
        <mat-icon>delete</mat-icon>
        Elimina selezionati ({{ selectedIds().size }})
      </button>
    </div>

    @if (loading()) {
      <div class="loading"><mat-spinner diameter="36" /></div>
    } @else if (!batches().length) {
      <div class="empty">
        <mat-icon>receipt_long</mat-icon>
        <p>Nessun conteggio. Generali dalla pagina di analisi.</p>
      </div>
    } @else {
      @for (batch of batches(); track batch.key) {
        <div class="batch">
          <div class="batch-head">
            <mat-checkbox
              [checked]="isBatchSelected(batch)"
              [indeterminate]="isBatchPartiallySelected(batch)"
              (change)="selectBatch(batch, $event.checked)"
              matTooltip="Seleziona il lotto"
            />
            <button mat-icon-button (click)="toggleBatch(batch.key)">
              <mat-icon>{{ expandedBatches().has(batch.key) ? 'expand_less' : 'expand_more' }}</mat-icon>
            </button>
            <div class="batch-title">
              <b>Conteggio del {{ batch.createdAt | date: 'dd/MM/yyyy' }} alle {{ batch.createdAt | date: 'HH:mm' }}</b>
              <span class="batch-sub">
                Periodo {{ batch.periodFrom | date: 'dd/MM/yy' }} → {{ batch.periodTo | date: 'dd/MM/yy' }}
                · da incassare {{ batch.includeUnpaid ? 'incluse' : 'escluse' }}
                · in corso {{ batch.includeOpen ? 'incluse' : 'escluse' }}
              </span>
            </div>
            <span class="spacer"></span>
            <span class="batch-tot">{{ batch.settlements.length }} operatori ·
              <b>{{ batch.totalCompensation | currency: 'EUR' }}</b></span>
          </div>

          @if (expandedBatches().has(batch.key)) {
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>Operatore</th><th class="r">Prestazioni</th><th class="r">Compenso</th>
                    <th>Comunicato</th><th>Verificato</th><th>Pagato</th>
                    <th>Data pag.</th>
                    <th class="r">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of batch.settlements; track s.id) {
                    <tr>
                      <td>
                        <mat-checkbox [checked]="selectedIds().has(s.id)"
                                      (change)="setSelected(s.id, $event.checked)" />
                      </td>
                      <td class="name">{{ s.operatorName }}</td>
                      <td class="r" [matTooltip]="s.countPaid + ' incassate, ' + s.countUnpaid + ' da incassare, ' + s.countOpen + ' in corso'">
                        {{ s.countTotal }}
                      </td>
                      <td class="r"><b>{{ s.compensationAmount | currency: 'EUR' }}</b></td>
                      <td>
                        <mat-slide-toggle [checked]="!!s.communicatedAt"
                          [matTooltip]="s.communicatedAt ? ('il ' + (s.communicatedAt | date: 'dd/MM/yyyy HH:mm')) : ''"
                          (change)="patch(s, { communicated: $event.checked })" />
                      </td>
                      <td>
                        <mat-slide-toggle [checked]="!!s.verifiedAt"
                          [matTooltip]="s.verifiedAt ? ('il ' + (s.verifiedAt | date: 'dd/MM/yyyy HH:mm')) : ''"
                          (change)="patch(s, { verified: $event.checked })" />
                      </td>
                      <td>
                        <mat-slide-toggle [checked]="!!s.paidAt"
                          [matTooltip]="s.paidAt ? ('il ' + (s.paidAt | date: 'dd/MM/yyyy HH:mm')) : ''"
                          (change)="patch(s, { paid: $event.checked })" />
                      </td>
                      <td>
                        <input class="mini-input date" type="date" [ngModel]="s.paymentDate"
                               (ngModelChange)="patch(s, { paymentDate: $event || null })" />
                      </td>
                      <td class="r actions">
                        <button mat-icon-button matTooltip="Stampa conto operatore FE" (click)="printStatement(s)">
                          <mat-icon>print</mat-icon>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    }
  `,
  styles: [`
    :host { display: block; padding: 16px 24px 32px; }
    .page-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
    .title { margin: 0; font-size: 22px; font-weight: 600; }
    .subtitle { margin: 2px 0 0; font-size: 13px; color: rgba(0,0,0,0.55); }
    .spacer { flex: 1; }
    .ops-select { width: 220px; }
    .loading { display: flex; justify-content: center; padding: 40px; }
    .empty {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 40px; color: rgba(0,0,0,0.55);
    }
    .empty mat-icon { font-size: 40px; width: 40px; height: 40px; }
    .batch {
      background: #fff;
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 8px; margin-bottom: 10px; overflow: hidden;
    }
    .batch-head {
      display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      background: rgba(0,0,0,0.02); flex-wrap: wrap;
    }
    .batch-title { display: flex; flex-direction: column; }
    .batch-sub { font-size: 12px; color: rgba(0,0,0,0.55); }
    .batch-tot { font-size: 13px; }
    .table-wrap { padding: 4px 10px 10px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .4px;
         color: rgba(0,0,0,0.55); padding: 6px 8px;
         border-bottom: 1px solid rgba(0,0,0,0.12); }
    td { padding: 4px 8px; border-bottom: 1px solid rgba(0,0,0,0.06); vertical-align: middle; }
    .r { text-align: right; }
    .name { font-weight: 600; }
    .mini-input {
      width: 120px; padding: 4px 8px; font: inherit;
      border: 1px solid rgba(0,0,0,0.2); border-radius: 6px;
    }
    .mini-input.date { width: 140px; }
    .actions { white-space: nowrap; }
  `],
})
export class OperatorFeSettlementsContainer implements OnInit {
  readonly loading = signal(true);
  readonly batches = signal<FeSettlementBatch[]>([]);
  readonly operators = signal<FeOperator[]>([]);
  readonly expandedBatches = signal<Set<string>>(new Set());
  readonly selectedIds = signal<Set<string>>(new Set());

  filterOperatorId = '';

  readonly displayName = feOperatorDisplayName;

  constructor(
    private readonly service: OperatorFeAccountsService,
    private readonly printService: OperatorFePrintService,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.service.operators().subscribe({ next: (ops) => this.operators.set(ops) });
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.selectedIds.set(new Set());
    this.service.settlements(this.filterOperatorId || undefined).subscribe({
      next: (rows) => {
        const batches = groupFeSettlementsIntoBatches(rows);
        this.batches.set(batches);
        // Il lotto più recente parte espanso.
        if (batches.length) this.expandedBatches.set(new Set([batches[0].key]));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Errore nel caricamento dei conteggi.', 'OK', { duration: 5000 });
      },
    });
  }

  toggleBatch(key: string): void {
    const next = new Set(this.expandedBatches());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.expandedBatches.set(next);
  }

  // ── Selezione ──────────────────────────────────────────────────────

  setSelected(id: string, selected: boolean): void {
    const next = new Set(this.selectedIds());
    if (selected) next.add(id);
    else next.delete(id);
    this.selectedIds.set(next);
  }

  selectBatch(batch: FeSettlementBatch, selected: boolean): void {
    const next = new Set(this.selectedIds());
    for (const s of batch.settlements) {
      if (selected) next.add(s.id);
      else next.delete(s.id);
    }
    this.selectedIds.set(next);
  }

  isBatchSelected(batch: FeSettlementBatch): boolean {
    return batch.settlements.every((s) => this.selectedIds().has(s.id));
  }

  isBatchPartiallySelected(batch: FeSettlementBatch): boolean {
    const some = batch.settlements.some((s) => this.selectedIds().has(s.id));
    return some && !this.isBatchSelected(batch);
  }

  bulkDelete(): void {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    const confirmed = window.confirm(
      `Eliminare ${ids.length} conteggi selezionati? Quelli pagati verranno saltati.`,
    );
    if (!confirmed) return;
    this.service.bulkDeleteSettlements(ids).subscribe({
      next: ({ deleted, skippedPaid }) => {
        this.snackBar.open(
          `Eliminati ${deleted} conteggi` + (skippedPaid ? ` (${skippedPaid} pagati saltati)` : '') + '.',
          'OK',
          { duration: 5000 },
        );
        this.reload();
      },
      error: () => this.snackBar.open('Eliminazione non riuscita.', 'OK', { duration: 5000 }),
    });
  }

  // ── Workflow ───────────────────────────────────────────────────────

  patch(s: OperatorFeSettlement, input: PatchFeSettlementInput): void {
    this.service.patchSettlement(s.id, input).subscribe({
      next: (updated) => this.replaceRow(updated),
      error: () => {
        this.snackBar.open('Aggiornamento non riuscito.', 'OK', { duration: 5000 });
        this.reload();
      },
    });
  }

  printStatement(s: OperatorFeSettlement): void {
    this.printService.printSettlement(s.id).subscribe({
      error: (err: Error) =>
        this.snackBar.open(err.message || 'Stampa non riuscita.', 'OK', { duration: 6000 }),
    });
  }

  private replaceRow(updated: OperatorFeSettlement): void {
    this.batches.set(
      this.batches().map((b) => ({
        ...b,
        settlements: b.settlements.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)),
      })),
    );
  }
}

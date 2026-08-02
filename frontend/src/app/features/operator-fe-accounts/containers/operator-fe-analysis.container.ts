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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { OperatorFeAccountsService } from '../services/operator-fe-accounts.service';
import { OperatorFePrintService } from '../services/operator-fe-print.service';
import {
  FeOperator,
  OPERATOR_CATEGORY_LABELS,
  OperatorFeAccountSettings,
  OperatorFeAnalysis,
  StandardPeriod,
  buildStandardPeriods,
  feOperatorDisplayName,
} from '../models/operator-fe-accounts.model';
import { FeAnalysisOperatorCardComponent } from '../components/fe-analysis-operator-card/fe-analysis-operator-card.component';

/**
 * CONTI FE — pagina analisi (Layer 2 — smart container).
 * Compensi sui trattamenti con sconto FE: filtri periodo/operatori, card per
 * operatore con dettaglio, stampa analisi e generazione conteggi per gli
 * operatori spuntati.
 */
@Component({
  selector: 'app-operator-fe-analysis',
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
    MatProgressSpinnerModule,
    MatSnackBarModule,
    FeAnalysisOperatorCardComponent,
  ],
  template: `
    <div class="page-head">
      <div>
        <h1 class="title"><mat-icon>groups</mat-icon> Conti FE</h1>
        <p class="subtitle">
          Compensi operatore sui trattamenti con sconto FE: percentuale su
          (prezzo praticato FE − Extra studio FE).
        </p>
      </div>
      <span class="spacer"></span>
      <a mat-stroked-button routerLink="conteggi">
        <mat-icon>receipt_long</mat-icon>
        Conteggi salvati
      </a>
    </div>

    <div class="toolbar">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="period-select">
        <mat-label>Periodo</mat-label>
        <mat-select [(ngModel)]="selectedPeriodIdx" (ngModelChange)="onPeriodPick($event)">
          @for (p of periods(); track p.from; let i = $index) {
            <mat-option [value]="i">{{ p.label }}</mat-option>
          }
          <mat-option [value]="-1">Date personalizzate…</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date-field">
        <mat-label>Dal</mat-label>
        <input matInput type="date" [(ngModel)]="from" (ngModelChange)="selectedPeriodIdx = -1" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date-field">
        <mat-label>Al</mat-label>
        <input matInput type="date" [(ngModel)]="to" (ngModelChange)="selectedPeriodIdx = -1" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="cat-select">
        <mat-label>Categoria</mat-label>
        <mat-select [(ngModel)]="filterCategory" (ngModelChange)="onCategoryPick()">
          <mat-option [value]="''">Tutte</mat-option>
          @for (cat of categories; track cat) {
            <mat-option [value]="cat">{{ categoryLabels[cat] }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="ops-select">
        <mat-label>Operatori</mat-label>
        <mat-select multiple [ngModel]="filterOperatorIds" (ngModelChange)="onOperatorsPick($event)">
          <mat-option value="__ALL__"><b>Tutti</b></mat-option>
          @for (op of filteredOperators(); track op.id) {
            <mat-option [value]="op.appUserId">{{ displayName(op) }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <button mat-flat-button color="primary" [disabled]="loading() || !from || !to" (click)="reload()">
        <mat-icon>refresh</mat-icon>
        Calcola
      </button>
      <button mat-stroked-button [disabled]="loading() || !analysis().length" (click)="printAnalysis()">
        <mat-icon>print</mat-icon>
        Stampa analisi
      </button>
      <button mat-icon-button [matTooltip]="settingsOpen() ? 'Chiudi impostazioni' : 'Impostazioni periodo standard'"
              (click)="settingsOpen.set(!settingsOpen())">
        <mat-icon>settings</mat-icon>
      </button>
    </div>

    @if (settingsOpen()) {
      <div class="settings-row">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Periodo standard</mat-label>
          <mat-select [(ngModel)]="settingsDraft.periodMode">
            <mat-option value="CALENDAR_MONTH">Mese solare (1 → fine mese)</mat-option>
            <mat-option value="CUTOFF">Con giorno di chiusura</mat-option>
          </mat-select>
        </mat-form-field>
        @if (settingsDraft.periodMode === 'CUTOFF') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="cutoff-field">
            <mat-label>Giorno chiusura</mat-label>
            <input matInput type="number" min="1" max="28" [(ngModel)]="settingsDraft.cutoffDay" />
          </mat-form-field>
          <span class="hint">Es. 25 → periodi 26/mese prec. → 25/mese</span>
        }
        <button mat-stroked-button (click)="saveSettings()">Salva impostazioni</button>
      </div>
    }

    <div class="generate-bar">
      <mat-slide-toggle [(ngModel)]="includeUnpaid">Includi da incassare nei conteggi</mat-slide-toggle>
      <mat-slide-toggle [(ngModel)]="includeOpen">Includi in corso nei conteggi</mat-slide-toggle>
      <span class="spacer"></span>
      <button mat-flat-button color="accent" [disabled]="loading() || !selectedIds().size" (click)="generate()">
        <mat-icon>calculate</mat-icon>
        Genera conteggi ({{ selectedIds().size }})
      </button>
    </div>

    @if (loading()) {
      <div class="loading"><mat-spinner diameter="36" /></div>
    } @else if (!analysis().length) {
      <div class="empty">
        <mat-icon>search_off</mat-icon>
        <p>Nessuna prestazione con sconto FE nel periodo selezionato.</p>
      </div>
    } @else {
      @for (op of analysis(); track op.operatorAppUserId) {
        <app-fe-analysis-operator-card
          [data]="op"
          [expanded]="expandedIds().has(op.operatorAppUserId)"
          [selected]="selectedIds().has(op.operatorAppUserId)"
          (toggle)="toggleExpanded(op.operatorAppUserId)"
          (selectedChange)="setSelected(op.operatorAppUserId, $event)"
        />
      }
    }
  `,
  styles: [`
    :host { display: block; padding: 16px 24px 32px; }
    .page-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 22px; font-weight: 600; }
    .subtitle { margin: 4px 0 0; font-size: 13px; color: rgba(0,0,0,0.55); }
    .spacer { flex: 1; }
    .toolbar, .generate-bar, .settings-row {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      background: #fff;
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 8px; padding: 10px 14px; margin-bottom: 10px;
    }
    .period-select { width: 220px; }
    .date-field { width: 150px; }
    .cat-select { width: 190px; }
    .ops-select { width: 260px; }
    .cutoff-field { width: 130px; }
    .hint { font-size: 12px; color: rgba(0,0,0,0.55); }
    .loading { display: flex; justify-content: center; padding: 40px; }
    .empty {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 40px; color: rgba(0,0,0,0.55);
    }
    .empty mat-icon { font-size: 40px; width: 40px; height: 40px; }
  `],
})
export class OperatorFeAnalysisContainer implements OnInit {
  readonly loading = signal(false);
  readonly operators = signal<FeOperator[]>([]);
  readonly analysis = signal<OperatorFeAnalysis[]>([]);
  readonly periods = signal<StandardPeriod[]>([]);
  readonly expandedIds = signal<Set<string>>(new Set());
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly settingsOpen = signal(false);

  from = '';
  to = '';
  selectedPeriodIdx = 0;
  filterCategory = '';
  filterOperatorIds: string[] = [];
  includeUnpaid = false;
  includeOpen = false;
  settingsDraft: OperatorFeAccountSettings = { periodMode: 'CALENDAR_MONTH', cutoffDay: 25 };

  readonly displayName = feOperatorDisplayName;
  readonly categoryLabels = OPERATOR_CATEGORY_LABELS;
  readonly categories = Object.keys(OPERATOR_CATEGORY_LABELS);

  constructor(
    private readonly service: OperatorFeAccountsService,
    private readonly printService: OperatorFePrintService,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.service.operators().subscribe({ next: (ops) => this.operators.set(ops) });
    this.service.settings().subscribe({
      next: (s) => {
        this.settingsDraft = { periodMode: s.periodMode, cutoffDay: s.cutoffDay };
        this.applyPeriods(s);
        this.reload();
      },
      error: () => {
        this.applyPeriods(this.settingsDraft);
        this.reload();
      },
    });
  }

  onPeriodPick(idx: number): void {
    if (idx < 0) return;
    const p = this.periods()[idx];
    if (p) {
      this.from = p.from;
      this.to = p.to;
    }
  }

  /** Operatori mostrati nel multiselect, filtrati per categoria. */
  filteredOperators(): FeOperator[] {
    return this.operators().filter(
      (op) => op.appUserId && (!this.filterCategory || op.macroCategory === this.filterCategory),
    );
  }

  onCategoryPick(): void {
    // Cambio categoria: azzera la selezione puntuale (= tutti della categoria).
    this.filterOperatorIds = [];
  }

  /** Gestisce l'opzione "Tutti": seleziona/deseleziona tutti i filtrati. */
  onOperatorsPick(values: string[]): void {
    if (values.includes('__ALL__')) {
      const all = this.filteredOperators().map((op) => op.appUserId!) ;
      const wasAll = this.filterOperatorIds.length === all.length && all.length > 0;
      this.filterOperatorIds = wasAll ? [] : all;
    } else {
      this.filterOperatorIds = values;
    }
  }

  /** Ids effettivi per l'analisi: selezione puntuale, o la categoria intera. */
  private effectiveOperatorIds(): string[] {
    if (this.filterOperatorIds.length) return this.filterOperatorIds;
    if (this.filterCategory) return this.filteredOperators().map((op) => op.appUserId!);
    return [];
  }

  reload(): void {
    if (!this.from || !this.to) return;
    const ids = this.effectiveOperatorIds();
    // Categoria selezionata ma senza operatori: risultato vuoto senza query
    // (ids vuoti per il backend significherebbero "tutti").
    if (this.filterCategory && !ids.length) {
      this.analysis.set([]);
      this.selectedIds.set(new Set());
      return;
    }
    this.loading.set(true);
    this.service.analysis(this.from, this.to, ids).subscribe({
      next: (rows) => {
        this.analysis.set(rows);
        // Preseleziona tutti gli operatori del risultato per la generazione.
        this.selectedIds.set(new Set(rows.map((r) => r.operatorAppUserId)));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Errore nel calcolo dei compensi FE.', 'OK', { duration: 5000 });
      },
    });
  }

  toggleExpanded(id: string): void {
    const next = new Set(this.expandedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expandedIds.set(next);
  }

  setSelected(id: string, selected: boolean): void {
    const next = new Set(this.selectedIds());
    if (selected) next.add(id);
    else next.delete(id);
    this.selectedIds.set(next);
  }

  generate(): void {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    const confirmed = window.confirm(
      `Generare ${ids.length} conteggi FE per il periodo ${this.from} → ${this.to}?` +
        `\nDa incassare: ${this.includeUnpaid ? 'incluse' : 'escluse'} — In corso: ${this.includeOpen ? 'incluse' : 'escluse'}.` +
        '\nI valori vengono salvati e non cambieranno più.',
    );
    if (!confirmed) return;
    this.loading.set(true);
    this.service
      .generate({
        from: this.from,
        to: this.to,
        operatorAppUserIds: ids,
        includeUnpaid: this.includeUnpaid,
        includeOpen: this.includeOpen,
      })
      .subscribe({
        next: (created) => {
          this.loading.set(false);
          this.snackBar.open(
            `Creati ${created.length} conteggi. Li trovi in "Conteggi salvati".`,
            'OK',
            { duration: 5000 },
          );
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open('Generazione conteggi non riuscita.', 'OK', { duration: 5000 });
        },
      });
  }

  printAnalysis(): void {
    this.printService.printAnalysis(this.from, this.to, this.analysis());
  }

  saveSettings(): void {
    this.service.updateSettings(this.settingsDraft).subscribe({
      next: (s) => {
        this.snackBar.open('Impostazioni salvate.', 'OK', { duration: 3000 });
        this.applyPeriods(s);
      },
      error: () => this.snackBar.open('Salvataggio impostazioni non riuscito.', 'OK', { duration: 5000 }),
    });
  }

  private applyPeriods(settings: OperatorFeAccountSettings): void {
    this.periods.set(buildStandardPeriods(settings));
    this.selectedPeriodIdx = 0;
    this.onPeriodPick(0);
  }
}

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import {
  ALL_EVENT_TYPES,
  NoShowContext,
  NoShowDecision,
  NoShowEventType,
  NoShowFilter,
  eventTypeIcon,
  eventTypeLabel,
} from '../../models/no-show.model';

export interface OperatorOption {
  id: string;
  label: string;
  macroCategory?: string | null;
}

/**
 * Barra filtri della pagina No Show (componente dumb: nessuna chiamata,
 * emette solo il filtro aggiornato).
 *
 * Il filtro ambito studio/palestra è di prima classe perché i due mondi
 * hanno figure di riferimento diverse (medici/fisio vs istruttori) e
 * regole di tolleranza che lo staff giudica separatamente.
 */
@Component({
  selector: 'app-no-show-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  template: `
    <div class="filters">
      <!-- Periodo -->
      <div class="row">
        <div class="quick-periods">
          <button mat-stroked-button (click)="setLastMonths(1)">Ultimo mese</button>
          <button mat-stroked-button (click)="setLastMonths(3)">3 mesi</button>
          <button mat-stroked-button (click)="setLastMonths(6)">6 mesi</button>
          <button mat-stroked-button (click)="setLastMonths(12)">12 mesi</button>
          <button mat-stroked-button (click)="setYearToDate()">Anno in corso</button>
          <button mat-stroked-button (click)="clearPeriod()">Tutto</button>
        </div>
        <div class="date-range">
          <label>Dal <input type="date" [ngModel]="filter.from" (ngModelChange)="patch({ from: $event })"></label>
          <label>Al <input type="date" [ngModel]="filter.to" (ngModelChange)="patch({ to: $event })"></label>
        </div>
      </div>

      <!-- Ambito + ricerca -->
      <div class="row">
        <div class="segmented">
          @for (ctx of contexts; track ctx.value) {
            <button
              mat-button
              [class.active]="(filter.context ?? 'ALL') === ctx.value"
              (click)="patch({ context: ctx.value })">
              <mat-icon>{{ ctx.icon }}</mat-icon> {{ ctx.label }}
            </button>
          }
        </div>

        <label class="search">
          <mat-icon>search</mat-icon>
          <input
            type="text"
            placeholder="Cerca paziente…"
            [ngModel]="filter.search"
            (ngModelChange)="patch({ search: $event })">
        </label>

        <label class="min-events">
          Almeno
          <select [ngModel]="filter.minEvents ?? 1" (ngModelChange)="patch({ minEvents: +$event })">
            <option [value]="1">1 evento</option>
            <option [value]="2">2 eventi</option>
            <option [value]="3">3 eventi</option>
            <option [value]="5">5 eventi</option>
          </select>
          nel periodo
        </label>
      </div>

      <!-- Tipologie -->
      <div class="row types">
        @for (type of allTypes; track type) {
          <button
            mat-button
            class="type-chip"
            [class.active]="isTypeActive(type)"
            (click)="toggleType(type)">
            <mat-icon>{{ icon(type) }}</mat-icon> {{ label(type) }}
          </button>
        }
      </div>

      <!-- Esito valutazione -->
      <div class="row decisions">
        <span class="row-label">Esito:</span>
        @for (d of decisions; track d.value) {
          <button
            mat-button
            class="type-chip"
            [class.active]="isDecisionActive(d.value)"
            (click)="toggleDecision(d.value)">
            {{ d.label }}
          </button>
        }
        <label class="checkbox">
          <input
            type="checkbox"
            [ngModel]="filter.excludeJustified ?? true"
            (ngModelChange)="patch({ excludeJustified: $event })">
          Escludi le assenze giustificate
        </label>
      </div>

      <!-- Operatori -->
      @if (operators.length) {
        <div class="row operators">
          <span class="row-label">Operatore:</span>
          <select multiple size="1" [ngModel]="filter.operatorIds ?? []" (ngModelChange)="patch({ operatorIds: $event })">
            @for (op of operators; track op.id) {
              <option [value]="op.id">{{ op.label }}</option>
            }
          </select>
          @if (filter.operatorIds?.length) {
            <button mat-button (click)="patch({ operatorIds: [] })">
              <mat-icon>close</mat-icon> Tutti
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .filters {
      background: #fff; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px;
      padding: 10px 14px; margin-bottom: 16px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .row-label { font-size: 12px; color: rgba(0,0,0,0.6); }
    .quick-periods, .segmented { display: flex; flex-wrap: wrap; gap: 4px; }
    .quick-periods button { min-width: 0; padding: 0 10px; font-size: 12.5px; }
    .date-range { display: flex; gap: 10px; margin-left: auto; }
    .date-range label { font-size: 12.5px; color: rgba(0,0,0,0.7); }
    .date-range input, .min-events select, .operators select {
      border: 1px solid rgba(0,0,0,0.24); border-radius: 4px; padding: 3px 6px;
      font: inherit; font-size: 12.5px;
    }
    .segmented button { min-width: 0; border: 1px solid transparent; }
    .segmented button.active { background: #e8eaf6; color: #3f51b5; border-color: #c5cae9; }
    .segmented mat-icon, .type-chip mat-icon {
      font-size: 16px; width: 16px; height: 16px; margin-right: 3px;
    }
    .search {
      display: flex; align-items: center; gap: 4px; flex: 1 1 180px; max-width: 280px;
      border: 1px solid rgba(0,0,0,0.24); border-radius: 4px; padding: 2px 8px;
    }
    .search input { border: 0; outline: 0; flex: 1; font: inherit; font-size: 12.5px; }
    .search mat-icon { font-size: 17px; width: 17px; height: 17px; color: rgba(0,0,0,0.45); }
    .min-events { font-size: 12.5px; color: rgba(0,0,0,0.7); display: flex; align-items: center; gap: 4px; }
    .type-chip {
      min-width: 0; font-size: 12.5px; border-radius: 14px;
      border: 1px solid rgba(0,0,0,0.16); color: rgba(0,0,0,0.6);
    }
    .type-chip.active { background: #e8eaf6; color: #3f51b5; border-color: #7986cb; }
    .checkbox { display: flex; align-items: center; gap: 5px; font-size: 12.5px; color: rgba(0,0,0,0.7); }
  `],
})
export class NoShowFiltersComponent {
  @Input({ required: true }) filter!: NoShowFilter;
  @Input() operators: OperatorOption[] = [];

  @Output() filterChange = new EventEmitter<NoShowFilter>();

  readonly allTypes = ALL_EVENT_TYPES;

  readonly contexts: { value: NoShowContext; label: string; icon: string }[] = [
    { value: 'ALL', label: 'Tutti', icon: 'apps' },
    { value: 'STUDIO', label: 'Studio', icon: 'medical_services' },
    { value: 'GYM', label: 'Palestra', icon: 'fitness_center' },
  ];

  readonly decisions: { value: NoShowDecision; label: string }[] = [
    { value: 'PENDING', label: 'Da valutare' },
    { value: 'TO_CHARGE', label: 'Da addebitare' },
    { value: 'WAIVED', label: 'Esonerate' },
    { value: 'JUSTIFIED', label: 'Giustificate' },
  ];

  label = eventTypeLabel;
  icon = eventTypeIcon;

  patch(partial: Partial<NoShowFilter>): void {
    this.filterChange.emit({ ...this.filter, ...partial });
  }

  isTypeActive(type: NoShowEventType): boolean {
    return !!this.filter.types?.includes(type);
  }

  toggleType(type: NoShowEventType): void {
    const current = this.filter.types ?? [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    // Nessuna tipologia selezionata non ha senso: si torna a quella cliccata.
    this.patch({ types: next.length ? next : [type] });
  }

  isDecisionActive(decision: NoShowDecision): boolean {
    return !!this.filter.decisions?.includes(decision);
  }

  toggleDecision(decision: NoShowDecision): void {
    const current = this.filter.decisions ?? [];
    const next = current.includes(decision)
      ? current.filter((d) => d !== decision)
      : [...current, decision];
    this.patch({ decisions: next });
  }

  setLastMonths(months: number): void {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - months);
    this.patch({ from: NoShowFiltersComponent.iso(from), to: NoShowFiltersComponent.iso(to) });
  }

  setYearToDate(): void {
    const now = new Date();
    this.patch({
      from: `${now.getFullYear()}-01-01`,
      to: NoShowFiltersComponent.iso(now),
    });
  }

  clearPeriod(): void {
    this.patch({ from: null, to: null });
  }

  private static iso(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Calendar V2 Sidebar Component
 * Layer 1: Dumb Component
 *
 * Tre sezioni espandibili:
 * 1. Operatori (lista con toggle)
 * 2. Ricerca Disponibilita' (filtri completi come v1)
 * 3. Trattamenti in corso
 * Scrollbar verticale quando il contenuto eccede l'altezza.
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatRadioModule } from '@angular/material/radio';
import { CalendarOperator, SearchFilters } from '../../models/calendar-v2.model';
import { Treatment } from '../../../../models/treatment.model';
import { InstrumentCategory } from '../../../../graphql/generated/types';

@Component({
  selector: 'app-calendar-v2-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    MatCheckboxModule, MatButtonModule, MatIconModule,
    MatSelectModule, MatFormFieldModule, MatDividerModule,
    MatExpansionModule, MatRadioModule,
  ],
  template: `
    <div class="sidebar" [class.collapsed]="collapsed">
      <div class="sidebar-header">
        <button mat-icon-button (click)="toggleCollapsed.emit()">
          <mat-icon>{{ collapsed ? 'chevron_right' : 'chevron_left' }}</mat-icon>
        </button>
        @if (!collapsed) {
          <span class="sidebar-title">Pannello</span>
        }
      </div>

      @if (!collapsed) {
        <div class="sidebar-scroll">

          <!-- ===== 1. OPERATORI ===== -->
          <mat-expansion-panel [expanded]="true" class="sidebar-panel">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon>people</mat-icon>
                Operatori ({{ selectedCount }}/{{ operators.length }})
              </mat-panel-title>
            </mat-expansion-panel-header>

            <!-- Filtro categoria -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
              <mat-label>Categoria</mat-label>
              <mat-select [(ngModel)]="selectedCategory" (ngModelChange)="onCategoryChange()">
                <mat-option value="">Tutte</mat-option>
                @for (cat of categories; track cat) {
                  <mat-option [value]="cat">{{ getCategoryLabel(cat) }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <div class="operator-actions">
              <button mat-stroked-button class="action-btn" (click)="onSelectAll()">
                <mat-icon>select_all</mat-icon> Tutti
              </button>
              <button mat-stroked-button class="action-btn" (click)="onDeselectAll()">
                <mat-icon>deselect</mat-icon> Nessuno
              </button>
            </div>

            <div class="operator-list">
              @for (op of filteredOperators; track op.operatorId) {
                <div class="operator-item" (click)="toggleOperator.emit(op.operatorId)">
                  <div class="operator-color" [style.background]="op.color"></div>
                  <mat-checkbox [checked]="op.selected" (click)="$event.stopPropagation()"
                                (change)="toggleOperator.emit(op.operatorId)">
                  </mat-checkbox>
                  <span class="operator-name" [class.selected]="op.selected">{{ op.name }}</span>
                </div>
              }
            </div>
          </mat-expansion-panel>

          <!-- ===== 2. RICERCA DISPONIBILITA' ===== -->
          <mat-expansion-panel class="sidebar-panel">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon>search</mat-icon>
                Ricerca Disponibilità
              </mat-panel-title>
            </mat-expansion-panel-header>

            <div class="search-filters">
              <!-- Toggle master -->
              <mat-checkbox [(ngModel)]="slotSearchEnabled"
                            (ngModelChange)="slotSearchToggle.emit($event)">
                Mostra slot disponibili
              </mat-checkbox>

              <!-- Durata -->
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
                <mat-label>Durata</mat-label>
                <mat-select [(ngModel)]="filters.duration" (ngModelChange)="emitFilters()"
                            [disabled]="!slotSearchEnabled">
                  <mat-option [value]="15">15 minuti</mat-option>
                  <mat-option [value]="30">30 minuti</mat-option>
                  <mat-option [value]="45">45 minuti</mat-option>
                  <mat-option [value]="60">60 minuti</mat-option>
                </mat-select>
              </mat-form-field>

              <!-- Con strumento -->
              @if (slotSearchEnabled && filters.duration >= 30) {
                <mat-checkbox [(ngModel)]="filters.withInstrument"
                              (ngModelChange)="emitFilters()">
                  Con strumento
                </mat-checkbox>

                @if (filters.withInstrument) {
                  <!-- Numero strumenti -->
                  <div class="filter-group">
                    <label class="filter-label">Numero strumenti</label>
                    <mat-radio-group [(ngModel)]="filters.instrumentCount" (ngModelChange)="emitFilters()">
                      <mat-radio-button [value]="1">1 strumento</mat-radio-button>
                      @if (filters.duration >= 45) {
                        <mat-radio-button [value]="2">2 strumenti</mat-radio-button>
                      }
                    </mat-radio-group>
                  </div>

                  <!-- Posizione strumento (solo 1 strumento, durata > 30) -->
                  @if (filters.instrumentCount === 1 && filters.duration > 30) {
                    <div class="filter-group">
                      <label class="filter-label">Posizione strumento</label>
                      <mat-radio-group [(ngModel)]="filters.instrumentPosition" (ngModelChange)="emitFilters()">
                        <mat-radio-button value="first">Prima metà</mat-radio-button>
                        <mat-radio-button value="second">Seconda metà</mat-radio-button>
                      </mat-radio-group>
                    </div>
                  }

                  <!-- Ordine importante (solo 2 strumenti) -->
                  @if (filters.instrumentCount === 2) {
                    <mat-checkbox [(ngModel)]="filters.instrumentOrderMatters"
                                  (ngModelChange)="emitFilters()">
                      Ordine strumenti importante
                    </mat-checkbox>
                  }

                  <!-- Categoria strumento (1 strumento) -->
                  @if (filters.instrumentCount === 1 && instrumentCategories.length > 0) {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
                      <mat-label>Categoria strumento</mat-label>
                      <mat-select [(ngModel)]="filters.instrumentCategoryId" (ngModelChange)="emitFilters()">
                        <mat-option [value]="null">Qualsiasi</mat-option>
                        @for (cat of instrumentCategories; track cat.id) {
                          <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  }

                  <!-- 2 categorie strumenti -->
                  @if (filters.instrumentCount === 2 && instrumentCategories.length > 0) {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
                      <mat-label>Strumento 1</mat-label>
                      <mat-select [(ngModel)]="filters.instrumentCategoryId" (ngModelChange)="emitFilters()">
                        <mat-option [value]="null">Qualsiasi</mat-option>
                        @for (cat of instrumentCategories; track cat.id) {
                          <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
                      <mat-label>Strumento 2</mat-label>
                      <mat-select [(ngModel)]="filters.instrument2CategoryId" (ngModelChange)="emitFilters()">
                        <mat-option [value]="null">Qualsiasi</mat-option>
                        @for (cat of instrumentCategories; track cat.id) {
                          <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  }
                }
              }
            </div>
          </mat-expansion-panel>

          <!-- ===== 3. TRATTAMENTI ===== -->
          <mat-expansion-panel class="sidebar-panel" [expanded]="treatments.length > 0">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon>medical_services</mat-icon>
                Trattamenti ({{ treatments.length }})
              </mat-panel-title>
            </mat-expansion-panel-header>

            @if (treatments.length > 0) {
              @for (t of treatments; track t.id) {
                <div class="treatment-item">
                  <div class="treatment-patient">{{ t.patient?.nome }} {{ t.patient?.cognome }}</div>
                  <div class="treatment-info">
                    <span class="treatment-operator">{{ t.operator?.name }}</span>
                    <span class="treatment-status" [class]="'status-' + t.status">
                      {{ getStatusLabel(t.status) }}
                    </span>
                  </div>
                </div>
              }
            } @else {
              <p class="empty-text">Nessun trattamento in corso</p>
            }
          </mat-expansion-panel>

        </div><!-- /sidebar-scroll -->
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      height: 100%;
      min-height: 0;
    }

    .sidebar {
      width: 260px;
      min-width: 260px;
      height: 100%;
      background: white;
      border-right: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width 0.2s, min-width 0.2s;
    }

    .sidebar.collapsed { width: 48px; min-width: 48px; }

    .sidebar-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .sidebar-title {
      font-weight: 600;
      font-size: 0.9rem;
      color: #334155;
    }

    /* Area scrollabile */
    .sidebar-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
    }

    /* Panels */
    .sidebar-panel {
      box-shadow: none !important;
      border-radius: 0 !important;
      background: white;
    }

    .sidebar-panel ::ng-deep .mat-expansion-panel-body {
      padding: 0 12px 12px;
    }

    .sidebar-panel ::ng-deep .mat-expansion-panel-header {
      padding: 0 12px;
      height: 40px;
      font-size: 0.8rem;
    }

    .sidebar-panel ::ng-deep .mat-expansion-panel-header-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #334155;
    }

    .sidebar-panel ::ng-deep .mat-expansion-panel-header-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .full-width { width: 100%; }

    /* ===== OPERATORI ===== */
    .operator-actions {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
    }

    .action-btn {
      flex: 1;
      font-size: 0.7rem;
      line-height: 1;
    }

    .action-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .operator-list {
      overflow-y: auto;
      resize: vertical;
      min-height: 60px;
      max-height: 50vh;
      padding-bottom: 4px;
      border-bottom: 2px solid #e2e8f0;
    }

    .operator-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 3px 0;
      cursor: pointer;
      &:hover { background: #f1f5f9; }
    }

    .operator-color {
      width: 12px;
      height: 12px;
      border-radius: 3px;
      flex-shrink: 0;
    }

    .operator-name {
      font-size: 0.8rem;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .operator-name.selected { color: #1e293b; font-weight: 500; }

    /* ===== RICERCA ===== */
    .search-filters {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .search-filters mat-checkbox { font-size: 0.8rem; }

    .filter-group {
      padding-left: 4px;
    }

    .filter-label {
      font-size: 0.7rem;
      color: #64748b;
      font-weight: 500;
      display: block;
      margin-bottom: 4px;
    }

    .filter-group mat-radio-button {
      font-size: 0.75rem;
    }

    .filter-group mat-radio-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    /* ===== TRATTAMENTI ===== */
    .treatment-item {
      padding: 6px 8px;
      background: #f8fafc;
      border-radius: 4px;
      border-left: 3px solid #6366f1;
      margin-bottom: 4px;
    }

    .treatment-patient { font-size: 0.75rem; font-weight: 500; color: #1e293b; }
    .treatment-info { display: flex; justify-content: space-between; align-items: center; margin-top: 2px; }
    .treatment-operator { font-size: 0.65rem; color: #64748b; }
    .treatment-status { font-size: 0.6rem; font-weight: 600; padding: 1px 6px; border-radius: 8px; }
    .status-in_progress { background: #dbeafe; color: #1d4ed8; }
    .status-operator_completed { background: #dcfce7; color: #15803d; }
    .status-closed { background: #f1f5f9; color: #64748b; }
    .empty-text { font-size: 0.75rem; color: #94a3b8; text-align: center; padding: 8px 0; margin: 0; }
  `],
})
export class CalendarV2SidebarComponent {
  @Input() operators: CalendarOperator[] = [];
  @Input() treatments: Treatment[] = [];
  @Input() instrumentCategories: InstrumentCategory[] = [];
  @Input() collapsed = false;

  @Output() toggleOperator = new EventEmitter<string>();
  @Output() setOperatorSelection = new EventEmitter<{ operatorIds: string[]; selected: boolean }>();
  @Output() toggleCollapsed = new EventEmitter<void>();
  @Output() slotSearchToggle = new EventEmitter<boolean>();
  @Output() searchFiltersChange = new EventEmitter<SearchFilters>();

  selectedCategory = '';
  slotSearchEnabled = false;

  filters: SearchFilters = {
    duration: 45,
    withInstrument: false,
    instrumentCount: 1,
    instrumentPosition: 'first',
    instrumentOrderMatters: false,
    instrumentCategoryId: null,
    instrument2CategoryId: null,
  };

  get selectedCount(): number {
    return this.operators.filter(o => o.selected).length;
  }

  get categories(): string[] {
    return [...new Set(this.operators.map(o => o.macroCategory).filter(Boolean))] as string[];
  }

  get filteredOperators(): CalendarOperator[] {
    if (!this.selectedCategory) return this.operators;
    return this.operators.filter(o => o.macroCategory === this.selectedCategory);
  }

  getCategoryLabel(cat: string): string {
    const labels: Record<string, string> = {
      'doctor': 'Medici', 'physiotherapist': 'Fisioterapisti',
      'gym_instructor': 'Istruttori Palestra', 'other': 'Altro',
    };
    return labels[cat] || cat;
  }

  onCategoryChange(): void {
    if (!this.selectedCategory) {
      // "Tutte" selezionato → attiva tutti
      const allIds = this.operators.map(o => o.operatorId);
      this.setOperatorSelection.emit({ operatorIds: allIds, selected: true });
    } else {
      // Categoria specifica → attiva solo quelli della categoria, disattiva gli altri
      const toActivate = this.operators.filter(o => o.macroCategory === this.selectedCategory).map(o => o.operatorId);
      const toDeactivate = this.operators.filter(o => o.macroCategory !== this.selectedCategory).map(o => o.operatorId);
      this.setOperatorSelection.emit({ operatorIds: toDeactivate, selected: false });
      this.setOperatorSelection.emit({ operatorIds: toActivate, selected: true });
    }
  }

  onSelectAll(): void {
    const ids = this.filteredOperators.map(o => o.operatorId);
    this.setOperatorSelection.emit({ operatorIds: ids, selected: true });
  }

  onDeselectAll(): void {
    const ids = this.filteredOperators.map(o => o.operatorId);
    this.setOperatorSelection.emit({ operatorIds: ids, selected: false });
  }

  emitFilters(): void {
    this.searchFiltersChange.emit({ ...this.filters });
  }

  getStatusLabel(status: string | undefined): string {
    const labels: Record<string, string> = {
      'in_progress': 'In corso', 'operator_completed': 'Completato', 'closed': 'Chiuso',
    };
    return labels[status || ''] || status || '';
  }
}

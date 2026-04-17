/**
 * Calendar V2 Sidebar Component
 * Layer 1: Dumb Component
 *
 * Lista operatori con checkbox per toggle visibilità colonne.
 * Filtro per macro-categoria. Select all / Deselect all.
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
import { CalendarOperator } from '../../models/calendar-v2.model';

@Component({
  selector: 'app-calendar-v2-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    MatCheckboxModule, MatButtonModule, MatIconModule,
    MatSelectModule, MatFormFieldModule, MatDividerModule,
  ],
  template: `
    <div class="sidebar" [class.collapsed]="collapsed">
      <div class="sidebar-header">
        <button mat-icon-button (click)="toggleCollapsed.emit()">
          <mat-icon>{{ collapsed ? 'chevron_right' : 'chevron_left' }}</mat-icon>
        </button>
        @if (!collapsed) {
          <span class="sidebar-title">Operatori</span>
        }
      </div>

      @if (!collapsed) {
        <!-- Filtro macro categoria -->
        <div class="sidebar-filter">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
            <mat-label>Categoria</mat-label>
            <mat-select [(ngModel)]="selectedCategory" (ngModelChange)="onCategoryChange()">
              <mat-option value="">Tutte</mat-option>
              @for (cat of categories; track cat) {
                <mat-option [value]="cat">{{ getCategoryLabel(cat) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Actions -->
        <div class="sidebar-actions">
          <button mat-stroked-button class="action-btn" (click)="selectAll.emit()">
            <mat-icon>select_all</mat-icon> Tutti
          </button>
          <button mat-stroked-button class="action-btn" (click)="deselectAll.emit()">
            <mat-icon>deselect</mat-icon> Nessuno
          </button>
        </div>

        <mat-divider></mat-divider>

        <!-- Lista operatori -->
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
      }
    </div>
  `,
  styles: [`
    .sidebar {
      width: 240px;
      min-width: 240px;
      background: white;
      border-right: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width 0.2s, min-width 0.2s;
    }

    .sidebar.collapsed {
      width: 48px;
      min-width: 48px;
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
    }

    .sidebar-title {
      font-weight: 600;
      font-size: 0.9rem;
      color: #334155;
    }

    .sidebar-filter {
      padding: 8px 12px 0;
    }

    .full-width {
      width: 100%;
    }

    .sidebar-actions {
      display: flex;
      gap: 4px;
      padding: 4px 12px 8px;
    }

    .action-btn {
      flex: 1;
      font-size: 0.7rem;
      line-height: 1;
    }

    .action-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .operator-list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }

    .operator-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      cursor: pointer;
      transition: background 0.1s;

      &:hover {
        background: #f1f5f9;
      }
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

    .operator-name.selected {
      color: #1e293b;
      font-weight: 500;
    }
  `],
})
export class CalendarV2SidebarComponent {
  @Input() operators: CalendarOperator[] = [];
  @Input() collapsed = false;

  @Output() toggleOperator = new EventEmitter<string>();
  @Output() selectAll = new EventEmitter<void>();
  @Output() deselectAll = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();

  selectedCategory = '';

  get categories(): string[] {
    const cats = new Set(this.operators.map(o => o.macroCategory).filter(Boolean));
    return Array.from(cats) as string[];
  }

  get filteredOperators(): CalendarOperator[] {
    if (!this.selectedCategory) return this.operators;
    return this.operators.filter(o => o.macroCategory === this.selectedCategory);
  }

  getCategoryLabel(cat: string): string {
    const labels: Record<string, string> = {
      'doctor': 'Medico',
      'physiotherapist': 'Fisioterapista',
      'gym_instructor': 'Istruttore Palestra',
      'other': 'Altro',
    };
    return labels[cat] || cat;
  }

  onCategoryChange(): void {
    // Il filtro è puramente locale, nessun emit necessario
  }
}

/**
 * Operator Search — Calendario V3
 * Layer 1: Dumb Component
 *
 * Elenco operatori raggruppati per categoria, con filtro testuale, per la
 * ricerca appuntamenti "per operatore" della finestra Gestisci Appuntamenti.
 *
 * Raggruppare per categoria non è decorazione: la segreteria ragiona per
 * mestiere ("chi c'è in palestra giovedì?"), non per elenco alfabetico unico.
 *
 * Solo @Input/@Output, nessuna logica di dominio, nessun GraphQL.
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { RebookingOperatorInput } from '../../models/rebooking.model';

/** Operatori di una categoria, come li mostra la lista. */
export interface OperatorGroup {
  category: string;
  label: string;
  operators: RebookingOperatorInput[];
}

@Component({
  selector: 'app-v3-operator-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatIconModule,
  ],
  template: `
    <div class="operator-search">
      <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
        <mat-label>Cerca operatore</mat-label>
        <input matInput
               [(ngModel)]="term"
               (ngModelChange)="onTermChange()"
               placeholder="Nome o cognome"
               autocomplete="off">
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>

      @if (groups.length === 0) {
        <div class="search-state hint">Nessun operatore trovato</div>
      } @else {
        <div class="operator-list">
          @for (group of groups; track group.category) {
            <div class="group">
              <div class="group-header">{{ group.label }}</div>
              @for (op of group.operators; track op.id) {
                <button class="operator-row"
                        [class.selected]="op.id === selectedOperatorId"
                        (click)="selectOperator.emit(op)">
                  <mat-icon class="row-icon">badge</mat-icon>
                  <span class="row-name">{{ op.name }}</span>
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .operator-search { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .search-field { width: 100%; margin-bottom: 8px; }
    .search-state {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: #64748b;
      font-size: 0.85rem;
    }
    .search-state.hint { font-style: italic; }
    .operator-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      min-height: 0;
      flex: 1;
      padding-right: 4px;
    }
    .group { display: flex; flex-direction: column; gap: 2px; }
    .group-header {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #64748b;
      padding: 2px 4px;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 2px;
    }
    .operator-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 7px 8px;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      text-align: left;
      cursor: pointer;
      font-size: 0.84rem;
      color: #1e293b;
    }
    .operator-row:hover { background: #f1f5f9; }
    .operator-row.selected {
      background: #e0f2fe;
      border-color: #38bdf8;
      font-weight: 600;
    }
    .row-icon { font-size: 18px; width: 18px; height: 18px; color: #0284c7; }
    .row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `],
})
export class V3OperatorSearchComponent {
  /** Operatori da mostrare, già raggruppati e filtrati dal container. */
  @Input() groups: OperatorGroup[] = [];
  @Input() selectedOperatorId: string | null = null;

  @Output() termChange = new EventEmitter<string>();
  @Output() selectOperator = new EventEmitter<RebookingOperatorInput>();

  term = '';

  onTermChange(): void {
    this.termChange.emit(this.term.trim());
  }
}

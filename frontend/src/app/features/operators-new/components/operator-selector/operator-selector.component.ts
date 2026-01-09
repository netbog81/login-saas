/**
 * Operator Selector Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare dropdown selezione operatore
 * - Emettere eventi di selezione
 * - NON gestisce logica business
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Operator } from '../../../../graphql/generated/types';

@Component({
  selector: 'app-operator-selector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="operator-selector">
      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="24"></mat-spinner>
          <span>Caricamento...</span>
        </div>
      } @else {
        <mat-form-field appearance="outline" class="operator-field">
          <mat-label>Operatore</mat-label>
          <mat-select
            [value]="selectedOperatorId"
            (selectionChange)="onOperatorChange($event.value)"
            [disabled]="disabled">
            @for (operator of operators; track operator.id) {
              <mat-option [value]="operator.id">
                {{ operator.name }} {{ operator.surname }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
    </div>
  `,
  styles: [`
    .operator-selector {
      min-width: 200px;
    }

    .loading-container {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem;
      color: rgba(255, 255, 255, 0.9);
    }

    .operator-field {
      width: 100%;

      ::ng-deep {
        .mat-mdc-text-field-wrapper {
          background: rgba(255, 255, 255, 0.1);
        }

        .mat-mdc-form-field-flex {
          height: 48px;
        }

        .mat-mdc-floating-label {
          color: rgba(255, 255, 255, 0.7);
        }

        .mat-mdc-select-value {
          color: white;
        }

        .mat-mdc-select-arrow {
          color: rgba(255, 255, 255, 0.7);
        }

        .mdc-notched-outline__leading,
        .mdc-notched-outline__notch,
        .mdc-notched-outline__trailing {
          border-color: rgba(255, 255, 255, 0.3) !important;
        }

        // Rimuovi bordi laterali dal notch centrale per evitare linea verticale
        .mdc-notched-outline__notch {
          border-left: none !important;
          border-right: none !important;
        }

        &:hover .mdc-notched-outline__leading,
        &:hover .mdc-notched-outline__notch,
        &:hover .mdc-notched-outline__trailing {
          border-color: rgba(255, 255, 255, 0.5) !important;
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperatorSelectorComponent {
  @Input() operators: Operator[] = [];
  @Input() selectedOperatorId: string | null = null;
  @Input() loading = false;
  @Input() disabled = false;

  @Output() operatorChange = new EventEmitter<Operator>();

  onOperatorChange(operatorId: string): void {
    const selectedOperator = this.operators.find(op => op.id === operatorId);
    if (selectedOperator) {
      this.operatorChange.emit(selectedOperator);
    }
  }
}

/**
 * Workspace Header Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Comporre OperatorSelector e DateNavigator
 * - Visualizzare titolo workspace
 * - Propagare eventi ai figli
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
import { Operator } from '../../../../graphql/generated/types';
import { OperatorSelectorComponent } from '../operator-selector/operator-selector.component';
import { DateNavigatorComponent } from '../date-navigator/date-navigator.component';

@Component({
  selector: 'app-workspace-header',
  standalone: true,
  imports: [
    CommonModule,
    OperatorSelectorComponent,
    DateNavigatorComponent
  ],
  template: `
    <header class="workspace-header">
      <!-- Left: Operator selector -->
      <div class="header-left">
        <app-operator-selector
          [operators]="operators"
          [selectedOperatorId]="selectedOperator?.id ?? null"
          [loading]="loadingOperators"
          (operatorChange)="onOperatorChange($event)">
        </app-operator-selector>
      </div>

      <!-- Center: Title -->
      <div class="header-center">
        <h1 class="workspace-title">{{ title }}</h1>
        @if (subtitle) {
          <span class="workspace-subtitle">{{ subtitle }}</span>
        }
      </div>

      <!-- Right: Date navigator -->
      <div class="header-right">
        <app-date-navigator
          [selectedDate]="selectedDate"
          (dateChange)="onDateChange($event)"
          (todayClick)="onTodayClick()">
        </app-date-navigator>
      </div>
    </header>
  `,
  styles: [`
    .workspace-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
      min-height: 64px;
    }

    .header-left {
      flex: 0 0 auto;
      min-width: 220px;
    }

    .header-center {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .workspace-title {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .workspace-subtitle {
      font-size: 0.75rem;
      opacity: 0.8;
      margin-top: 2px;
    }

    .header-right {
      flex: 0 0 auto;
    }

    /* Responsive */
    @media (max-width: 1023px) {
      .workspace-header {
        padding: 0.5rem 1rem;
      }

      .header-left {
        min-width: 180px;
      }

      .workspace-title {
        font-size: 1rem;
      }
    }

    @media (max-width: 767px) {
      .workspace-header {
        flex-wrap: wrap;
        gap: 0.5rem;
        padding: 0.5rem;
      }

      .header-left {
        order: 1;
        flex: 1;
        min-width: 150px;
      }

      .header-center {
        order: 3;
        flex: 0 0 100%;
        padding-top: 0.25rem;
        display: none; /* Nascondi titolo su mobile */
      }

      .header-right {
        order: 2;
        flex: 0 0 auto;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspaceHeaderComponent {
  @Input() operators: Operator[] = [];
  @Input() selectedOperator: Operator | null = null;
  @Input() selectedDate: Date = new Date();
  @Input() loadingOperators = false;
  @Input() title = 'Workspace Operatore';
  @Input() subtitle = '';

  @Output() operatorChange = new EventEmitter<Operator>();
  @Output() dateChange = new EventEmitter<Date>();
  @Output() todayClick = new EventEmitter<void>();

  onOperatorChange(operator: Operator): void {
    this.operatorChange.emit(operator);
  }

  onDateChange(date: Date): void {
    this.dateChange.emit(date);
  }

  onTodayClick(): void {
    this.todayClick.emit();
  }
}

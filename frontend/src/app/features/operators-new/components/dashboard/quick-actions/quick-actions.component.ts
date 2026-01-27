/**
 * Quick Actions Component
 * Layer 1: UI Component (Dumb)
 *
 * Responsabilità:
 * - Visualizzare una lista di pulsanti per azioni rapide
 * - Emettere evento quando un'azione viene cliccata
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

import { QuickAction } from '../../../models';

@Component({
  selector: 'app-quick-actions',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule
  ],
  template: `
    <mat-card class="quick-actions-card">
      <mat-card-header>
        <mat-card-title class="card-title">
          <mat-icon>bolt</mat-icon>
          <span>Azioni Rapide</span>
        </mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="actions-grid">
          @for (action of actions; track action.id) {
            <button mat-stroked-button
                    class="action-button"
                    (click)="onActionClick(action)">
              <mat-icon>{{ action.icon }}</mat-icon>
              <span class="action-label">{{ action.label }}</span>
            </button>
          }
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .quick-actions-card {
      border-radius: 12px;
    }

    .card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1rem;
      font-weight: 600;
      color: #1e293b;

      mat-icon {
        color: #667eea;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      padding: 8px 0;
    }

    .action-button {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      padding: 12px 16px;
      height: auto;
      min-height: 48px;
      border-radius: 8px;
      border-color: #e2e8f0;
      transition: all 0.2s ease;

      &:hover {
        background: #f1f5f9;
        border-color: #667eea;

        mat-icon {
          color: #667eea;
        }
      }

      mat-icon {
        color: #64748b;
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      .action-label {
        font-size: 0.875rem;
        font-weight: 500;
        color: #334155;
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    /* Responsive */
    @media (max-width: 599px) {
      .actions-grid {
        grid-template-columns: 1fr;
      }

      .action-button {
        padding: 10px 12px;
        min-height: 44px;

        .action-label {
          font-size: 0.8125rem;
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickActionsComponent {
  @Input() actions: QuickAction[] = [];

  @Output() actionClick = new EventEmitter<QuickAction>();

  onActionClick(action: QuickAction): void {
    this.actionClick.emit(action);
  }
}

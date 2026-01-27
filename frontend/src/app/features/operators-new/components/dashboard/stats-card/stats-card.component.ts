/**
 * Stats Card Component
 * Layer 1: UI Component (Dumb)
 *
 * Responsabilità:
 * - Visualizzare una singola statistica con icona, valore e label
 * - Emettere evento click per azioni
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';

@Component({
  selector: 'app-stats-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatRippleModule
  ],
  template: `
    <mat-card class="stats-card"
              [class.clickable]="clickable"
              [class.loading]="loading"
              matRipple
              [matRippleDisabled]="!clickable"
              (click)="onClick()">
      <div class="card-content">
        <div class="icon-container" [style.background]="iconBackground">
          <mat-icon>{{ icon }}</mat-icon>
        </div>
        <div class="stats-info">
          <span class="stats-value">
            @if (loading) {
              <span class="loading-placeholder">--</span>
            } @else {
              {{ value }}
            }
          </span>
          <span class="stats-label">{{ label }}</span>
        </div>
      </div>
    </mat-card>
  `,
  styles: [`
    .stats-card {
      border-radius: 12px;
      transition: transform 0.2s ease, box-shadow 0.2s ease;

      &.clickable {
        cursor: pointer;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
      }

      &.loading {
        .stats-value {
          color: #94a3b8;
        }
      }
    }

    .card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
    }

    .icon-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      flex-shrink: 0;

      mat-icon {
        color: white;
        font-size: 24px;
        width: 24px;
        height: 24px;
      }
    }

    .stats-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .stats-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1e293b;
      line-height: 1.2;
    }

    .stats-label {
      font-size: 0.875rem;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .loading-placeholder {
      opacity: 0.5;
    }

    /* Responsive */
    @media (max-width: 599px) {
      .card-content {
        padding: 12px;
        gap: 12px;
      }

      .icon-container {
        width: 40px;
        height: 40px;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }

      .stats-value {
        font-size: 1.25rem;
      }

      .stats-label {
        font-size: 0.75rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatsCardComponent {
  @Input() icon: string = 'info';
  @Input() value: number | string = 0;
  @Input() label: string = '';
  @Input() iconBackground: string = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  @Input() loading: boolean = false;
  @Input() clickable: boolean = false;

  @Output() cardClick = new EventEmitter<void>();

  onClick(): void {
    if (this.clickable) {
      this.cardClick.emit();
    }
  }
}

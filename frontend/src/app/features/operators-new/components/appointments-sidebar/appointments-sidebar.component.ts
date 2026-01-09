/**
 * Appointments Sidebar Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare lista appuntamenti in sidebar
 * - Gestire animazione collapse/expand
 * - Emettere eventi di selezione e toggle
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AvailabilityAppointment } from '../../../../graphql/generated/types';
import { AppointmentCardComponent } from '../appointment-card/appointment-card.component';

@Component({
  selector: 'app-appointments-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatBadgeModule,
    MatTooltipModule,
    AppointmentCardComponent
  ],
  template: `
    <aside class="appointments-sidebar" [class.collapsed]="collapsed">
      <!-- Header -->
      <div class="sidebar-header">
        @if (!collapsed) {
          <div class="header-title">
            <mat-icon>event_note</mat-icon>
            <h3>Appuntamenti</h3>
            <span class="badge" [class.has-items]="appointments.length > 0">
              {{ appointments.length }}
            </span>
          </div>
        }

        <button
          mat-icon-button
          class="collapse-btn"
          (click)="onToggleCollapse()"
          [matTooltip]="collapsed ? 'Espandi sidebar' : 'Comprimi sidebar'">
          <mat-icon>{{ collapsed ? 'chevron_right' : 'chevron_left' }}</mat-icon>
        </button>
      </div>

      <!-- Content -->
      @if (!collapsed) {
        <div class="sidebar-content">
          @if (loading) {
            <div class="loading-state">
              <mat-spinner diameter="32"></mat-spinner>
              <span>Caricamento...</span>
            </div>
          } @else if (appointments.length === 0) {
            <div class="empty-state">
              <mat-icon class="empty-icon">event_busy</mat-icon>
              <p>Nessun appuntamento</p>
              <span class="empty-hint">per questa data</span>
            </div>
          } @else {
            <div class="appointments-list">
              @for (apt of appointments; track apt.id) {
                <app-appointment-card
                  [appointment]="apt"
                  [selected]="apt.id === selectedAppointmentId"
                  (select)="onAppointmentSelect(apt)">
                </app-appointment-card>
              }
            </div>
          }
        </div>
      } @else {
        <!-- Collapsed view: show icons only -->
        <div class="collapsed-content">
          <div class="collapsed-count" [matTooltip]="appointments.length + ' appuntamenti'">
            <mat-icon>event_note</mat-icon>
            <span class="count">{{ appointments.length }}</span>
          </div>

          @if (loading) {
            <mat-spinner diameter="20"></mat-spinner>
          }
        </div>
      }
    </aside>
  `,
  styles: [`
    .appointments-sidebar {
      width: 320px;
      height: 100%;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
      flex-shrink: 0;

      &.collapsed {
        width: 64px;
      }
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid #e2e8f0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 64px;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: white;

      mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }

      h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
      }

      .badge {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 12px;
        min-width: 24px;
        text-align: center;

        &.has-items {
          background: white;
          color: #667eea;
        }
      }
    }

    .collapse-btn {
      color: white;
      flex-shrink: 0;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }

    .sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 32px 16px;
      color: #64748b;

      span {
        font-size: 0.875rem;
      }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 48px 16px;
      text-align: center;

      .empty-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #cbd5e1;
      }

      p {
        margin: 0;
        font-weight: 500;
        color: #64748b;
      }

      .empty-hint {
        font-size: 0.8125rem;
        color: #94a3b8;
      }
    }

    .appointments-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    // Collapsed state
    .collapsed-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 0;
      gap: 16px;
    }

    .collapsed-count {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      transition: background 0.2s;

      &:hover {
        background: #f1f5f9;
      }

      mat-icon {
        color: #667eea;
        font-size: 24px;
        width: 24px;
        height: 24px;
      }

      .count {
        font-size: 0.75rem;
        font-weight: 600;
        color: #667eea;
        background: #eef2ff;
        padding: 2px 6px;
        border-radius: 8px;
      }
    }

    // Responsive
    @media (max-width: 1023px) {
      .appointments-sidebar {
        width: 280px;

        &.collapsed {
          width: 56px;
        }
      }
    }

    @media (max-width: 599px) {
      .appointments-sidebar {
        width: 100%;
        height: auto;
        max-height: 220px;
        border-radius: 0 0 16px 16px;

        &.collapsed {
          width: 100%;
          max-height: 56px;
        }
      }

      .sidebar-header {
        padding: 12px 16px;
        min-height: 56px;
      }

      .sidebar-content {
        padding: 8px;
      }

      .appointments-list {
        flex-direction: row;
        overflow-x: auto;
        gap: 12px;
        padding-bottom: 8px;

        app-appointment-card {
          min-width: 200px;
          flex-shrink: 0;
        }
      }

      .collapsed-content {
        flex-direction: row;
        padding: 0 16px;
        justify-content: center;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppointmentsSidebarComponent {
  @Input() appointments: AvailabilityAppointment[] = [];
  @Input() selectedAppointmentId: string | null = null;
  @Input() loading = false;
  @Input() collapsed = false;

  @Output() appointmentSelect = new EventEmitter<AvailabilityAppointment>();
  @Output() toggleCollapse = new EventEmitter<void>();

  onAppointmentSelect(appointment: AvailabilityAppointment): void {
    this.appointmentSelect.emit(appointment);
  }

  onToggleCollapse(): void {
    this.toggleCollapse.emit();
  }
}

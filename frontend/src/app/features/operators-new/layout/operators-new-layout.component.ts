/**
 * Operators New Layout Component
 * Layer: Layout - Contenitore con sotto-navigazione
 *
 * Responsabilità:
 * - Renderizzare header con selezione operatore e data
 * - Renderizzare la barra di navigazione secondaria (sub-nav)
 * - Gestire il router-outlet per le pagine figlie
 * - Inizializzare lo stato condiviso
 * - Responsive design per mobile/tablet/desktop
 */

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { Operator } from '../../../graphql/generated/types';
import { OperatorWorkspaceStateService } from '../services/operator-workspace-state.service';
import { OperatorSelectorComponent } from '../components/operator-selector/operator-selector.component';
import { DateNavigatorComponent } from '../components/date-navigator/date-navigator.component';

interface NavLink {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-operators-new-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTabsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    OperatorSelectorComponent,
    DateNavigatorComponent
  ],
  template: `
    <div class="operators-new-layout">
      <!-- Header con selezione operatore e data -->
      <header class="layout-header">
        <div class="header-title">
          <h1>Workspace Operatore</h1>
        </div>
        <div class="header-controls">
          <app-operator-selector
            [operators]="(stateService.operators$ | async) || []"
            [selectedOperatorId]="(stateService.selectedOperator$ | async)?.id || null"
            [loading]="(stateService.loadingOperators$ | async) || false"
            (operatorChange)="onOperatorChange($event)">
          </app-operator-selector>
          <app-date-navigator
            [selectedDate]="(stateService.selectedDate$ | async) || today"
            (dateChange)="onDateChange($event)"
            (todayClick)="onTodayClick()">
          </app-date-navigator>
        </div>
      </header>

      <!-- Error banner -->
      @if (stateService.error$ | async; as error) {
        <div class="error-banner">
          <span>{{ error }}</span>
          <button (click)="stateService.clearError()">×</button>
        </div>
      }

      <!-- Sub-navigation bar -->
      <nav mat-tab-nav-bar [tabPanel]="tabPanel" class="sub-nav">
        @for (link of navLinks; track link.path) {
          <a mat-tab-link
             [routerLink]="link.path"
             routerLinkActive
             #rla="routerLinkActive"
             [active]="rla.isActive"
             class="nav-link">
            <mat-icon class="nav-icon">{{ link.icon }}</mat-icon>
            <span class="nav-label">{{ link.label }}</span>
          </a>
        }
      </nav>

      <!-- Content area -->
      <mat-tab-nav-panel #tabPanel class="content-panel">
        <router-outlet></router-outlet>
      </mat-tab-nav-panel>
    </div>
  `,
  styles: [`
    .operators-new-layout {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #f8fafc;
    }

    .layout-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      flex-shrink: 0;
    }

    .header-title {
      h1 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .error-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 24px;
      background: #fee2e2;
      color: #dc2626;
      font-size: 0.875rem;
      flex-shrink: 0;

      button {
        background: none;
        border: none;
        font-size: 1.25rem;
        cursor: pointer;
        color: #dc2626;
        padding: 0 4px;
      }
    }

    .sub-nav {
      flex-shrink: 0;
      background: white;
      border-bottom: 1px solid #e2e8f0;
      padding: 0 16px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 100px;
    }

    .nav-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .nav-label {
      font-weight: 500;
    }

    .content-panel {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    /* Tablet */
    @media (max-width: 959px) {
      .layout-header {
        padding: 12px 16px;
        flex-wrap: wrap;
        gap: 12px;
      }

      .header-controls {
        gap: 12px;
      }

      .nav-link {
        min-width: 80px;
      }

      .nav-label {
        font-size: 0.875rem;
      }
    }

    /* Mobile */
    @media (max-width: 599px) {
      .layout-header {
        padding: 12px;
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }

      .header-title {
        text-align: center;

        h1 {
          font-size: 1.125rem;
        }
      }

      .header-controls {
        justify-content: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      .sub-nav {
        padding: 0 8px;
      }

      .nav-link {
        min-width: 48px;
        justify-content: center;
      }

      .nav-label {
        display: none;
      }

      .nav-icon {
        margin: 0;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperatorsNewLayoutComponent implements OnInit {
  readonly navLinks: NavLink[] = [
    { path: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: 'pazienti', label: 'Pazienti', icon: 'people' },
    { path: 'appuntamenti', label: 'Appuntamenti', icon: 'event' }
  ];

  readonly today = new Date();

  constructor(
    public stateService: OperatorWorkspaceStateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Inizializza lo stato condiviso (carica operatori)
    this.stateService.initialize();
  }

  onOperatorChange(operator: Operator): void {
    this.stateService.setSelectedOperator(operator);
  }

  onDateChange(date: Date): void {
    this.stateService.setSelectedDate(date);
  }

  onTodayClick(): void {
    this.stateService.setToday();
  }
}

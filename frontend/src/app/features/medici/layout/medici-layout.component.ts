import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DateNavigatorComponent } from '../../operators-new/components/date-navigator/date-navigator.component';
import { OperatorWorkspaceStateService } from '../../operators-new/services/operator-workspace-state.service';

/**
 * Layout del Workspace Medico (minimale).
 *
 * Riusa l'infrastruttura del workspace operatore: per un utente non-admin lo
 * `OperatorWorkspaceStateService.initialize()` chiama `loadMyOperator()`, che
 * carica e auto-seleziona SOLO il proprio record Operator (il medico vede
 * quindi unicamente le proprie statistiche). Niente selettore operatore.
 *
 * Per ora una sola pagina: la dashboard. Le sezioni "visite/pazienti"
 * verranno aggiunte qui come nuove sub-route quando definite.
 */
@Component({
  selector: 'app-medici-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, DateNavigatorComponent],
  template: `
    <div class="medici-layout">
      <header class="layout-header">
        <div class="header-title">
          <h1>Workspace Medico</h1>
        </div>
        <div class="header-controls">
          <app-date-navigator
            [selectedDate]="(stateService.selectedDate$ | async) || today"
            (dateChange)="onDateChange($event)"
            (todayClick)="onTodayClick()">
          </app-date-navigator>
        </div>
      </header>

      @if (stateService.error$ | async; as error) {
        <div class="error-banner">
          <span>{{ error }}</span>
          <button (click)="stateService.clearError()">×</button>
        </div>
      }

      <div class="content-panel">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    .medici-layout {
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
      background: linear-gradient(135deg, #0f766e 0%, #115e59 100%);
      color: white;
      flex-shrink: 0;
    }

    .header-title h1 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
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
      }
    }

    .content-panel {
      flex: 1;
      overflow: auto;
      min-height: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediciLayoutComponent implements OnInit {
  readonly today = new Date();

  constructor(public stateService: OperatorWorkspaceStateService) {}

  ngOnInit(): void {
    // Non-admin → loadMyOperator(): carica e auto-seleziona il proprio operatore.
    this.stateService.initialize();
  }

  onDateChange(date: Date): void {
    this.stateService.setSelectedDate(date);
  }

  onTodayClick(): void {
    this.stateService.setToday();
  }
}

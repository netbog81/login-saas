import { Routes } from '@angular/router';
import { MediciLayoutComponent } from './layout/medici-layout.component';
import { OperatorsDashboardContainer } from '../operators-new/containers/operators-dashboard.container';

/**
 * Workspace Medico (minimale): per ora solo la dashboard, che riusa
 * OperatorsDashboardContainer. Lo state service (inizializzato dal layout)
 * carica il proprio operatore, quindi le statistiche sono del medico loggato.
 */
export const MEDICI_ROUTES: Routes = [
  {
    path: '',
    component: MediciLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        component: OperatorsDashboardContainer,
        title: 'Dashboard Medico',
      },
    ],
  },
];

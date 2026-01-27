import { Routes } from '@angular/router';
import { CalendarContainerComponent } from './components/calendar-cdk/calendar-container/calendar-container.component';
import { AvailabilityDashboardComponent } from './components/availability/availability-dashboard/availability-dashboard.component';
import { ConflictDashboardComponent } from './components/conflict-dashboard/conflict-dashboard.component';
import { SettingsComponent } from './components/settings/settings.component';
import { PatientManagementComponent } from './components/patients/patient-management/patient-management.component';
import { OperatorWorkspaceComponent } from './components/operators/operator-workspace/operator-workspace.component';
import { OperatorWorkspaceContainer } from './features/operators-new/containers/operator-workspace.container';
import { OperatorsNewLayoutComponent } from './features/operators-new/layout/operators-new-layout.component';
import { OperatorsDashboardContainer } from './features/operators-new/containers/operators-dashboard.container';
import { OperatorsPatientsContainer } from './features/operators-new/containers/operators-patients.container';

export const routes: Routes = [
  {
    path: 'calendar',
    component: CalendarContainerComponent,
    title: 'Calendario'
  },
  {
    path: 'patients',
    component: PatientManagementComponent,
    title: 'Gestione Pazienti'
  },
  {
    path: 'operatori',
    component: OperatorWorkspaceComponent,
    title: 'Workspace Operatore'
  },
  {
    path: 'operatori-new',
    component: OperatorsNewLayoutComponent,
    title: 'Workspace Operatore (New)',
    children: [
      {
        path: '',
        redirectTo: 'appuntamenti',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        component: OperatorsDashboardContainer,
        title: 'Dashboard Operatori'
      },
      {
        path: 'pazienti',
        component: OperatorsPatientsContainer,
        title: 'Pazienti'
      },
      {
        path: 'appuntamenti',
        component: OperatorWorkspaceContainer,
        title: 'Appuntamenti'
      }
    ]
  },
  {
    path: 'availability',
    component: AvailabilityDashboardComponent,
    title: 'Gestione Disponibilita'
  },
  {
    path: 'conflicts',
    component: ConflictDashboardComponent,
    title: 'Dashboard Conflitti'
  },
  {
    path: 'settings',
    component: SettingsComponent,
    title: 'Impostazioni Generali'
  },
  {
    path: '',
    redirectTo: '/calendar',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/calendar'
  }
];
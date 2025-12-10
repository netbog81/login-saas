import { Routes } from '@angular/router';
import { CalendarContainerComponent } from './components/calendar-cdk/calendar-container/calendar-container.component';
import { AvailabilityDashboardComponent } from './components/availability/availability-dashboard/availability-dashboard.component';
import { ConflictDashboardComponent } from './components/conflict-dashboard/conflict-dashboard.component';
import { SettingsComponent } from './components/settings/settings.component';
import { PatientManagementComponent } from './components/patients/patient-management/patient-management.component';

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
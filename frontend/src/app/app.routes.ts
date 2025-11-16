import { Routes } from '@angular/router';
import { CalendarContainerComponent } from './components/calendar-cdk/calendar-container/calendar-container.component';
import { AvailabilityDashboardComponent } from './components/availability/availability-dashboard/availability-dashboard.component';

export const routes: Routes = [
  {
    path: 'calendar',
    component: CalendarContainerComponent,
    title: 'Calendario'
  },
  {
    path: 'availability',
    component: AvailabilityDashboardComponent,
    title: 'Gestione Disponibilità'
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
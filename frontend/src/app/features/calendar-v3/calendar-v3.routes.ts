import { Routes } from '@angular/router';
import { CalendarV3Container } from './containers/calendar-v3.container';

export const CALENDAR_V3_ROUTES: Routes = [
  {
    path: '',
    component: CalendarV3Container,
    title: 'Calendario',
  },
];

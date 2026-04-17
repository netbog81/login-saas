import { Routes } from '@angular/router';
import { CalendarV2Container } from './containers/calendar-v2.container';

export const CALENDAR_V2_ROUTES: Routes = [
  {
    path: '',
    component: CalendarV2Container,
    title: 'Calendario V2',
  },
];

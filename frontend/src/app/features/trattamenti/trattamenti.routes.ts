import { Routes } from '@angular/router';
import { TrattamentiPageContainer } from './containers/trattamenti-page.container';

export const TRATTAMENTI_ROUTES: Routes = [
  {
    path: '',
    component: TrattamentiPageContainer,
    title: 'Trattamenti',
  },
];

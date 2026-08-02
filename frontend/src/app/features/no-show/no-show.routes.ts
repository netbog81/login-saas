import { Routes } from '@angular/router';
import { NoShowPageContainer } from './containers/no-show-page.container';

/**
 * Route della sezione Statistiche → No Show (gestione assenze
 * ingiustificate). Montata come tab dello shell Statistiche.
 */
export const NO_SHOW_ROUTES: Routes = [
  {
    path: '',
    component: NoShowPageContainer,
    title: 'No Show — assenze ingiustificate',
  },
];

import { Routes } from '@angular/router';

/**
 * Route dei CONTI FE (montate sotto /statistiche/conti-fe).
 */
export const OPERATOR_FE_ACCOUNTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./containers/operator-fe-analysis.container').then(
        (m) => m.OperatorFeAnalysisContainer,
      ),
    title: 'Conti FE',
  },
  {
    path: 'conteggi',
    loadComponent: () =>
      import('./containers/operator-fe-settlements.container').then(
        (m) => m.OperatorFeSettlementsContainer,
      ),
    title: 'Conteggi FE salvati',
  },
];

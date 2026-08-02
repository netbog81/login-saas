import { Routes } from '@angular/router';
import { StatisticheShellComponent } from './containers/statistiche-shell.component';

/**
 * Sezione Statistiche (menu segreteria/admin): shell a tab con le
 * sotto-sezioni Voucher FE, Conti FE e No Show. /statistiche reindirizza
 * alla prima tab, così i link esistenti continuano a funzionare.
 */
export const STATISTICHE_ROUTES: Routes = [
  {
    path: '',
    component: StatisticheShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'voucher-fe' },
      {
        path: 'voucher-fe',
        loadChildren: () =>
          import('../voucher-fe/voucher-fe.routes').then((m) => m.VOUCHER_FE_ROUTES),
      },
      {
        path: 'conti-fe',
        loadChildren: () =>
          import('../operator-fe-accounts/operator-fe-accounts.routes').then(
            (m) => m.OPERATOR_FE_ACCOUNTS_ROUTES,
          ),
      },
      {
        path: 'no-show',
        loadChildren: () =>
          import('../no-show/no-show.routes').then((m) => m.NO_SHOW_ROUTES),
      },
    ],
  },
];

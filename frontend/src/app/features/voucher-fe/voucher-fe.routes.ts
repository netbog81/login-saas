import { Routes } from '@angular/router';
import { VoucherFeStatsComponent } from './components/voucher-fe-stats/voucher-fe-stats.component';

/**
 * Route della sezione Statistiche. Per ora un'unica pagina (Voucher FE);
 * predisposta per future sotto-sezioni statistiche.
 */
export const VOUCHER_FE_ROUTES: Routes = [
  {
    path: '',
    component: VoucherFeStatsComponent,
    title: 'Statistiche Voucher FE',
  },
];

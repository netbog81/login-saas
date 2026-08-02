import { Routes } from '@angular/router';
import { TrattamentiPageContainer } from './containers/trattamenti-page.container';

export const TRATTAMENTI_ROUTES: Routes = [
  {
    path: '',
    component: TrattamentiPageContainer,
    title: 'Trattamenti',
  },
  {
    // 2026-07-27 — Deep-link da accounting ("apri il trattamento nel
    // clinico", Da fatturare): stessa pagina lista + apertura automatica
    // del riquadro dettagli del trattamento indicato. Prima questa URL
    // non matchava nulla e il wildcard '**' portava al calendario.
    path: ':treatmentId',
    component: TrattamentiPageContainer,
    title: 'Trattamenti',
  },
];

import { Routes } from '@angular/router';
import { ProductManagementContainer } from './containers/product-management.container';

export const PRODUCTS_ROUTES: Routes = [
  {
    path: '',
    component: ProductManagementContainer,
    title: 'Prodotti',
  },
];

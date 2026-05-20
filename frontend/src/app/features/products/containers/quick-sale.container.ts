import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { QuickSaleFormComponent } from '../components/quick-sale-form/quick-sale-form.component';
import { ProductService } from '../services/product.service';
import { Product } from '../models/product.model';
import {
  RecordProductSaleInput,
  SaleCompletedResult,
} from '../models/product-input.model';

/**
 * QuickSaleContainer — Layer 2 (Smart).
 *
 * Coordinatore vendita rapida prodotto:
 *  - Carica catalogo prodotti attivi
 *  - Apre `<app-quick-sale-form>` modale
 *  - Invia recordProductSale al backend → publish `sale.completed`
 *  - Notifica esito al parent via `saleCompleted` Output
 *
 * Pattern: si monta come componente "host" (es. dentro
 * ProductManagementContainer come overlay, o standalone via route).
 * Per MVP è chiamato dal `ProductManagementContainer` su click bottone
 * "Vendita rapida" (Step 6.6 wiring).
 */
@Component({
  selector: 'app-quick-sale-container',
  standalone: true,
  imports: [CommonModule, QuickSaleFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-quick-sale-form
      [products]="activeProducts"
      [loading]="loading"
      [error]="error"
      (submitSale)="onSubmitSale($event)"
      (cancel)="onCancel()">
    </app-quick-sale-form>
  `,
})
export class QuickSaleContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeProducts: Product[] = [];
  loading = false;
  error: string | null = null;

  /** Notifica esito al parent (per snackbar / refresh). */
  @Output() saleCompleted = new EventEmitter<SaleCompletedResult>();
  /** Notifica chiusura form (per smontaggio overlay parent). */
  @Output() closed = new EventEmitter<void>();

  constructor(
    private readonly productService: ProductService,
    private readonly ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.loadActiveProducts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadActiveProducts(): void {
    this.loading = true;
    this.productService
      .getProductsOnce(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.activeProducts = products;
          this.loading = false;
        },
        error: (err) => {
          console.error('[QuickSale] errore loadActiveProducts', err);
          this.error = 'Impossibile caricare il catalogo prodotti.';
          this.loading = false;
        },
      });
  }

  onSubmitSale(input: RecordProductSaleInput): void {
    this.loading = true;
    this.error = null;

    this.productService
      .recordProductSale(input)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.ngZone.run(() => {
            this.loading = false;
            this.saleCompleted.emit(result);
            this.closed.emit();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            console.error('[QuickSale] errore recordProductSale', err);
            const gqlMsg = err?.graphQLErrors?.[0]?.message;
            this.error = gqlMsg ? `Errore: ${gqlMsg}` : 'Errore durante la registrazione vendita';
            this.loading = false;
          });
        },
      });
  }

  onCancel(): void {
    this.closed.emit();
  }
}

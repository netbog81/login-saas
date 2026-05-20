import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { ProductListComponent } from '../components/product-list/product-list.component';
import { ProductFormComponent } from '../components/product-form/product-form.component';
import { QuickSaleContainer } from './quick-sale.container';
import { ProductService } from '../services/product.service';
import { Product } from '../models/product.model';
import {
  CreateProductInput,
  SaleCompletedResult,
  UpdateProductInput,
} from '../models/product-input.model';

/**
 * ProductManagementContainer — Layer 2 (Smart).
 *
 * Coordinatore dell'UI prodotti:
 *  - Carica la lista (one-shot al boot, refetch dopo mutazioni)
 *  - Apre/chiude il form modale
 *  - Delega create/update/delete al service
 *  - Gestisce loading + error + selezione locale
 *
 * I dumb components (`ProductListComponent`, `ProductFormComponent`) NON
 * iniettano nulla: ricevono Input + emettono Output. Il container è
 * l'unico punto che parla con il `ProductService`.
 */
@Component({
  selector: 'app-product-management-container',
  standalone: true,
  imports: [CommonModule, ProductListComponent, ProductFormComponent, QuickSaleContainer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="quick-sale-bar">
      <button class="btn btn-success" (click)="onOpenQuickSale()">
        💰 Vendita rapida prodotto
      </button>
      <span *ngIf="lastSale" class="last-sale-hint">
        Ultima vendita: {{ lastSale.saleId.substring(0, 8) }}…
        ({{ lastSale.totalAmount.toFixed(2) }} €) — pubblicata
      </span>
    </div>

    <app-product-list
      [products]="products"
      [loading]="loading"
      [searchTerm]="searchTerm"
      [showInactive]="showInactive"
      [selectedId]="selectedProduct?.id ?? null"
      (searchTermChange)="onSearchChange($event)"
      (showInactiveChange)="onShowInactiveChange($event)"
      (select)="onSelect($event)"
      (create)="onCreate()"
      (edit)="onEdit($event)"
      (delete)="onDelete($event)">
    </app-product-list>

    <app-product-form
      *ngIf="showForm"
      [initial]="editing"
      [loading]="loading"
      [error]="formError"
      (save)="onSave($event)"
      (cancel)="onCancelForm()">
    </app-product-form>

    <app-quick-sale-container
      *ngIf="showQuickSale"
      (saleCompleted)="onSaleCompleted($event)"
      (closed)="onQuickSaleClosed()">
    </app-quick-sale-container>
  `,
  styles: [`
    .quick-sale-bar {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 8px 16px;
      background: #f7faff;
      border-bottom: 1px solid #e0e0e0;
    }
    .btn-success {
      padding: 8px 16px;
      border: 1px solid #2a7e2a;
      background: #2a7e2a;
      color: #fff;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.95em;
      &:hover { background: #1f6020; }
    }
    .last-sale-hint {
      font-size: 0.85em;
      color: #555;
    }
  `],
})
export class ProductManagementContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // UI state
  products: Product[] = [];
  loading = false;
  searchTerm = '';
  showInactive = false;
  selectedProduct: Product | null = null;

  // Form state
  showForm = false;
  editing: Product | null = null;
  formError: string | null = null;

  // Quick-sale state (Step 6.6)
  showQuickSale = false;
  lastSale: SaleCompletedResult | null = null;

  constructor(
    private readonly productService: ProductService,
    private readonly ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ────────── load ──────────
  private loadProducts(): void {
    this.loading = true;
    this.productService
      .getProductsOnce(false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.products = products;
          this.loading = false;
        },
        error: (err) => {
          console.error('[ProductManagement] errore loadProducts', err);
          this.loading = false;
        },
      });
  }

  // ────────── filter handlers ──────────
  onSearchChange(value: string): void {
    this.searchTerm = value;
  }
  onShowInactiveChange(value: boolean): void {
    this.showInactive = value;
  }

  // ────────── selection / form open ──────────
  onSelect(p: Product): void {
    this.selectedProduct = p;
  }

  onCreate(): void {
    this.ngZone.run(() => {
      this.editing = null;
      this.formError = null;
      this.showForm = true;
    });
  }

  onEdit(p: Product): void {
    this.ngZone.run(() => {
      this.editing = p;
      this.formError = null;
      this.showForm = true;
    });
  }

  onCancelForm(): void {
    this.ngZone.run(() => {
      this.showForm = false;
      this.editing = null;
      this.formError = null;
    });
  }

  // ────────── quick-sale handlers (Step 6.6) ──────────
  onOpenQuickSale(): void {
    this.ngZone.run(() => {
      this.showQuickSale = true;
    });
  }

  onQuickSaleClosed(): void {
    this.ngZone.run(() => {
      this.showQuickSale = false;
    });
  }

  onSaleCompleted(result: SaleCompletedResult): void {
    this.ngZone.run(() => {
      this.lastSale = result;
      this.showQuickSale = false;
      // NB: nessun refresh lista prodotti richiesto — la vendita non
      // modifica i Product (lo storico vive su accounting come BillableEvent).
    });
  }

  // ────────── save (create or update) ──────────
  onSave(payload: CreateProductInput | UpdateProductInput): void {
    this.loading = true;
    this.formError = null;

    if (this.editing) {
      // Update
      this.productService
        .update(this.editing.id, payload as UpdateProductInput)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (updated) => this.onSaveSuccess(updated, /*isCreate*/ false),
          error: (err) => this.onSaveError(err, 'aggiornamento'),
        });
    } else {
      // Create
      this.productService
        .create(payload as CreateProductInput)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (created) => this.onSaveSuccess(created, /*isCreate*/ true),
          error: (err) => this.onSaveError(err, 'creazione'),
        });
    }
  }

  private onSaveSuccess(p: Product, isCreate: boolean): void {
    this.ngZone.run(() => {
      if (isCreate) {
        this.products = [...this.products, p];
      } else {
        this.products = this.products.map((x) => (x.id === p.id ? p : x));
      }
      this.loading = false;
      this.showForm = false;
      this.editing = null;
      this.formError = null;
    });
  }

  private onSaveError(err: any, op: string): void {
    this.ngZone.run(() => {
      console.error(`[ProductManagement] errore ${op}`, err);
      const gqlMsg = err?.graphQLErrors?.[0]?.message;
      this.formError = gqlMsg ? `Errore: ${gqlMsg}` : `Errore durante ${op} del prodotto`;
      this.loading = false;
    });
  }

  // ────────── delete (soft) ──────────
  onDelete(p: Product): void {
    this.ngZone.run(() => {
      const ok = confirm(
        `Disattivare il prodotto "${p.name}" (${p.productCode})?\n\n` +
          `Il prodotto sarà marcato come inattivo (isActive=false). ` +
          `Le vendite storiche restano nel sistema.`,
      );
      if (!ok) return;

      this.loading = true;
      this.productService
        .delete(p.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.ngZone.run(() => {
              // Reflect soft-delete localmente: marca isActive=false.
              this.products = this.products.map((x) =>
                x.id === p.id ? { ...x, isActive: false } : x,
              );
              if (this.selectedProduct?.id === p.id) {
                this.selectedProduct = null;
              }
              this.loading = false;
            });
          },
          error: (err) => {
            console.error('[ProductManagement] errore delete', err);
            this.loading = false;
          },
        });
    });
  }
}

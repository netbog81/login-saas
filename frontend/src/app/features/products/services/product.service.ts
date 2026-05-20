import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';

import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import {
  CREATE_PRODUCT,
  DELETE_PRODUCT,
  GET_PRODUCT,
  GET_PRODUCTS,
  RECORD_PRODUCT_SALE,
  UPDATE_PRODUCT,
} from '../graphql/product.operations';
import { Product } from '../models/product.model';
import {
  CreateProductInput,
  RecordProductSaleInput,
  SaleCompletedResult,
  UpdateProductInput,
} from '../models/product-input.model';

/**
 * ProductService — Layer 3 (Business logic + GraphQL).
 *
 * APPROACH FK: nessuna foreign key — Product è entità autonoma.
 * REASON: catalogo standalone, niente relazioni da risolvere.
 *
 * Pattern publish-after-commit: ogni create/update/delete fa il publish
 * di `product.*` lato backend (sessione 6 Step 7.6). Lato frontend
 * basta refetchQueries di `GET_PRODUCTS` per aggiornare la UI.
 *
 * NgZone: tutte le operazioni passano da BaseGraphQLService che wrappa
 * Apollo via ApolloZoneService — nessun apollo.query() diretto.
 */
@Injectable({ providedIn: 'root' })
export class ProductService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /** Lista prodotti reattiva (watch). Default: tutti, anche inattivi. */
  getProducts(onlyActive = false): Observable<Product[]> {
    return this.watch<{ products: Product[] }>(GET_PRODUCTS, { onlyActive }).pipe(
      map((result) => (result.products || []) as Product[]),
    );
  }

  /** Lista prodotti one-shot (utile per forkJoin / vendita rapida). */
  getProductsOnce(onlyActive = false): Observable<Product[]> {
    return this.query<{ products: Product[] }>(GET_PRODUCTS, { onlyActive }).pipe(
      map((result) => (result.products || []) as Product[]),
    );
  }

  getProduct(id: string): Observable<Product | null> {
    return this.watch<{ product: Product | null }>(GET_PRODUCT, { id }).pipe(
      map((result) => (result.product || null) as Product | null),
    );
  }

  create(input: CreateProductInput): Observable<Product> {
    return this.mutate<{ createProduct: Product }>(
      CREATE_PRODUCT,
      input as unknown as Record<string, unknown>,
      [{ query: GET_PRODUCTS, variables: { onlyActive: false } }],
    ).pipe(
      map((result) => {
        if (!result.createProduct) {
          throw new Error('Failed to create product');
        }
        return result.createProduct;
      }),
    );
  }

  update(id: string, input: UpdateProductInput): Observable<Product> {
    return this.mutate<{ updateProduct: Product }>(
      UPDATE_PRODUCT,
      { id, ...input } as unknown as Record<string, unknown>,
      [
        { query: GET_PRODUCTS, variables: { onlyActive: false } },
        { query: GET_PRODUCT, variables: { id } },
      ],
    ).pipe(
      map((result) => {
        if (!result.updateProduct) {
          throw new Error('Failed to update product');
        }
        return result.updateProduct;
      }),
    );
  }

  /**
   * Soft-delete: il backend marca `isActive=false`. Il record resta
   * visibile se la lista è in mode "showInactive=true".
   */
  delete(id: string): Observable<boolean> {
    return this.mutate<{ deleteProduct: boolean }>(
      DELETE_PRODUCT,
      { id },
      [{ query: GET_PRODUCTS, variables: { onlyActive: false } }],
    ).pipe(
      map((result) => {
        if (result.deleteProduct === undefined) {
          throw new Error('Failed to delete product');
        }
        return result.deleteProduct;
      }),
    );
  }

  /**
   * Vendita rapida prodotto standalone — pubblica `sale.completed.<tenant>`
   * verso accounting. Default `requestImmediateInvoice=true` (vedi backend
   * Step 7.5) → AutoIssue se mapping prodotto fiscalmente configurato.
   *
   * Lato clinico nessun record viene persistito (lo storico authoritative
   * vive su accounting come BillableEvent + SalesDocument). Il `saleId`
   * ritornato è la business key per audit/log.
   */
  recordProductSale(input: RecordProductSaleInput): Observable<SaleCompletedResult> {
    return this.mutate<{ recordProductSale: SaleCompletedResult }>(
      RECORD_PRODUCT_SALE,
      { input } as unknown as Record<string, unknown>,
    ).pipe(
      map((result) => {
        if (!result.recordProductSale) {
          throw new Error('Failed to record product sale');
        }
        return result.recordProductSale;
      }),
    );
  }
}

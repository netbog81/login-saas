/**
 * Modello del dominio Product (catalogo vendita rapida).
 *
 * Domain-level interface (NON re-export di `generated/types`): pattern
 * coerente con `features/operators-new/models/`. Riduce coupling al codegen
 * e permette commenti specifici del dominio.
 *
 * Usato dal `ProductService` per ritornare oggetti tipati ai container.
 * Mappato dal type GraphQL `Product` di `generated/types.ts`.
 */
export interface Product {
  id: string;
  productCode: string;
  name: string;
  description?: string | null;
  defaultPrice: number;
  category?: string | null;
  isActive: boolean;
  createdByUserId?: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

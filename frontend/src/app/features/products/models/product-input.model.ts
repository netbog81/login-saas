/**
 * Input models per le mutation Product.
 *
 * Niente foreign keys (Product è entità autonoma): coerente con il file
 * architettura sezione "REGOLE UPDATE FOREIGN KEYS" — non si applica qui.
 */

export interface CreateProductInput {
  productCode: string;
  name: string;
  defaultPrice: number;
  description?: string | null;
  category?: string | null;
  isActive?: boolean | null;
}

export interface UpdateProductInput {
  productCode?: string | null;
  name?: string | null;
  defaultPrice?: number | null;
  description?: string | null;
  category?: string | null;
  isActive?: boolean | null;
}

// ==================== VENDITA RAPIDA (Step 6.6) ====================

/**
 * Riga vendita rapida — singolo prodotto in cassa.
 * `unitPriceOverride` opzionale: se omesso, backend usa
 * `Product.defaultPrice` corrente.
 */
export interface SaleProductLineInput {
  productId: string;
  quantity: number;
  unitPriceOverride?: number | null;
}

/**
 * Input mutation `recordProductSale` (sessione 6 Step 7.5 backend).
 *
 * NB: `siteId` opzionale — backend fallback alla prima sede attiva.
 * `purchaserSubjectId` ≠ `beneficiarySubjectId` per supporto regalo;
 * UI MVP li coincide.
 */
export interface RecordProductSaleInput {
  siteId?: string | null;
  purchaserSubjectId: string;
  beneficiarySubjectId: string;
  lines: SaleProductLineInput[];
  isPaid: boolean;
  paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER' | 'SATISPAY' | 'OTHER' | null;
  /** Default true lato backend → AutoIssue accounting (se mapping configurato). */
  requestImmediateInvoice?: boolean | null;
  notes?: string | null;
}

export interface SaleCompletedResult {
  saleId: string;
  publishedAt: string; // ISO
  totalAmount: number;
}

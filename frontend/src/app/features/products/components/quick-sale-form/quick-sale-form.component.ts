import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Product } from '../../models/product.model';
import {
  RecordProductSaleInput,
  SaleProductLineInput,
} from '../../models/product-input.model';

/**
 * QuickSaleFormComponent — Layer 1 (Dumb).
 *
 * Form vendita rapida prodotto: l'operatore segretaria seleziona uno o
 * più prodotti dal catalogo + quantità + (opz.) override prezzo +
 * payment method. Niente `Apollo`, niente service.
 *
 * Per MVP: paziente acquirente uguale a beneficiario (1 input
 * `purchaserSubjectId`). Per regali/familiari il container può essere
 * esteso con un secondo input.
 *
 * Validazione minima nel dumb: almeno una riga + qty>0 + price>=0 +
 * subjectId UUID-shaped. Validazione hard sta backend.
 */

interface DraftLine {
  productId: string;
  quantity: number;
  unitPriceOverride: number | null;
}

/** Allineato a `PaymentMethod` enum backend (treatment-enums.ts). */
type PaymentMethodCode = 'CASH' | 'CARD' | 'TRANSFER' | 'SATISPAY' | 'OTHER';

@Component({
  selector: 'app-quick-sale-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quick-sale-form.component.html',
  styleUrls: ['./quick-sale-form.component.scss'],
})
export class QuickSaleFormComponent implements OnChanges {
  /** Catalogo prodotti vendibili (pre-filtrato `isActive=true` dal container). */
  @Input({ required: true }) products: Product[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;

  @Output() submitSale = new EventEmitter<RecordProductSaleInput>();
  @Output() cancel = new EventEmitter<void>();

  // State locale
  purchaserSubjectId = '';
  draftLines: DraftLine[] = [{ productId: '', quantity: 1, unitPriceOverride: null }];
  isPaid = true;
  paymentMethod: PaymentMethodCode = 'CASH';
  requestImmediateInvoice = true;
  notes = '';

  paymentMethods: ReadonlyArray<{ value: PaymentMethodCode; label: string }> = [
    { value: 'CASH', label: 'Contanti' },
    { value: 'CARD', label: 'Bancomat / Carta' },
    { value: 'TRANSFER', label: 'Bonifico' },
    { value: 'SATISPAY', label: 'Satispay' },
    { value: 'OTHER', label: 'Altro' },
  ];

  ngOnChanges(_changes: SimpleChanges): void {
    // Niente reset automatico al cambio Input — preserva input utente
    // se products viene rifrescato durante la digitazione.
  }

  addLine(): void {
    this.draftLines = [
      ...this.draftLines,
      { productId: '', quantity: 1, unitPriceOverride: null },
    ];
  }

  removeLine(idx: number): void {
    this.draftLines = this.draftLines.filter((_, i) => i !== idx);
    if (this.draftLines.length === 0) {
      this.addLine(); // Garantisce sempre almeno una riga
    }
  }

  trackByLineIndex(idx: number): number {
    return idx;
  }

  /** Prodotto selezionato per riga (per mostrare nome + prezzo default). */
  productById(productId: string): Product | undefined {
    return this.products.find((p) => p.id === productId);
  }

  /** Prezzo effettivo applicato a una riga (override OR default). */
  effectiveUnitPrice(line: DraftLine): number {
    if (line.unitPriceOverride !== null && line.unitPriceOverride !== undefined) {
      return line.unitPriceOverride;
    }
    const p = this.productById(line.productId);
    return p?.defaultPrice ?? 0;
  }

  lineTotal(line: DraftLine): number {
    return this.effectiveUnitPrice(line) * (line.quantity || 0);
  }

  get grandTotal(): number {
    return this.draftLines.reduce((acc, l) => acc + this.lineTotal(l), 0);
  }

  formatPrice(p: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(p);
  }

  onSubmit(): void {
    const purchaser = this.purchaserSubjectId.trim();
    if (!purchaser) {
      this.error = 'Subject paziente acquirente è obbligatorio.';
      return;
    }

    const validLines: SaleProductLineInput[] = [];
    for (const line of this.draftLines) {
      if (!line.productId) continue;
      if (!line.quantity || line.quantity <= 0) {
        this.error = 'Ogni riga deve avere quantità > 0.';
        return;
      }
      if (line.unitPriceOverride !== null && line.unitPriceOverride < 0) {
        this.error = 'Prezzo override non può essere negativo.';
        return;
      }
      validLines.push({
        productId: line.productId,
        quantity: line.quantity,
        unitPriceOverride:
          line.unitPriceOverride !== null && line.unitPriceOverride !== undefined
            ? line.unitPriceOverride
            : null,
      });
    }

    if (validLines.length === 0) {
      this.error = 'Almeno una riga prodotto è richiesta.';
      return;
    }

    const payload: RecordProductSaleInput = {
      // siteId omesso → backend fallback alla prima sede attiva.
      purchaserSubjectId: purchaser,
      beneficiarySubjectId: purchaser, // MVP: coincide col purchaser
      lines: validLines,
      isPaid: this.isPaid,
      paymentMethod: this.isPaid ? this.paymentMethod : null,
      requestImmediateInvoice: this.requestImmediateInvoice,
      notes: this.notes.trim() || null,
    };

    this.error = null;
    this.submitSale.emit(payload);
  }

  onCancel(): void {
    this.cancel.emit();
  }
}

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
  CreateProductInput,
  UpdateProductInput,
} from '../../models/product-input.model';

/**
 * ProductFormComponent — Layer 1 (Dumb).
 *
 * Modal form per create/edit Product. Riceve `initial` (Product per edit,
 * undefined per create), gestisce stato locale del form, emette `save`
 * con il payload Input pulito.
 *
 * Validazione client-side minimale (campi non vuoti + price >= 0). La
 * validazione hard sta lato backend (UNIQUE constraint, BadRequestException).
 */
@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.scss'],
})
export class ProductFormComponent implements OnChanges {
  @Input() initial: Product | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;

  @Output() save = new EventEmitter<CreateProductInput | UpdateProductInput>();
  @Output() cancel = new EventEmitter<void>();

  // State locale del form
  productCode = '';
  name = '';
  defaultPrice = 0;
  description = '';
  category = '';
  isActive = true;

  // Per il titolo + button label
  get isEditMode(): boolean {
    return this.initial !== null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initial']) {
      this.resetFromInitial();
    }
  }

  private resetFromInitial(): void {
    if (this.initial) {
      this.productCode = this.initial.productCode;
      this.name = this.initial.name;
      this.defaultPrice = this.initial.defaultPrice;
      this.description = this.initial.description ?? '';
      this.category = this.initial.category ?? '';
      this.isActive = this.initial.isActive;
    } else {
      this.productCode = '';
      this.name = '';
      this.defaultPrice = 0;
      this.description = '';
      this.category = '';
      this.isActive = true;
    }
  }

  onSubmit(): void {
    const code = this.productCode.trim();
    const nm = this.name.trim();
    if (!code) {
      this.error = 'Codice prodotto è obbligatorio';
      return;
    }
    if (!nm) {
      this.error = 'Nome prodotto è obbligatorio';
      return;
    }
    if (this.defaultPrice === null || this.defaultPrice === undefined) {
      this.error = 'Prezzo di default è obbligatorio';
      return;
    }
    if (this.defaultPrice < 0) {
      this.error = 'Prezzo di default non può essere negativo';
      return;
    }

    const payload: CreateProductInput | UpdateProductInput = {
      productCode: code,
      name: nm,
      defaultPrice: this.defaultPrice,
      description: this.description.trim() || null,
      category: this.category.trim() || null,
      isActive: this.isActive,
    };
    this.save.emit(payload);
  }

  onCancel(): void {
    this.cancel.emit();
  }
}

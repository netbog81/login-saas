import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Product } from '../../models/product.model';

/**
 * ProductListComponent — Layer 1 (Dumb).
 *
 * Riceve `products` + filtri come Input, emette eventi per ogni azione.
 * NESSUNA chiamata Apollo, nessuna business logic, nessun service iniettato.
 * OnPush change detection per performance (lista può crescere).
 */
@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss'],
})
export class ProductListComponent {
  @Input() products: Product[] = [];
  @Input() loading = false;
  @Input() searchTerm = '';
  @Input() showInactive = false;
  @Input() selectedId: string | null = null;

  @Output() searchTermChange = new EventEmitter<string>();
  @Output() showInactiveChange = new EventEmitter<boolean>();
  @Output() select = new EventEmitter<Product>();
  @Output() create = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Product>();
  @Output() delete = new EventEmitter<Product>();

  trackById(_idx: number, p: Product): string {
    return p.id;
  }

  formatPrice(p: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(p);
  }

  // Filtering inline (UI-state only, niente service): l'array `products`
  // arriva già completo dal container; mostriamo solo quelli che matchano.
  get visibleProducts(): Product[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.products.filter((p) => {
      if (!this.showInactive && !p.isActive) return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        p.productCode.toLowerCase().includes(term) ||
        (p.category ?? '').toLowerCase().includes(term)
      );
    });
  }
}

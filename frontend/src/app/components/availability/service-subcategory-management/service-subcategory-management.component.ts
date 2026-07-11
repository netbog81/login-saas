import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ServiceSubcategoryService, ServiceSubcategory } from '../../../services/service-subcategory.service';
import { OperatorMacroCategory } from '../../../graphql/generated/types';

@Component({
  selector: 'app-service-subcategory-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './service-subcategory-management.component.html',
  styleUrls: ['./service-subcategory-management.component.scss']
})
export class ServiceSubcategoryManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  subcategories: ServiceSubcategory[] = [];

  // Filters
  filterMacroCategory: OperatorMacroCategory | null = null;
  showInactive = false;

  // Form State
  showSubcategoryForm = false;
  isEditMode = false;
  editingSubcategoryId: string | null = null;
  editingSubcategory = {
    macroCategory: OperatorMacroCategory.Physiotherapist,
    name: '',
    description: '',
    invoiceLineDescription: '',
    isActive: true
  };

  // UI State
  loading = false;
  error: string | null = null;

  // Macro categories
  macroCategories = [
    OperatorMacroCategory.Doctor,
    OperatorMacroCategory.Physiotherapist,
    OperatorMacroCategory.GymInstructor,
    OperatorMacroCategory.Other
  ];

  macroCategoryLabels: Record<string, string> = {
    [OperatorMacroCategory.Doctor]: 'Medici',
    [OperatorMacroCategory.Physiotherapist]: 'Fisioterapisti',
    [OperatorMacroCategory.GymInstructor]: 'Istruttori Palestra',
    [OperatorMacroCategory.Other]: 'Altro'
  };

  // Overlay click tracking (per evitare chiusura durante click-and-drag)
  overlayMouseDownTarget: EventTarget | null = null;

  constructor(
    private subcategoryService: ServiceSubcategoryService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.loadSubcategories();
  }

  get filteredSubcategories(): ServiceSubcategory[] {
    return this.subcategories.filter(sub => {
      const matchesMacro = !this.filterMacroCategory || sub.macroCategory === this.filterMacroCategory;
      const matchesActive = this.showInactive || sub.isActive;
      return matchesMacro && matchesActive;
    });
  }

  loadSubcategories() {
    this.loading = true;
    this.subcategoryService.getServiceSubcategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (subcategories) => {
          this.subcategories = subcategories;
          this.loading = false;
        },
        error: () => {
          this.error = 'Errore nel caricamento delle sotto-categorie';
          this.loading = false;
        }
      });
  }

  openSubcategoryForm(subcategory?: ServiceSubcategory) {
    this.ngZone.run(() => {
      if (subcategory) {
        this.isEditMode = true;
        this.editingSubcategoryId = subcategory.id;
        this.editingSubcategory = {
          macroCategory: subcategory.macroCategory,
          name: subcategory.name,
          description: subcategory.description || '',
          invoiceLineDescription: subcategory.invoiceLineDescription || '',
          isActive: subcategory.isActive
        };
      } else {
        this.isEditMode = false;
        this.editingSubcategoryId = null;
        this.editingSubcategory = {
          macroCategory: this.filterMacroCategory || OperatorMacroCategory.Physiotherapist,
          name: '',
          description: '',
          invoiceLineDescription: '',
          isActive: true
        };
      }
      this.showSubcategoryForm = true;
      this.error = null;
    });
  }

  closeSubcategoryForm() {
    this.ngZone.run(() => {
      this.showSubcategoryForm = false;
      this.editingSubcategoryId = null;
      this.error = null;
    });
  }

  saveSubcategory() {
    const name = this.editingSubcategory.name?.trim();
    if (!name) {
      this.error = 'Il nome è obbligatorio';
      return;
    }

    this.loading = true;

    if (this.isEditMode && this.editingSubcategoryId) {
      this.subcategoryService.updateServiceSubcategory(
        this.editingSubcategoryId,
        name,
        this.editingSubcategory.description?.trim() || undefined,
        this.editingSubcategory.isActive,
        this.editingSubcategory.invoiceLineDescription?.trim() || undefined
      ).pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadSubcategories();
            this.closeSubcategoryForm();
          },
          error: () => {
            this.error = 'Errore nell\'aggiornamento della sotto-categoria';
            this.loading = false;
          }
        });
    } else {
      this.subcategoryService.createServiceSubcategory(
        this.editingSubcategory.macroCategory,
        name,
        this.editingSubcategory.description?.trim() || undefined,
        this.editingSubcategory.invoiceLineDescription?.trim() || undefined
      ).pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadSubcategories();
            this.closeSubcategoryForm();
          },
          error: () => {
            this.error = 'Errore nella creazione della sotto-categoria';
            this.loading = false;
          }
        });
    }
  }

  deleteSubcategory(subcategory: ServiceSubcategory) {
    this.ngZone.run(() => {
      if (!confirm(`Sei sicuro di voler eliminare la sotto-categoria "${subcategory.name}"?`)) {
        return;
      }

      this.loading = true;
      this.subcategoryService.deleteServiceSubcategory(subcategory.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.ngZone.run(() => this.loadSubcategories());
          },
          error: () => {
            this.ngZone.run(() => {
              this.error = 'Errore nell\'eliminazione della sotto-categoria';
              this.loading = false;
            });
          }
        });
    });
  }

  getSubcategoryCount(macroCategory: OperatorMacroCategory): number {
    return this.subcategories.filter(s => s.macroCategory === macroCategory).length;
  }

  setFilterMacroCategory(category: OperatorMacroCategory | null) {
    this.ngZone.run(() => {
      this.filterMacroCategory = category;
    });
  }

  toggleShowInactive() {
    this.ngZone.run(() => {
      this.showInactive = !this.showInactive;
    });
  }

  // Overlay click handlers (previene chiusura durante selezione testo con click-and-drag)
  onOverlayMouseDown(event: MouseEvent): void {
    this.overlayMouseDownTarget = event.target;
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.overlayMouseDownTarget === event.currentTarget &&
        event.target === event.currentTarget) {
      this.closeSubcategoryForm();
    }
    this.overlayMouseDownTarget = null;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

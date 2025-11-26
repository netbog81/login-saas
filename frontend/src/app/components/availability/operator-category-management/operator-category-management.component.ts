import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperatorCategoryService } from '../../../services/operator-category.service';
import {
  OperatorCategory,
  OperatorMacroCategory,
  CreateOperatorCategoryInput,
  UpdateOperatorCategoryInput,
  getMacroCategoryLabel,
} from '../../../graphql/types';
import { catchError, finalize, of } from 'rxjs';

@Component({
  selector: 'app-operator-category-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './operator-category-management.component.html',
  styleUrls: ['./operator-category-management.component.scss'],
})
export class OperatorCategoryManagementComponent implements OnInit {
  categories: OperatorCategory[] = [];
  filteredCategories: OperatorCategory[] = [];
  loading = false;
  error: string | null = null;

  // Filter
  filterMacroCategory: OperatorMacroCategory | null = null;

  // Form state
  showCategoryForm = false;
  isEditMode = false;
  editingCategoryId: string | null = null;
  editingCategory: Partial<CreateOperatorCategoryInput> & {
    isActive?: boolean;
  } = {
    macroCategory: OperatorMacroCategory.PHYSIOTHERAPIST,
    name: '',
    description: '',
  };

  // Expose enum to template
  OperatorMacroCategory = OperatorMacroCategory;

  constructor(private categoryService: OperatorCategoryService) {}

  ngOnInit() {
    this.loadCategories();
  }

  loadCategories() {
    this.loading = true;
    this.error = null;

    this.categoryService
      .getOperatorCategories()
      .pipe(
        catchError((err) => {
          this.error = 'Errore nel caricamento delle categorie: ' + err.message;
          return of([]);
        }),
        finalize(() => (this.loading = false))
      )
      .subscribe((categories) => {
        this.categories = categories;
        this.applyFilter();
      });
  }

  applyFilter() {
    if (this.filterMacroCategory) {
      this.filteredCategories = this.categories.filter(
        (c) => c.macroCategory === this.filterMacroCategory
      );
    } else {
      this.filteredCategories = [...this.categories];
    }
  }

  onFilterChange() {
    this.applyFilter();
  }

  openCategoryForm(category?: OperatorCategory) {
    if (category) {
      this.isEditMode = true;
      this.editingCategoryId = category.id;
      this.editingCategory = {
        macroCategory: category.macroCategory,
        name: category.name,
        description: category.description,
        isActive: category.isActive,
      };
    } else {
      this.isEditMode = false;
      this.editingCategoryId = null;
      this.editingCategory = {
        macroCategory: OperatorMacroCategory.PHYSIOTHERAPIST,
        name: '',
        description: '',
        isActive: true,
      };
    }
    this.showCategoryForm = true;
    this.error = null;
  }

  closeCategoryForm() {
    this.showCategoryForm = false;
    this.isEditMode = false;
    this.editingCategoryId = null;
    this.editingCategory = {
      macroCategory: OperatorMacroCategory.PHYSIOTHERAPIST,
      name: '',
      description: '',
    };
    this.error = null;
  }

  saveCategory() {
    const name = this.editingCategory.name?.trim();

    if (!name) {
      this.error = 'Il nome è obbligatorio';
      return;
    }

    if (!this.editingCategory.macroCategory) {
      this.error = 'La macro categoria è obbligatoria';
      return;
    }

    this.loading = true;
    this.error = null;

    if (this.isEditMode && this.editingCategoryId) {
      // Update existing category
      const input: UpdateOperatorCategoryInput = {
        name: name,
        description: this.editingCategory.description?.trim(),
        macroCategory: this.editingCategory.macroCategory,
        isActive: this.editingCategory.isActive,
      };

      this.categoryService
        .updateOperatorCategory(this.editingCategoryId, input)
        .pipe(
          catchError((err) => {
            const errorMsg =
              err?.error?.message || err?.message || 'Errore sconosciuto';
            this.error = `Errore durante l'aggiornamento: ${errorMsg}`;
            this.loading = false;
            return of(null);
          }),
          finalize(() => (this.loading = false))
        )
        .subscribe((category) => {
          if (category) {
            this.loadCategories();
            this.closeCategoryForm();
          }
        });
    } else {
      // Create new category
      const input: CreateOperatorCategoryInput = {
        macroCategory: this.editingCategory.macroCategory!,
        name: name,
        description: this.editingCategory.description?.trim(),
      };

      this.categoryService
        .createOperatorCategory(input)
        .pipe(
          catchError((err) => {
            const errorMsg =
              err?.error?.message || err?.message || 'Errore sconosciuto';
            this.error = `Errore durante la creazione: ${errorMsg}`;
            this.loading = false;
            return of(null);
          }),
          finalize(() => (this.loading = false))
        )
        .subscribe((category) => {
          if (category) {
            this.loadCategories();
            this.closeCategoryForm();
          }
        });
    }
  }

  deleteCategory(category: OperatorCategory) {
    if (category.operators && category.operators.length > 0) {
      alert(
        `Impossibile eliminare: questa categoria è utilizzata da ${category.operators.length} operatore/i.\n` +
          'Rimuovi prima le assegnazioni agli operatori.'
      );
      return;
    }

    if (
      !confirm(`Sei sicuro di voler eliminare la categoria "${category.name}"?`)
    ) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.categoryService
      .deleteOperatorCategory(category.id)
      .pipe(
        catchError((err) => {
          const errorMsg =
            err?.error?.message || err?.message || 'Errore sconosciuto';
          this.error = `Errore durante l'eliminazione: ${errorMsg}`;
          this.loading = false;
          return of(false);
        }),
        finalize(() => (this.loading = false))
      )
      .subscribe((success) => {
        if (success) {
          this.loadCategories();
        }
      });
  }

  toggleCategoryActive(category: OperatorCategory) {
    this.loading = true;
    this.error = null;

    const input: UpdateOperatorCategoryInput = {
      isActive: !category.isActive,
    };

    this.categoryService
      .updateOperatorCategory(category.id, input)
      .pipe(
        catchError((err) => {
          const errorMsg =
            err?.error?.message || err?.message || 'Errore sconosciuto';
          this.error = `Errore durante l'aggiornamento: ${errorMsg}`;
          this.loading = false;
          return of(null);
        }),
        finalize(() => (this.loading = false))
      )
      .subscribe((updatedCategory) => {
        if (updatedCategory) {
          this.loadCategories();
        }
      });
  }

  getMacroCategoryLabel(macroCategory: OperatorMacroCategory): string {
    return getMacroCategoryLabel(macroCategory);
  }

  getCategoryCount(macroCategory: OperatorMacroCategory): number {
    return this.categories.filter((c) => c.macroCategory === macroCategory)
      .length;
  }
}

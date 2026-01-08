import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { InstrumentService, CreateInstrumentInput, UpdateInstrumentInput, CreateInstrumentCategoryInput, UpdateInstrumentCategoryInput } from '../../../services/instrument.service';
import {
  Instrument,
  InstrumentCategory,
  InstrumentStatus,
  OperatorMacroCategory,
} from '../../../graphql/generated/types';
import { getMacroCategoryLabel } from '../../../graphql/types';

@Component({
  selector: 'app-instrumentation-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './instrumentation-management.component.html',
  styleUrls: ['./instrumentation-management.component.scss'],
})
export class InstrumentationManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  categories: InstrumentCategory[] = [];
  instruments: Instrument[] = [];

  // Filters
  selectedMacroCategory: OperatorMacroCategory = OperatorMacroCategory.Physiotherapist;
  selectedCategoryFilter: string | null = null;
  selectedStatusFilter: InstrumentStatus | null = null;

  // UI State
  loading = false;
  error: string | null = null;

  // Category Form
  showCategoryForm = false;
  isEditingCategory = false;
  editingCategoryId: string | null = null;
  editingCategory: CreateInstrumentCategoryInput & { isActive?: boolean } = {
    name: '',
    description: '',
    macroCategory: OperatorMacroCategory.Physiotherapist,
    isActive: true,
  };

  // Instrument Form
  showInstrumentForm = false;
  isEditingInstrument = false;
  editingInstrumentId: string | null = null;
  editingInstrument: CreateInstrumentInput & { status?: InstrumentStatus; isActive?: boolean } = {
    categoryId: '',
    name: '',
    brand: '',
    model: '',
    color: '#4A90E2',
    verificationExpiry: undefined,
    status: InstrumentStatus.Active,
    isActive: true,
  };
  verificationExpiryString = '';

  // Expose enums to template
  OperatorMacroCategory = OperatorMacroCategory;
  InstrumentStatus = InstrumentStatus;

  constructor(
    private instrumentService: InstrumentService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.loadCategories();
    this.loadInstruments();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============ DATA LOADING ============

  loadCategories() {
    this.loading = true;
    this.instrumentService.getInstrumentCategories(this.selectedMacroCategory)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.categories = categories;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading categories:', error);
          this.error = 'Errore nel caricamento delle categorie';
          this.loading = false;
        },
      });
  }

  loadInstruments() {
    this.loading = true;
    const categoryId = this.selectedCategoryFilter || undefined;
    const status = this.selectedStatusFilter || undefined;

    this.instrumentService.getInstruments(categoryId, status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (instruments) => {
          // Filter by macroCategory since the API doesn't support it directly
          this.instruments = instruments.filter(
            (i) => i.category?.macroCategory === this.selectedMacroCategory
          );
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading instruments:', error);
          this.error = 'Errore nel caricamento degli strumenti';
          this.loading = false;
        },
      });
  }

  // ============ FILTER HANDLERS ============

  onMacroCategoryChange() {
    this.ngZone.run(() => {
      this.selectedCategoryFilter = null;
      this.loadCategories();
      this.loadInstruments();
    });
  }

  onCategoryFilterChange() {
    this.ngZone.run(() => {
      this.loadInstruments();
    });
  }

  onStatusFilterChange() {
    this.ngZone.run(() => {
      this.loadInstruments();
    });
  }

  // ============ CATEGORY CRUD ============

  openCategoryForm(category?: InstrumentCategory) {
    this.ngZone.run(() => {
      if (category) {
        this.isEditingCategory = true;
        this.editingCategoryId = category.id;
        this.editingCategory = {
          name: category.name,
          description: category.description || '',
          macroCategory: category.macroCategory,
          isActive: category.isActive,
        };
      } else {
        this.isEditingCategory = false;
        this.editingCategoryId = null;
        this.editingCategory = {
          name: '',
          description: '',
          macroCategory: this.selectedMacroCategory,
          isActive: true,
        };
      }
      this.showCategoryForm = true;
      this.error = null;
    });
  }

  closeCategoryForm() {
    this.ngZone.run(() => {
      this.showCategoryForm = false;
      this.isEditingCategory = false;
      this.editingCategoryId = null;
      this.editingCategory = {
        name: '',
        description: '',
        macroCategory: this.selectedMacroCategory,
        isActive: true,
      };
      this.error = null;
    });
  }

  saveCategory() {
    if (this.loading) return;

    const name = this.editingCategory.name?.trim();
    if (!name) {
      this.error = 'Il nome è obbligatorio';
      return;
    }

    this.loading = true;
    this.error = null;

    if (this.isEditingCategory && this.editingCategoryId) {
      const input: UpdateInstrumentCategoryInput = {
        name,
        description: this.editingCategory.description?.trim() || undefined,
        macroCategory: this.editingCategory.macroCategory,
        isActive: this.editingCategory.isActive,
      };

      this.instrumentService.updateInstrumentCategory(this.editingCategoryId, input)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadCategories();
            this.closeCategoryForm();
          },
          error: (error) => {
            console.error('Error updating category:', error);
            this.error = this.extractErrorMessage(error, 'aggiornamento categoria');
            this.loading = false;
          },
        });
    } else {
      const input: CreateInstrumentCategoryInput = {
        name,
        description: this.editingCategory.description?.trim() || undefined,
        macroCategory: this.editingCategory.macroCategory,
      };

      this.instrumentService.createInstrumentCategory(input)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadCategories();
            this.closeCategoryForm();
          },
          error: (error) => {
            console.error('Error creating category:', error);
            this.error = this.extractErrorMessage(error, 'creazione categoria');
            this.loading = false;
          },
        });
    }
  }

  deleteCategory(category: InstrumentCategory) {
    this.ngZone.run(() => {
      const instrumentCount = category.instruments?.length || 0;
      const message = instrumentCount > 0
        ? `Questa categoria contiene ${instrumentCount} strumenti. Sei sicuro di voler eliminare "${category.name}"?`
        : `Sei sicuro di voler eliminare la categoria "${category.name}"?`;

      if (!confirm(message)) return;

      this.loading = true;
      this.instrumentService.deleteInstrumentCategory(category.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadCategories();
            this.loadInstruments();
          },
          error: (error) => {
            console.error('Error deleting category:', error);
            this.error = this.extractErrorMessage(error, 'eliminazione categoria');
            this.loading = false;
          },
        });
    });
  }

  // ============ INSTRUMENT CRUD ============

  openInstrumentForm(instrument?: Instrument) {
    this.ngZone.run(() => {
      if (instrument) {
        this.isEditingInstrument = true;
        this.editingInstrumentId = instrument.id;
        this.editingInstrument = {
          categoryId: instrument.categoryId,
          name: instrument.name,
          brand: instrument.brand || '',
          model: instrument.model || '',
          color: instrument.color || '#4A90E2',
          verificationExpiry: instrument.verificationExpiry ? new Date(instrument.verificationExpiry) : undefined,
          status: instrument.status,
          isActive: instrument.isActive,
        };
        this.verificationExpiryString = instrument.verificationExpiry
          ? new Date(instrument.verificationExpiry).toISOString().split('T')[0]
          : '';
      } else {
        this.isEditingInstrument = false;
        this.editingInstrumentId = null;
        this.editingInstrument = {
          categoryId: this.selectedCategoryFilter || (this.categories[0]?.id || ''),
          name: '',
          brand: '',
          model: '',
          color: '#4A90E2',
          verificationExpiry: undefined,
          status: InstrumentStatus.Active,
          isActive: true,
        };
        this.verificationExpiryString = '';
      }
      this.showInstrumentForm = true;
      this.error = null;
    });
  }

  closeInstrumentForm() {
    this.ngZone.run(() => {
      this.showInstrumentForm = false;
      this.isEditingInstrument = false;
      this.editingInstrumentId = null;
      this.editingInstrument = {
        categoryId: '',
        name: '',
        brand: '',
        model: '',
        color: '#4A90E2',
        verificationExpiry: undefined,
        status: InstrumentStatus.Active,
        isActive: true,
      };
      this.verificationExpiryString = '';
      this.error = null;
    });
  }

  saveInstrument() {
    if (this.loading) return;

    const name = this.editingInstrument.name?.trim();
    if (!name) {
      this.error = 'Il nome è obbligatorio';
      return;
    }

    if (!this.editingInstrument.categoryId) {
      this.error = 'La categoria è obbligatoria';
      return;
    }

    // Parse verification expiry date
    const verificationExpiry = this.verificationExpiryString
      ? new Date(this.verificationExpiryString)
      : undefined;

    this.loading = true;
    this.error = null;

    if (this.isEditingInstrument && this.editingInstrumentId) {
      const input: UpdateInstrumentInput = {
        name,
        categoryId: this.editingInstrument.categoryId,
        brand: this.editingInstrument.brand?.trim() || undefined,
        model: this.editingInstrument.model?.trim() || undefined,
        color: this.editingInstrument.color,
        verificationExpiry,
        status: this.editingInstrument.status,
        isActive: this.editingInstrument.isActive,
      };

      this.instrumentService.updateInstrument(this.editingInstrumentId, input)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadInstruments();
            this.loadCategories(); // Refresh count
            this.closeInstrumentForm();
          },
          error: (error) => {
            console.error('Error updating instrument:', error);
            this.error = this.extractErrorMessage(error, 'aggiornamento strumento');
            this.loading = false;
          },
        });
    } else {
      const input: CreateInstrumentInput = {
        categoryId: this.editingInstrument.categoryId,
        name,
        brand: this.editingInstrument.brand?.trim() || undefined,
        model: this.editingInstrument.model?.trim() || undefined,
        color: this.editingInstrument.color,
        verificationExpiry,
      };

      this.instrumentService.createInstrument(input)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadInstruments();
            this.loadCategories(); // Refresh count
            this.closeInstrumentForm();
          },
          error: (error) => {
            console.error('Error creating instrument:', error);
            this.error = this.extractErrorMessage(error, 'creazione strumento');
            this.loading = false;
          },
        });
    }
  }

  deleteInstrument(instrument: Instrument) {
    this.ngZone.run(() => {
      if (!confirm(`Sei sicuro di voler eliminare lo strumento "${instrument.name}"?`)) return;

      this.loading = true;
      this.instrumentService.deleteInstrument(instrument.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadInstruments();
            this.loadCategories(); // Refresh count
          },
          error: (error) => {
            console.error('Error deleting instrument:', error);
            this.error = this.extractErrorMessage(error, 'eliminazione strumento');
            this.loading = false;
          },
        });
    });
  }

  setInstrumentStatus(instrument: Instrument, status: InstrumentStatus) {
    this.ngZone.run(() => {
      this.loading = true;
      this.instrumentService.setInstrumentStatus(instrument.id, status)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadInstruments();
          },
          error: (error) => {
            console.error('Error setting instrument status:', error);
            this.error = this.extractErrorMessage(error, 'cambio stato strumento');
            this.loading = false;
          },
        });
    });
  }

  // ============ HELPERS ============

  getMacroCategoryLabel(macroCategory: OperatorMacroCategory): string {
    return getMacroCategoryLabel(macroCategory);
  }

  getStatusLabel(status: InstrumentStatus): string {
    switch (status) {
      case InstrumentStatus.Active:
        return 'Attivo';
      case InstrumentStatus.Unavailable:
        return 'Non disponibile';
      case InstrumentStatus.Maintenance:
        return 'In manutenzione';
      default:
        return status;
    }
  }

  getStatusClass(status: InstrumentStatus): string {
    switch (status) {
      case InstrumentStatus.Active:
        return 'status-active';
      case InstrumentStatus.Unavailable:
        return 'status-unavailable';
      case InstrumentStatus.Maintenance:
        return 'status-maintenance';
      default:
        return '';
    }
  }

  getCategoryInstrumentCount(category: InstrumentCategory): number {
    return category.instruments?.length || 0;
  }

  getActiveInstrumentCount(category: InstrumentCategory): number {
    return category.instruments?.filter((i) => i.isActive && i.status === InstrumentStatus.Active).length || 0;
  }

  isVerificationExpiringSoon(instrument: Instrument): boolean {
    if (!instrument.verificationExpiry) return false;
    const expiry = new Date(instrument.verificationExpiry);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiry <= thirtyDaysFromNow;
  }

  isVerificationExpired(instrument: Instrument): boolean {
    if (!instrument.verificationExpiry) return false;
    return new Date(instrument.verificationExpiry) < new Date();
  }

  formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('it-IT');
  }

  private extractErrorMessage(error: any, context: string): string {
    let errorMsg = 'Errore sconosciuto';

    if (error?.graphQLErrors && error.graphQLErrors.length > 0) {
      errorMsg = error.graphQLErrors.map((e: any) => e.message).join(', ');
    } else if (error?.networkError?.error?.errors) {
      errorMsg = error.networkError.error.errors.map((e: any) => e.message).join(', ');
    } else if (error?.error?.message) {
      errorMsg = error.error.message;
    } else if (error?.message) {
      errorMsg = error.message;
    }

    return `Errore durante ${context}: ${errorMsg}`;
  }
}

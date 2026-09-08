import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { CdkOverlayOrigin, OverlayModule } from '@angular/cdk/overlay';
import { CdkMenuModule } from '@angular/cdk/menu';

import { AvailabilityStateService } from '../../../services/availability-state.service';
import {
  OperatorService,
  DeleteOperatorResult,
  OperatorDependencyCount,
} from '../../../services/operator.service';
import { OperatorCategoryService } from '../../../services/operator-category.service';
import { ServiceService } from '../../../services/service.service';
import { ServiceSubcategoryService, ServiceSubcategory } from '../../../services/service-subcategory.service';
import {
  Operator,
  OperatorCategory,
  OperatorMacroCategory,
  Service,
  CreateOperatorInput,
  UpdateOperatorInput,
} from '../../../graphql/generated/types';
import { getMacroCategoryLabel } from '../../../graphql/types';
import { OperatorCalendarFeedContainer } from '../../../features/operator-calendar-feed/containers/operator-calendar-feed.container';
import { OperatorGoogleCalendarContainer } from '../../../features/operator-google-calendar/containers/operator-google-calendar.container';
import { OperatorExternalPrivacyContainer } from '../../../features/operator-calendar-feed/containers/operator-external-privacy.container';
import { CalendarSyncSectionComponent } from '../../../features/operator-calendar-sync/components/calendar-sync-section/calendar-sync-section.component';
import { CalendarSyncSettingsContainer } from '../../../features/operator-calendar-sync/containers/calendar-sync-settings.container';
import { OperatorSyncBadgesComponent } from '../../../features/operator-google-calendar/components/operator-sync-badges/operator-sync-badges.component';
import { OperatorGoogleCalendarService } from '../../../features/operator-google-calendar/services/operator-google-calendar.service';
import { OperatorSyncSummary } from '../../../features/operator-google-calendar/models/operator-google-calendar.model';

@Component({
  selector: 'app-operator-management',
  standalone: true,
  imports: [
    CommonModule, FormsModule, OverlayModule, CdkMenuModule,
    OperatorCalendarFeedContainer,
    OperatorGoogleCalendarContainer,
    OperatorExternalPrivacyContainer,
    CalendarSyncSectionComponent,
    CalendarSyncSettingsContainer,
    OperatorSyncBadgesComponent,
  ],
  templateUrl: './operator-management.component.html',
  styleUrls: ['./operator-management.component.scss'],
})
export class OperatorManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  operators: Operator[] = [];
  archivedOperators: Operator[] = [];
  categories: OperatorCategory[] = [];
  services: Service[] = [];
  selectedOperator: Operator | null = null;
  loading = false;
  error: string | null = null;
  /**
   * Toggle "Mostra archiviati": quando true mostra la lista dei soft-deletati
   * (caricata on-demand) con bottone Ripristina. Default false.
   */
  showArchived = false;

  // Form state
  showOperatorForm = false;
  isEditMode = false;
  editingOperatorId: string | null = null;
  editingOperator: Partial<CreateOperatorInput> & { isActive?: boolean; canCollectPayment?: boolean; professionalTitle?: string; taxCode?: string; vatNumber?: string } = {
    name: '',
    surname: '',
    email: '',
    phone: '',
    color: '#4A90E2',
    macroCategory: OperatorMacroCategory.Physiotherapist,
    categoryId: undefined,
    preferredDurations: [],
    maxConcurrentAppointments: 1,
    isActive: true,
    royaltyPercentage: 0,
    professionalRegistration: '',
    professionalTitle: '',
    taxCode: '',
    vatNumber: '',
    canCollectPayment: true,
  };

  // Preferred durations as string for input
  preferredDurationsString = '';

  // Service assignment
  showServiceAssignment = false;
  selectedServices: string[] = [];
  operatorServices: { [operatorId: string]: Service[] } = {};

  /**
   * Stato di sincronizzazione per operatore, indicizzato per id.
   *
   * Caricato una volta sola per tutto l'elenco: una chiamata per card avrebbe
   * significato venti richieste per mostrare tre pastiglie.
   */
  syncSummary: { [operatorId: string]: OperatorSyncSummary } = {};

  // Service filters for modal
  allSubcategories: ServiceSubcategory[] = [];
  filteredSubcategoriesForModal: ServiceSubcategory[] = [];
  filterMacroCategory: OperatorMacroCategory | null = null;
  filterSubcategoryId: string | null = null;

  // Macro categories for dropdown
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

  // Expose enum to template
  OperatorMacroCategory = OperatorMacroCategory;

  // Overlay click tracking (per evitare chiusura durante click-and-drag)
  overlayMouseDownTarget: EventTarget | null = null;

  /** Sync manuale operatori → contabilità (conti operatori). */
  resyncing = false;

  resyncToAccounting(): void {
    if (this.resyncing) return;
    this.resyncing = true;
    this.operatorService.resyncOperatorsToAccounting().subscribe({
      next: (count) => {
        this.resyncing = false;
        alert(`Sincronizzati ${count} operatori con la contabilità.`);
      },
      error: () => {
        this.resyncing = false;
        alert('Sincronizzazione non riuscita: riprova o controlla i log.');
      },
    });
  }

  constructor(
    private availabilityState: AvailabilityStateService,
    private operatorService: OperatorService,
    private operatorCategoryService: OperatorCategoryService,
    private serviceService: ServiceService,
    private serviceSubcategoryService: ServiceSubcategoryService,
    private ngZone: NgZone,
    private googleCalendarService: OperatorGoogleCalendarService,
  ) {}

  ngOnInit() {
    // Subscribe to operators from state
    this.availabilityState.operators$
      .pipe(takeUntil(this.destroy$))
      .subscribe((operators) => {
        this.operators = operators;
      });

    // Subscribe to services from state
    this.availabilityState.services$
      .pipe(takeUntil(this.destroy$))
      .subscribe((services) => {
        this.services = services as any;
      });

    // Subscribe to selected operator
    this.availabilityState.selectedOperator$
      .pipe(takeUntil(this.destroy$))
      .subscribe((operator) => {
        this.selectedOperator = operator;
        if (operator) {
          this.loadOperatorServices(operator.id);
        }
      });

    // Subscribe to loading state
    this.availabilityState.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => {
        this.loading = loading;
      });

    // Subscribe to error state
    this.availabilityState.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe((error) => {
        this.error = error;
      });

    // Initial load
    this.loadOperators();
    this.loadCategories();
    this.loadServices();
    this.loadAllSubcategories();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOperators() {
    this.availabilityState.loadOperators();
    this.loadSyncSummary();
  }

  loadCategories() {
    this.operatorCategoryService.getOperatorCategories().subscribe({
      next: (categories) => {
        this.categories = categories.filter((c) => c.isActive);
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      },
    });
  }

  loadServices() {
    this.availabilityState.loadServices();
  }

  loadAllSubcategories() {
    this.serviceSubcategoryService.getServiceSubcategories(undefined, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (subcategories) => {
          this.allSubcategories = subcategories;
        },
        error: (error) => {
          console.error('Error loading subcategories:', error);
        }
      });
  }

  onMacroCategoryFilterChange() {
    // Reset subcategory filter when macro changes
    this.filterSubcategoryId = null;

    // Filter subcategories based on selected macro
    if (this.filterMacroCategory) {
      this.filteredSubcategoriesForModal = this.allSubcategories.filter(
        sub => sub.macroCategory === this.filterMacroCategory
      );
    } else {
      this.filteredSubcategoriesForModal = [];
    }
  }

  get filteredServicesForModal(): Service[] {
    let filtered = this.services;

    if (this.filterMacroCategory) {
      filtered = filtered.filter(s => (s as any).macroCategory === this.filterMacroCategory);
    }

    if (this.filterSubcategoryId) {
      filtered = filtered.filter(s => (s as any).subcategoryId === this.filterSubcategoryId);
    }

    return filtered;
  }

  selectOperator(operator: Operator) {
    this.availabilityState.selectOperator(operator.id);
  }

  openOperatorForm(operator?: Operator) {
    this.ngZone.run(() => {
      if (operator) {
        this.isEditMode = true;
        this.editingOperatorId = operator.id;
        this.editingOperator = {
          name: operator.name,
          surname: operator.surname,
          email: operator.email,
          phone: operator.phone,
          color: operator.color || '#4A90E2',
          macroCategory: operator.macroCategory,
          categoryId: operator.categoryId,
          preferredDurations: operator.preferredDurations || [],
          maxConcurrentAppointments: operator.maxConcurrentAppointments,
          isActive: operator.isActive,
          royaltyPercentage: (operator as any).royaltyPercentage || 0,
          professionalRegistration: (operator as any).professionalRegistration || '',
          professionalTitle: (operator as any).professionalTitle || '',
          taxCode: (operator as any).taxCode || '',
          vatNumber: (operator as any).vatNumber || '',
          canCollectPayment: (operator as any).canCollectPayment ?? true,
        };
        this.preferredDurationsString =
          (operator.preferredDurations || []).join(', ');
      } else {
        this.isEditMode = false;
        this.editingOperatorId = null;
        this.editingOperator = {
          name: '',
          surname: '',
          email: '',
          phone: '',
          color: '#4A90E2',
          macroCategory: OperatorMacroCategory.Physiotherapist,
          categoryId: undefined,
          preferredDurations: [],
          maxConcurrentAppointments: 1,
          isActive: true,
          royaltyPercentage: 0,
          professionalRegistration: '',
          professionalTitle: '',
          taxCode: '',
          vatNumber: '',
          canCollectPayment: true,
        };
        this.preferredDurationsString = '';
      }
      this.showOperatorForm = true;
      this.error = null;
    });
  }

  closeOperatorForm() {
    this.ngZone.run(() => {
      this.showOperatorForm = false;
      this.isEditMode = false;
      this.editingOperatorId = null;
      this.editingOperator = {
        name: '',
        surname: '',
        email: '',
        phone: '',
        color: '#4A90E2',
        macroCategory: OperatorMacroCategory.Physiotherapist,
        categoryId: undefined,
        preferredDurations: [],
        maxConcurrentAppointments: 1,
        isActive: true,
        royaltyPercentage: 0,
        professionalRegistration: '',
        professionalTitle: '',
        taxCode: '',
        vatNumber: '',
        canCollectPayment: true,
      };
      this.preferredDurationsString = '';
      this.error = null;
    });
  }

  saveOperator() {
    // Previeni multiple submissions
    if (this.loading) {
      return;
    }

    const name = this.editingOperator.name?.trim();
    const email = this.editingOperator.email?.trim();

    if (!name) {
      this.error = 'Il nome è obbligatorio';
      return;
    }

    // Parse preferred durations from string
    const preferredDurations = this.preferredDurationsString
      .split(',')
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);

    this.loading = true;
    this.error = null;

    if (this.isEditMode && this.editingOperatorId) {
      // Update existing operator
      const input: UpdateOperatorInput = {
        name: name,
        surname: this.editingOperator.surname?.trim(),
        email: email || undefined,
        phone: this.editingOperator.phone?.trim(),
        color: this.editingOperator.color,
        macroCategory: this.editingOperator.macroCategory,
        // null (non undefined): categoryId vuoto deve SVUOTARE la categoria
        // sul backend, non "campo non inviato" (che la lascerebbe invariata).
        categoryId: this.editingOperator.categoryId || null,
        preferredDurations:
          preferredDurations.length > 0 ? preferredDurations : undefined,
        isActive: this.editingOperator.isActive,
        maxConcurrentAppointments:
          this.editingOperator.maxConcurrentAppointments,
        royaltyPercentage: this.editingOperator.royaltyPercentage,
        professionalRegistration: this.editingOperator.professionalRegistration?.trim() || undefined,
        professionalTitle: this.editingOperator.professionalTitle?.trim() || undefined,
        taxCode: this.editingOperator.taxCode?.trim().toUpperCase() || undefined,
        vatNumber: this.editingOperator.vatNumber?.trim() || undefined,
        canCollectPayment: this.editingOperator.canCollectPayment,
      } as UpdateOperatorInput;

      this.operatorService.updateOperator(this.editingOperatorId, input).subscribe({
        next: (operator) => {
          console.log('Operator updated successfully:', operator);
          this.availabilityState.updateOperator(operator);
          this.closeOperatorForm();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error updating operator - Full error object:', error);
          console.error('Error graphQLErrors:', error?.graphQLErrors);
          console.error('Error networkError:', error?.networkError);

          let errorMsg = 'Errore sconosciuto';

          // Check for GraphQL errors
          if (error?.graphQLErrors && error.graphQLErrors.length > 0) {
            errorMsg = error.graphQLErrors.map((e: any) => e.message).join(', ');
          } else if (error?.networkError?.error?.errors) {
            errorMsg = error.networkError.error.errors.map((e: any) => e.message).join(', ');
          } else if (error?.error?.message) {
            errorMsg = error.error.message;
          } else if (error?.message) {
            errorMsg = error.message;
          }

          this.error = `Errore durante l'aggiornamento: ${errorMsg}`;
          this.loading = false;
          // NON chiudere il modal in caso di errore per permettere all'utente di leggere il messaggio
        },
      });
    } else {
      // Create new operator
      const input: CreateOperatorInput = {
        name: name!,
        surname: this.editingOperator.surname?.trim() || undefined,
        email: email || undefined,
        phone: this.editingOperator.phone?.trim() || undefined,
        color: this.editingOperator.color,
        macroCategory:
          this.editingOperator.macroCategory ||
          OperatorMacroCategory.Physiotherapist,
        categoryId: this.editingOperator.categoryId || undefined,
        preferredDurations:
          preferredDurations.length > 0 ? preferredDurations : undefined,
        maxConcurrentAppointments:
          this.editingOperator.maxConcurrentAppointments || 1,
        royaltyPercentage: this.editingOperator.royaltyPercentage,
        professionalRegistration: this.editingOperator.professionalRegistration?.trim() || undefined,
        professionalTitle: this.editingOperator.professionalTitle?.trim() || undefined,
        taxCode: this.editingOperator.taxCode?.trim().toUpperCase() || undefined,
        vatNumber: this.editingOperator.vatNumber?.trim() || undefined,
        canCollectPayment: this.editingOperator.canCollectPayment,
      } as CreateOperatorInput;

      this.operatorService.createOperator(input).subscribe({
        next: (operator) => {
          console.log('Operator created successfully:', operator);
          this.availabilityState.addOperator(operator);
          this.closeOperatorForm();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error creating operator - Full error object:', error);
          console.error('Error graphQLErrors:', error?.graphQLErrors);
          console.error('Error networkError:', error?.networkError);
          // Log additional details for debugging validation errors
          if (error?.networkError?.result) {
            console.error('Error networkError.result:', error.networkError.result);
          }

          let errorMsg = 'Errore sconosciuto';

          // Check for GraphQL errors with extensions (validation errors)
          if (error?.graphQLErrors && error.graphQLErrors.length > 0) {
            const messages = error.graphQLErrors.map((e: any) => {
              // Check for validation error details in extensions
              if (e.extensions?.originalError?.message) {
                const origMsg = e.extensions.originalError.message;
                if (Array.isArray(origMsg)) {
                  return origMsg.join(', ');
                }
                return origMsg;
              }
              return e.message;
            });
            errorMsg = messages.join(', ');
          } else if (error?.networkError?.result?.errors) {
            // Handle network errors with GraphQL error response
            const messages = error.networkError.result.errors.map((e: any) => {
              if (e.extensions?.originalError?.message) {
                const origMsg = e.extensions.originalError.message;
                if (Array.isArray(origMsg)) {
                  return origMsg.join(', ');
                }
                return origMsg;
              }
              return e.message;
            });
            errorMsg = messages.join(', ');
          } else if (error?.networkError?.error?.errors) {
            errorMsg = error.networkError.error.errors.map((e: any) => e.message).join(', ');
          } else if (error?.error?.message) {
            errorMsg = error.error.message;
          } else if (error?.message) {
            errorMsg = error.message;
          }

          this.error = `Errore durante la creazione: ${errorMsg}`;
          this.loading = false;
          // NON chiudere il modal in caso di errore per permettere all'utente di leggere il messaggio
        },
      });
    }
  }

  deleteOperator(operator: Operator) {
    this.ngZone.run(() => {
      // Prima recuperiamo le dipendenze per costruire un messaggio
      // informativo all'admin: archiviazione (soft) vs eliminazione (hard).
      this.operatorService.getOperatorDependencies(operator.id).subscribe({
        next: (deps: OperatorDependencyCount) => {
          const fullName = `${operator.name} ${operator.surname ?? ''}`.trim();
          const willArchive = deps.total > 0;
          const message = willArchive
            ? `L'operatore "${fullName}" ha ${deps.total} record storici associati ` +
              `(${deps.treatments} trattamenti, ${deps.therapeuticPaths} percorsi, ` +
              `${deps.evaluations} valutazioni, ${deps.appointments} appuntamenti). ` +
              `Verrà archiviato: lo storico clinico sarà preservato, ma l'operatore non sarà più ` +
              `selezionabile per nuovi trattamenti e non potrà più accedere al sistema. Continuare?`
            : `L'operatore "${fullName}" non ha record storici associati e verrà eliminato definitivamente. Continuare?`;

          if (!confirm(message)) return;

          this.loading = true;
          this.operatorService.deleteOperator(operator.id).subscribe({
            next: (result: DeleteOperatorResult) => {
              this.ngZone.run(() => {
                this.availabilityState.removeOperator(operator.id);
                if (this.selectedOperator?.id === operator.id) {
                  this.availabilityState.selectOperator(null);
                }
                this.loading = false;
                const action = result.archived ? 'archiviato' : 'eliminato definitivamente';
                console.log(`[OperatorManagement] Operatore ${action}: ${operator.id}`);
                if (this.showArchived) this.loadArchivedOperators();
              });
            },
            error: (error) => {
              this.ngZone.run(() => {
                console.error('Error deleting operator:', error);
                this.error =
                  error?.message ?? "Errore durante l'eliminazione dell'operatore";
                this.loading = false;
              });
            },
          });
        },
        error: () => {
          // Fallback: se il count fallisce, conferma semplice senza dettagli
          if (!confirm(`Sei sicuro di voler eliminare l'operatore ${operator.name}?`)) {
            return;
          }
          this.loading = true;
          this.operatorService.deleteOperator(operator.id).subscribe({
            next: () => {
              this.ngZone.run(() => {
                this.availabilityState.removeOperator(operator.id);
                this.loading = false;
              });
            },
            error: (error) => {
              this.ngZone.run(() => {
                this.error = error?.message ?? "Errore durante l'eliminazione";
                this.loading = false;
              });
            },
          });
        },
      });
    });
  }

  /**
   * Toggle vista "Operatori archiviati". Quando attivata carica la lista
   * dei soft-deletati. Quando disattivata torna alla lista attivi.
   */
  toggleArchivedView() {
    this.showArchived = !this.showArchived;
    if (this.showArchived) {
      this.loadArchivedOperators();
    }
  }

  /** Carica gli operatori archiviati per la sezione dedicata. */
  loadArchivedOperators() {
    this.operatorService
      .getArchivedOperators()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.ngZone.run(() => {
            this.archivedOperators = list;
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            console.error('Error loading archived operators:', err);
            this.error = 'Errore caricamento operatori archiviati';
          });
        },
      });
  }

  /**
   * Ripristina un operatore archiviato. NB: i template di disponibilità
   * NON vengono riattivati automaticamente: l'admin deve riattivarli
   * manualmente dopo il ripristino.
   */
  restoreOperator(operator: Operator) {
    this.ngZone.run(() => {
      const fullName = `${operator.name} ${operator.surname ?? ''}`.trim();
      const message =
        `Ripristinare l'operatore "${fullName}"?\n\n` +
        `Diventerà di nuovo selezionabile per nuovi trattamenti e potrà accedere al sistema. ` +
        `I template di disponibilità restano disattivati: vanno riattivati manualmente.`;
      if (!confirm(message)) return;

      this.loading = true;
      this.operatorService.restoreOperator(operator.id).subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.loading = false;
            this.loadArchivedOperators();
            this.availabilityState.loadOperators();
          });
        },
        error: (error) => {
          this.ngZone.run(() => {
            console.error('Error restoring operator:', error);
            this.error =
              error?.message ?? "Errore durante il ripristino dell'operatore";
            this.loading = false;
          });
        },
      });
    });
  }

  openServiceAssignment(operator: Operator) {
    this.ngZone.run(() => {
      this.selectedOperator = operator;
      // Reset filters
      this.filterMacroCategory = null;
      this.filterSubcategoryId = null;
      this.filteredSubcategoriesForModal = [];
      this.loadOperatorServices(operator.id);
      this.showServiceAssignment = true;
    });
  }

  closeServiceAssignment() {
    this.ngZone.run(() => {
      this.showServiceAssignment = false;
      this.selectedServices = [];
    });
  }

  loadOperatorServices(operatorId: string) {
    this.serviceService.getOperatorServices(operatorId).subscribe({
      next: (operatorServices) => {
        const services = operatorServices
          .map((os) => os.service)
          .filter((s) => s !== null) as Service[];
        this.operatorServices[operatorId] = services;
        this.selectedServices = services.map((s) => s.id);
      },
      error: (error) => {
        console.error('Error loading operator services:', error);
      },
    });
  }

  toggleService(serviceId: string) {
    const index = this.selectedServices.indexOf(serviceId);
    if (index > -1) {
      this.selectedServices.splice(index, 1);
    } else {
      this.selectedServices.push(serviceId);
    }
  }

  isServiceSelected(serviceId: string): boolean {
    return this.selectedServices.includes(serviceId);
  }

  saveServiceAssignment() {
    if (!this.selectedOperator) return;

    const currentServices = this.operatorServices[this.selectedOperator.id] || [];
    const currentServiceIds = currentServices.map((s) => s.id);

    // Find services to add and remove
    const toAdd = this.selectedServices.filter(
      (id) => !currentServiceIds.includes(id)
    );
    const toRemove = currentServiceIds.filter(
      (id) => !this.selectedServices.includes(id)
    );

    this.loading = true;

    // Process additions
    const addPromises = toAdd.map((serviceId) =>
      this.serviceService
        .assignServiceToOperator({
          operatorId: this.selectedOperator!.id,
          serviceId: serviceId,
          customDuration: undefined,
        })
        .toPromise()
    );

    // Process removals
    const removePromises = toRemove.map((serviceId) =>
      this.serviceService
        .removeServiceFromOperator(this.selectedOperator!.id, serviceId)
        .toPromise()
    );

    Promise.all([...addPromises, ...removePromises])
      .then(() => {
        this.loadOperatorServices(this.selectedOperator!.id);
        this.closeServiceAssignment();
        this.loading = false;
      })
      .catch((error) => {
        console.error('Error updating service assignments:', error);
        this.error = "Errore durante l'aggiornamento dei servizi";
        this.loading = false;
      });
  }

  getMacroCategoryLabel(macroCategory: OperatorMacroCategory): string {
    return getMacroCategoryLabel(macroCategory);
  }

  getFilteredCategories(): OperatorCategory[] {
    if (!this.editingOperator.macroCategory) {
      return this.categories;
    }
    return this.categories.filter(
      (c) => c.macroCategory === this.editingOperator.macroCategory
    );
  }

  onMacroCategoryChange() {
    // Reset category when macro category changes
    this.editingOperator.categoryId = undefined;
  }

  // Overlay click handlers (previene chiusura durante selezione testo con click-and-drag)
  onOverlayMouseDown(event: MouseEvent): void {
    this.overlayMouseDownTarget = event.target;
  }

  onOverlayClick(event: MouseEvent, modalType: 'operator' | 'service'): void {
    if (this.overlayMouseDownTarget === event.currentTarget &&
        event.target === event.currentTarget) {
      if (modalType === 'operator') {
        this.closeOperatorForm();
      } else {
        this.closeServiceAssignment();
      }
    }
    this.overlayMouseDownTarget = null;
  }

  /**
   * Stato di sincronizzazione di tutti gli operatori.
   *
   * Un errore qui non si mostra: le pastiglie sono un di piu' informativo, e
   * un banner rosso sull'elenco degli operatori farebbe pensare a un problema
   * degli operatori.
   */
  private loadSyncSummary(): void {
    this.googleCalendarService.getSyncSummary().subscribe({
      next: (rows) => {
        const map: { [operatorId: string]: OperatorSyncSummary } = {};
        for (const row of rows) map[row.operatorId] = row;
        this.ngZone.run(() => { this.syncSummary = map; });
      },
      error: () => undefined,
    });
  }
}

import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { AvailabilityStateService } from '../../../services/availability-state.service';
import { ServiceService } from '../../../services/service.service';
import { ServiceSubcategoryService, ServiceSubcategory } from '../../../services/service-subcategory.service';
import { Service, MutationCreateServiceArgs as CreateServiceInput, MutationUpdateServiceArgs as UpdateServiceInput, OperatorMacroCategory } from '../../../graphql/generated/types';
import { InvoicePrefixesManagementComponent } from '../invoice-prefixes-management/invoice-prefixes-management.component';

@Component({
  selector: 'app-service-management',
  standalone: true,
  imports: [CommonModule, FormsModule, InvoicePrefixesManagementComponent],
  templateUrl: './service-management.component.html',
  styleUrls: ['./service-management.component.scss']
})
export class ServiceManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  services: Service[] = [];
  selectedService: Service | null = null;
  loading = false;
  error: string | null = null;

  // Form state
  showServiceForm = false;
  editingService: Partial<CreateServiceInput> & {
    subcategoryId?: string | null;
    discountFE?: number | null;
    serviceFee?: number | null;
    studioExtra?: number | null;
    serviceFeeFE?: number | null;
    studioExtraFE?: number | null;
  } = {
    name: '',
    serviceCode: '',
    description: '',
    defaultDuration: 30,
    defaultPrice: 0,
    bufferTimeBefore: 0,
    bufferTimeAfter: 0,
    isActive: true,
    color: '#007bff',
    macroCategory: OperatorMacroCategory.Other,
    subcategoryId: null,
    discountFE: null,
    serviceFee: 0,
    studioExtra: 0,
    serviceFeeFE: null,
    studioExtraFE: null
  };

  // Filter and search
  searchTerm = '';
  showInactive = false;

  // Overlay click tracking (per evitare chiusura durante click-and-drag)
  overlayMouseDownTarget: EventTarget | null = null;

  // Macro categories and subcategories
  macroCategories: OperatorMacroCategory[] = [
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
  allSubcategories: ServiceSubcategory[] = [];
  filteredSubcategories: ServiceSubcategory[] = [];

  constructor(
    private availabilityState: AvailabilityStateService,
    private serviceService: ServiceService,
    private subcategoryService: ServiceSubcategoryService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    // Subscribe to services from state
    this.availabilityState.services$
      .pipe(takeUntil(this.destroy$))
      .subscribe(services => {
        this.services = services;
      });

    // Subscribe to loading state
    this.availabilityState.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.loading = loading;
      });

    // Subscribe to error state
    this.availabilityState.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        this.error = error;
      });

    // Initial load
    this.loadServices();
    this.loadSubcategories();
  }

  loadSubcategories() {
    this.subcategoryService.getServiceSubcategories(undefined, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe(subcategories => {
        this.allSubcategories = subcategories;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadServices() {
    this.availabilityState.loadServices();
  }

  get filteredServices(): Service[] {
    return this.services.filter(service => {
      const matchesSearch = !this.searchTerm ||
        service.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (service.description && service.description.toLowerCase().includes(this.searchTerm.toLowerCase()));

      const matchesActive = this.showInactive || service.isActive;

      return matchesSearch && matchesActive;
    });
  }

  // ngModel su input number tipa il binding come `number | null` (null quando
  // l'input è vuoto). La coercion qui evita `null + number = NaN` nel totale
  // mostrato a video e replica esattamente il calcolo che fa il backend.
  private toAmount(v: number | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  get defaultPriceComputed(): number {
    return this.toAmount(this.editingService.serviceFee) +
           this.toAmount(this.editingService.studioExtra);
  }

  get discountFEComputed(): number {
    return this.toAmount(this.editingService.serviceFeeFE) +
           this.toAmount(this.editingService.studioExtraFE);
  }

  // True se l'operatore ha valorizzato almeno una delle due voci FE
  // (la sezione "Sconto FE" è opzionale; lasciandole entrambe vuote, il
  // servizio non avrà uno sconto FE).
  get hasFEBreakdown(): boolean {
    const fee = this.editingService.serviceFeeFE;
    const extra = this.editingService.studioExtraFE;
    return (fee !== null && fee !== undefined && fee !== ('' as any)) ||
           (extra !== null && extra !== undefined && extra !== ('' as any));
  }

  selectService(service: Service) {
    this.ngZone.run(() => {
      this.selectedService = service;
    });
  }

  openServiceForm(service?: Service) {
    this.ngZone.run(() => {
      if (service) {
        this.selectedService = service;
        const s = service as any;
        // Fallback breakdown: per i servizi non ancora editati la migration
        // di backfill ha già messo serviceFee=defaultPrice e studioExtra=0,
        // ma per sicurezza (es. record creati prima della migration o letti
        // da cache stale) ricalcoliamo lato client.
        const serviceFee = s.serviceFee ?? service.defaultPrice ?? 0;
        const studioExtra = s.studioExtra ?? 0;
        const hasDiscountFE = s.discountFE !== null && s.discountFE !== undefined;
        this.editingService = {
          name: service.name,
          serviceCode: s.serviceCode ?? '',
          description: service.description,
          defaultDuration: service.defaultDuration,
          defaultPrice: service.defaultPrice,
          bufferTimeBefore: service.bufferTimeBefore,
          bufferTimeAfter: service.bufferTimeAfter,
          isActive: service.isActive,
          color: service.color || '#007bff',
          macroCategory: service.macroCategory || OperatorMacroCategory.Other,
          subcategoryId: s.subcategoryId || null,
          discountFE: s.discountFE ?? null,
          serviceFee,
          studioExtra,
          serviceFeeFE: s.serviceFeeFE ?? (hasDiscountFE ? s.discountFE : null),
          studioExtraFE: s.studioExtraFE ?? (hasDiscountFE ? 0 : null)
        };
        this.filterSubcategoriesByMacroCategory(this.editingService.macroCategory!);
      } else {
        this.selectedService = null;
        this.editingService = {
          name: '',
          serviceCode: '',
          description: '',
          defaultDuration: 30,
          defaultPrice: 0,
          bufferTimeBefore: 0,
          bufferTimeAfter: 0,
          isActive: true,
          color: '#007bff',
          macroCategory: OperatorMacroCategory.Other,
          subcategoryId: null,
          discountFE: null,
          serviceFee: 0,
          studioExtra: 0,
          serviceFeeFE: null,
          studioExtraFE: null
        };
        this.filterSubcategoriesByMacroCategory(OperatorMacroCategory.Other);
      }
      this.showServiceForm = true;
    });
  }

  onMacroCategoryChange() {
    this.ngZone.run(() => {
      this.editingService.subcategoryId = null;
      this.filterSubcategoriesByMacroCategory(this.editingService.macroCategory!);
    });
  }

  filterSubcategoriesByMacroCategory(macroCategory: OperatorMacroCategory) {
    this.filteredSubcategories = this.allSubcategories.filter(
      sub => sub.macroCategory === macroCategory
    );
  }

  // Overlay click handlers (previene chiusura durante selezione testo con click-and-drag)
  onOverlayMouseDown(event: MouseEvent): void {
    this.overlayMouseDownTarget = event.target;
  }

  onOverlayClick(event: MouseEvent): void {
    // Chiudi solo se sia mousedown che click sono avvenuti sull'overlay stesso
    if (this.overlayMouseDownTarget === event.currentTarget &&
        event.target === event.currentTarget) {
      this.closeServiceForm();
    }
    this.overlayMouseDownTarget = null;
  }

  closeServiceForm() {
    this.ngZone.run(() => {
      this.showServiceForm = false;
      this.selectedService = null;
      this.editingService = {
        name: '',
        serviceCode: '',
        description: '',
        defaultDuration: 30,
        defaultPrice: 0,
        bufferTimeBefore: 0,
        bufferTimeAfter: 0,
        isActive: true,
        color: '#007bff',
        macroCategory: OperatorMacroCategory.Other,
        subcategoryId: null,
        discountFE: null,
        serviceFee: 0,
        studioExtra: 0,
        serviceFeeFE: null,
        studioExtraFE: null
      };
      this.filteredSubcategories = [];
    });
  }

  saveService() {
    this.error = null;
    if (!this.editingService.name || !this.editingService.defaultDuration) {
      this.error = 'Nome e durata sono obbligatori';
      return;
    }
    // serviceCode obbligatorio (UNIQUE per-schema, vedi backend Step 1).
    // L'operatore corregge i TMP-* generati dalla migration con codici reali
    // (es. "FIS-001"). Spazi e maiuscole-minuscole consigliati come scelta
    // operativa, ma niente normalizzazione client-side per ora.
    if (!this.editingService.serviceCode || this.editingService.serviceCode.trim().length === 0) {
      this.error = 'Codice servizio (serviceCode) è obbligatorio';
      return;
    }

    this.loading = true;

    // Coercion null/empty → 0 sulle voci breakdown normali (sempre presenti).
    // La breakdown FE è opzionale: se entrambe le voci FE sono vuote, mando
    // tutto null così il backend lascia discountFE invariato/null e il
    // servizio resta senza tariffa FE.
    const serviceFee = this.toAmount(this.editingService.serviceFee);
    const studioExtra = this.toAmount(this.editingService.studioExtra);
    const defaultPriceComputed = serviceFee + studioExtra;

    const hasFE = this.hasFEBreakdown;
    const serviceFeeFE = hasFE ? this.toAmount(this.editingService.serviceFeeFE) : null;
    const studioExtraFE = hasFE ? this.toAmount(this.editingService.studioExtraFE) : null;
    const discountFEComputed = hasFE ? (serviceFeeFE! + studioExtraFE!) : null;

    if (this.selectedService) {
      // Update existing service
      const input: UpdateServiceInput & {
        subcategoryId?: string | null;
        discountFE?: number | null;
        serviceFee?: number | null;
        studioExtra?: number | null;
        serviceFeeFE?: number | null;
        studioExtraFE?: number | null;
      } = {
        id: this.selectedService.id,
        name: this.editingService.name,
        serviceCode: this.editingService.serviceCode!.trim(),
        description: this.editingService.description,
        defaultDuration: this.editingService.defaultDuration!,
        defaultPrice: defaultPriceComputed,
        bufferTimeBefore: this.editingService.bufferTimeBefore,
        bufferTimeAfter: this.editingService.bufferTimeAfter,
        isActive: this.editingService.isActive,
        color: this.editingService.color,
        macroCategory: this.editingService.macroCategory,
        subcategoryId: this.editingService.subcategoryId,
        discountFE: discountFEComputed,
        serviceFee,
        studioExtra,
        serviceFeeFE,
        studioExtraFE
      };

      this.serviceService.updateService(this.selectedService.id, input as any)
        .subscribe({
          next: (service) => {
            this.availabilityState.updateService(service);
            this.closeServiceForm();
            this.loading = false;
          },
          error: (error) => {
            console.error('Error updating service:', error);
            this.error = 'Errore durante l\'aggiornamento del servizio';
            this.loading = false;
          }
        });
    } else {
      // Create new service
      const input: CreateServiceInput = {
        ...(this.editingService as CreateServiceInput),
        serviceCode: this.editingService.serviceCode!.trim(),
        defaultPrice: defaultPriceComputed,
        ...({
          discountFE: discountFEComputed,
          serviceFee,
          studioExtra,
          serviceFeeFE,
          studioExtraFE,
        } as any),
      };

      console.log('Creating service with input:', input);
      this.serviceService.createService(input)
        .subscribe({
          next: (service) => {
            console.log('Service created successfully:', service);
            this.availabilityState.addService(service);
            this.closeServiceForm();
            this.loading = false;
          },
          error: (error) => {
            console.error('Error creating service - Full error:', error);
            if (error.graphQLErrors && error.graphQLErrors.length > 0) {
              console.error('GraphQL errors:', error.graphQLErrors);
              this.error = `Errore: ${error.graphQLErrors[0].message}`;
            } else if (error.networkError) {
              console.error('Network error:', error.networkError);
              this.error = 'Errore di rete durante la creazione del servizio';
            } else {
              this.error = 'Errore durante la creazione del servizio';
            }
            this.loading = false;
          }
        });
    }
  }

  deleteService(service: Service) {
    this.ngZone.run(() => {
      if (!confirm(`Sei sicuro di voler eliminare il servizio "${service.name}"?\n\nQuesto rimuoverà anche tutte le assegnazioni agli operatori.`)) {
        return;
      }

      this.loading = true;
      this.serviceService.deleteService(service.id)
        .subscribe({
          next: () => {
            this.ngZone.run(() => {
              this.availabilityState.removeService(service.id);
              if (this.selectedService?.id === service.id) {
                this.selectedService = null;
              }
              this.loading = false;
            });
          },
          error: (error) => {
            this.ngZone.run(() => {
              console.error('Error deleting service:', error);
              this.error = 'Errore durante l\'eliminazione del servizio';
              this.loading = false;
            });
          }
        });
    });
  }

  duplicateService(service: Service) {
    this.ngZone.run(() => {
      this.openServiceForm();
      const s = service as any;
      const hasDiscountFE = s.discountFE !== null && s.discountFE !== undefined;
      this.editingService = {
        name: `${service.name} (copia)`,
        description: service.description,
        defaultDuration: service.defaultDuration,
        defaultPrice: service.defaultPrice,
        bufferTimeBefore: service.bufferTimeBefore,
        bufferTimeAfter: service.bufferTimeAfter,
        isActive: service.isActive,
        color: service.color,
        macroCategory: service.macroCategory || OperatorMacroCategory.Other,
        subcategoryId: s.subcategoryId || null,
        discountFE: s.discountFE ?? null,
        serviceFee: s.serviceFee ?? service.defaultPrice ?? 0,
        studioExtra: s.studioExtra ?? 0,
        serviceFeeFE: s.serviceFeeFE ?? (hasDiscountFE ? s.discountFE : null),
        studioExtraFE: s.studioExtraFE ?? (hasDiscountFE ? 0 : null)
      };
      this.filterSubcategoriesByMacroCategory(this.editingService.macroCategory!);
    });
  }

  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
      return `${mins} min`;
    } else if (mins === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${mins}min`;
    }
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  }
}
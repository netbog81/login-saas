import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { AvailabilityStateService } from '../../../services/availability-state.service';
import { ServiceService } from '../../../services/service.service';
import { Service, CreateServiceInput, UpdateServiceInput } from '../../../graphql/types';

@Component({
  selector: 'app-service-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  editingService: Partial<CreateServiceInput> = {
    name: '',
    description: '',
    defaultDuration: 30,
    defaultPrice: 0,
    bufferTimeBefore: 0,
    bufferTimeAfter: 0,
    isActive: true,
    color: '#007bff'
  };

  // Filter and search
  searchTerm = '';
  showInactive = false;

  constructor(
    private availabilityState: AvailabilityStateService,
    private serviceService: ServiceService
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

  selectService(service: Service) {
    this.selectedService = service;
  }

  openServiceForm(service?: Service) {
    if (service) {
      this.selectedService = service;
      this.editingService = {
        name: service.name,
        description: service.description,
        defaultDuration: service.defaultDuration,
        defaultPrice: service.defaultPrice,
        bufferTimeBefore: service.bufferTimeBefore,
        bufferTimeAfter: service.bufferTimeAfter,
        isActive: service.isActive,
        color: service.color || '#007bff'
      };
    } else {
      this.selectedService = null;
      this.editingService = {
        name: '',
        description: '',
        defaultDuration: 30,
        defaultPrice: 0,
        bufferTimeBefore: 0,
        bufferTimeAfter: 0,
        isActive: true,
        color: '#007bff'
      };
    }
    this.showServiceForm = true;
  }

  closeServiceForm() {
    this.showServiceForm = false;
    this.selectedService = null;
    this.editingService = {
      name: '',
      description: '',
      defaultDuration: 30,
      defaultPrice: 0,
      bufferTimeBefore: 0,
      bufferTimeAfter: 0,
      isActive: true,
      color: '#007bff'
    };
  }

  saveService() {
    if (!this.editingService.name || !this.editingService.defaultDuration) {
      this.error = 'Nome e durata sono obbligatori';
      return;
    }

    this.loading = true;

    if (this.selectedService) {
      // Update existing service
      const input: UpdateServiceInput = {
        name: this.editingService.name,
        description: this.editingService.description,
        defaultDuration: this.editingService.defaultDuration!,
        defaultPrice: this.editingService.defaultPrice!,
        bufferTimeBefore: this.editingService.bufferTimeBefore,
        bufferTimeAfter: this.editingService.bufferTimeAfter,
        isActive: this.editingService.isActive,
        color: this.editingService.color
      };

      this.serviceService.updateService(this.selectedService.id, input)
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
      const input: CreateServiceInput = this.editingService as CreateServiceInput;

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
    if (!confirm(`Sei sicuro di voler eliminare il servizio "${service.name}"?\n\nQuesto rimuoverà anche tutte le assegnazioni agli operatori.`)) {
      return;
    }

    this.loading = true;
    this.serviceService.deleteService(service.id)
      .subscribe({
        next: () => {
          this.availabilityState.removeService(service.id);
          if (this.selectedService?.id === service.id) {
            this.selectedService = null;
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error deleting service:', error);
          this.error = 'Errore durante l\'eliminazione del servizio';
          this.loading = false;
        }
      });
  }

  duplicateService(service: Service) {
    this.openServiceForm();
    this.editingService = {
      name: `${service.name} (copia)`,
      description: service.description,
      defaultDuration: service.defaultDuration,
      defaultPrice: service.defaultPrice,
      bufferTimeBefore: service.bufferTimeBefore,
      bufferTimeAfter: service.bufferTimeAfter,
      isActive: service.isActive,
      color: service.color
    };
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
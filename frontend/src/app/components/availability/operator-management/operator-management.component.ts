import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { CdkOverlayOrigin, OverlayModule } from '@angular/cdk/overlay';
import { CdkMenuModule } from '@angular/cdk/menu';

import { AvailabilityStateService } from '../../../services/availability-state.service';
import { OperatorService } from '../../../services/operator.service';
import { ServiceService } from '../../../services/service.service';
import { Operator, OperatorType } from '../../../graphql/ui-types';
import { Service, MutationCreateOperatorArgs as CreateOperatorInput, MutationUpdateOperatorArgs as UpdateOperatorInput } from '../../../graphql/generated/types';

@Component({
  selector: 'app-operator-management',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayModule, CdkMenuModule],
  templateUrl: './operator-management.component.html',
  styleUrls: ['./operator-management.component.scss']
})
export class OperatorManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  operators: Operator[] = [];
  services: Service[] = [];
  selectedOperator: Operator | null = null;
  loading = false;
  error: string | null = null;

  // Form state
  showOperatorForm = false;
  isEditMode = false;
  editingOperatorId: string | null = null;
  editingOperator: Partial<CreateOperatorInput> & { type?: OperatorType; isActive?: boolean } = {
    name: '',
    email: '',
    type: OperatorType.Standard,
    maxConcurrentAppointments: 1,
    isActive: true
  };

  // Service assignment
  showServiceAssignment = false;
  selectedServices: string[] = [];
  operatorServices: { [operatorId: string]: Service[] } = {};

  OperatorType = OperatorType;

  constructor(
    private availabilityState: AvailabilityStateService,
    private operatorService: OperatorService,
    private serviceService: ServiceService
  ) {}

  ngOnInit() {
    // Subscribe to operators from state
    this.availabilityState.operators$
      .pipe(takeUntil(this.destroy$))
      .subscribe(operators => {
        this.operators = operators;
      });

    // Subscribe to services from state
    this.availabilityState.services$
      .pipe(takeUntil(this.destroy$))
      .subscribe(services => {
        this.services = services;
      });

    // Subscribe to selected operator
    this.availabilityState.selectedOperator$
      .pipe(takeUntil(this.destroy$))
      .subscribe(operator => {
        this.selectedOperator = operator;
        if (operator) {
          this.loadOperatorServices(operator.id);
        }
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
    this.loadOperators();
    this.loadServices();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOperators() {
    this.availabilityState.loadOperators();
  }

  loadServices() {
    this.availabilityState.loadServices();
  }

  selectOperator(operator: Operator) {
    this.availabilityState.selectOperator(operator.id);
  }

  openOperatorForm(operator?: Operator) {
    if (operator) {
      this.isEditMode = true;
      this.editingOperatorId = operator.id;
      this.editingOperator = {
        name: operator.name,
        email: operator.email,
        phone: operator.phone,
        type: operator.type,
        maxConcurrentAppointments: operator.maxConcurrentAppointments,
        isActive: operator.isActive
      };
    } else {
      this.isEditMode = false;
      this.editingOperatorId = null;
      this.editingOperator = {
        name: '',
        email: '',
        type: OperatorType.Standard,
        maxConcurrentAppointments: 1,
        isActive: true
      };
    }
    this.showOperatorForm = true;
    this.error = null; // Clear any previous errors
  }

  closeOperatorForm() {
    this.showOperatorForm = false;
    this.isEditMode = false;
    this.editingOperatorId = null;
    this.editingOperator = {
      name: '',
      email: '',
      type: OperatorType.Standard,
      maxConcurrentAppointments: 1,
      isActive: true
    };
    this.error = null;
  }

  saveOperator() {
    // Debug log to see actual values
    console.log('Saving operator with values:', this.editingOperator);

    // Trim whitespace from input values
    const name = this.editingOperator.name?.trim();
    const email = this.editingOperator.email?.trim();

    if (!name) {
      this.error = 'Il nome è obbligatorio';
      console.error('Validation failed - Name:', name);
      return;
    }

    this.loading = true;
    this.error = null;

    if (this.isEditMode && this.editingOperatorId) {
      // Update existing operator - include all fields
      const input: any = {
        name: name,
        email: email || undefined, // Make email optional
        phone: this.editingOperator.phone?.trim() || undefined,
        operatorType: this.editingOperator.type, // Send the type field as operatorType
        isActive: this.editingOperator.isActive,
        maxConcurrentAppointments: this.editingOperator.maxConcurrentAppointments
      };

      this.operatorService.updateOperator(this.editingOperatorId, input)
        .subscribe({
          next: (operator) => {
            // The service already handles the mapping
            this.availabilityState.updateOperator(operator);
            this.closeOperatorForm();
            this.loading = false;
          },
          error: (error) => {
            console.error('Error updating operator:', error);
            this.error = 'Errore durante l\'aggiornamento dell\'operatore';
            this.loading = false;
          }
        });
    } else {
      // Create new operator - map type to operatorType for backend
      const input: any = {
        name: name,
        email: email || undefined, // Make email optional
        phone: this.editingOperator.phone?.trim() || undefined,
        operatorType: this.editingOperator.type || OperatorType.Standard,
        maxConcurrentAppointments: this.editingOperator.maxConcurrentAppointments || 1
      };

      console.log('Creating operator with input:', input);
      this.operatorService.createOperator(input)
        .subscribe({
          next: (operator) => {
            console.log('Operator created successfully:', operator);
            // The service already handles the mapping
            this.availabilityState.addOperator(operator);
            this.closeOperatorForm();
            this.loading = false;
          },
          error: (error) => {
            console.error('Error creating operator - Full error:', error);
            if (error.graphQLErrors && error.graphQLErrors.length > 0) {
              console.error('GraphQL errors:', error.graphQLErrors);
              this.error = `Errore: ${error.graphQLErrors[0].message}`;
            } else if (error.networkError) {
              console.error('Network error:', error.networkError);
              this.error = 'Errore di rete durante la creazione dell\'operatore';
            } else if (error.message) {
              this.error = `Errore: ${error.message}`;
            } else {
              this.error = 'Errore durante la creazione dell\'operatore';
            }
            this.loading = false;
          }
        });
    }
  }

  deleteOperator(operator: Operator) {
    if (!confirm(`Sei sicuro di voler eliminare l'operatore ${operator.name}?`)) {
      return;
    }

    this.loading = true;
    this.operatorService.deleteOperator(operator.id)
      .subscribe({
        next: () => {
          this.availabilityState.removeOperator(operator.id);
          if (this.selectedOperator?.id === operator.id) {
            this.availabilityState.selectOperator(null);
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error deleting operator:', error);
          this.error = 'Errore durante l\'eliminazione dell\'operatore';
          this.loading = false;
        }
      });
  }

  openServiceAssignment(operator: Operator) {
    this.selectedOperator = operator;
    this.loadOperatorServices(operator.id);
    this.showServiceAssignment = true;
  }

  closeServiceAssignment() {
    this.showServiceAssignment = false;
    this.selectedServices = [];
  }

  loadOperatorServices(operatorId: string) {
    this.serviceService.getOperatorServices(operatorId)
      .subscribe({
        next: (operatorServices) => {
          const services = operatorServices.map(os => os.service).filter(s => s !== null) as Service[];
          this.operatorServices[operatorId] = services;
          this.selectedServices = services.map(s => s.id);
        },
        error: (error) => {
          console.error('Error loading operator services:', error);
        }
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
    const currentServiceIds = currentServices.map(s => s.id);

    // Find services to add and remove
    const toAdd = this.selectedServices.filter(id => !currentServiceIds.includes(id));
    const toRemove = currentServiceIds.filter(id => !this.selectedServices.includes(id));

    this.loading = true;

    // Process additions
    const addPromises = toAdd.map(serviceId =>
      this.serviceService.assignServiceToOperator({
        operatorId: this.selectedOperator!.id,
        serviceId: serviceId,
        customDuration: undefined
      }).toPromise()
    );

    // Process removals
    const removePromises = toRemove.map(serviceId =>
      this.serviceService.removeServiceFromOperator(
        this.selectedOperator!.id,
        serviceId
      ).toPromise()
    );

    Promise.all([...addPromises, ...removePromises])
      .then(() => {
        this.loadOperatorServices(this.selectedOperator!.id);
        this.closeServiceAssignment();
        this.loading = false;
      })
      .catch(error => {
        console.error('Error updating service assignments:', error);
        this.error = 'Errore durante l\'aggiornamento dei servizi';
        this.loading = false;
      });
  }

  getOperatorTypeLabel(type: OperatorType): string {
    switch (type) {
      case OperatorType.Standard:
        return 'Standard';
      case OperatorType.Gym:
        return 'Palestra';
      case OperatorType.Resource:
        return 'Risorsa';
      default:
        return type;
    }
  }
}
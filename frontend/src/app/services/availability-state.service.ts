import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, interval, switchMap, takeWhile } from 'rxjs';
import {
  Operator,
  Service,
  AvailabilityTemplate,
  AvailabilityException,
  OperatorService,
  AvailabilitySlot,
  DailyAvailability,
  GroupException
} from '../graphql/types';
import { OperatorService as OperatorApiService } from './operator.service';
import { ServiceService } from './service.service';

@Injectable({
  providedIn: 'root'
})
export class AvailabilityStateService {
  // State management with BehaviorSubjects
  private operatorsSubject = new BehaviorSubject<Operator[]>([]);
  private servicesSubject = new BehaviorSubject<Service[]>([]);
  private selectedOperatorSubject = new BehaviorSubject<Operator | null>(null);
  private operatorTemplatesSubject = new BehaviorSubject<AvailabilityTemplate[]>([]);
  private operatorExceptionsSubject = new BehaviorSubject<AvailabilityException[]>([]);
  private operatorServicesSubject = new BehaviorSubject<OperatorService[]>([]);
  private availabilityCacheSubject = new BehaviorSubject<Map<string, AvailabilitySlot[]>>(new Map());
  private groupExceptionsSubject = new BehaviorSubject<GroupException[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  private autoRefreshEnabledSubject = new BehaviorSubject<boolean>(false);
  private lastRefreshSubject = new BehaviorSubject<Date | null>(null);

  // Public observables
  public operators$ = this.operatorsSubject.asObservable();
  public services$ = this.servicesSubject.asObservable();
  public selectedOperator$ = this.selectedOperatorSubject.asObservable();
  public operatorTemplates$ = this.operatorTemplatesSubject.asObservable();
  public operatorExceptions$ = this.operatorExceptionsSubject.asObservable();
  public operatorServices$ = this.operatorServicesSubject.asObservable();
  public availabilityCache$ = this.availabilityCacheSubject.asObservable();
  public groupExceptions$ = this.groupExceptionsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();
  public autoRefreshEnabled$ = this.autoRefreshEnabledSubject.asObservable();
  public lastRefresh$ = this.lastRefreshSubject.asObservable();

  constructor(
    private operatorService: OperatorApiService,
    private serviceService: ServiceService
  ) {
    // Initialize auto-refresh when enabled
    this.autoRefreshEnabled$.pipe(
      switchMap(enabled =>
        enabled ? interval(60000) : [] // Refresh every 60 seconds
      ),
      takeWhile(() => this.autoRefreshEnabledSubject.value)
    ).subscribe(() => {
      this.refreshAvailability();
    });
  }

  // Load operators
  loadOperators(): void {
    this.setLoading(true);
    this.operatorService.getOperators().subscribe({
      next: (operators) => {
        this.operatorsSubject.next(operators);
        this.setLoading(false);
        this.setError(null);
      },
      error: (error) => {
        console.error('Error loading operators:', error);
        this.setError('Failed to load operators');
        this.setLoading(false);
      }
    });
  }

  // Load services
  loadServices(): void {
    this.setLoading(true);
    this.serviceService.getServices().subscribe({
      next: (services) => {
        this.servicesSubject.next(services);
        this.setLoading(false);
        this.setError(null);
      },
      error: (error) => {
        console.error('Error loading services:', error);
        this.setError('Failed to load services');
        this.setLoading(false);
      }
    });
  }

  // Select an operator
  selectOperator(operatorId: string | null): void {
    if (!operatorId) {
      this.selectedOperatorSubject.next(null);
      this.operatorTemplatesSubject.next([]);
      this.operatorExceptionsSubject.next([]);
      this.operatorServicesSubject.next([]);
      return;
    }

    this.setLoading(true);
    this.operatorService.getOperator(operatorId).subscribe({
      next: (operator) => {
        this.selectedOperatorSubject.next(operator);
        if (operator) {
          // Load related data
          this.loadOperatorTemplates(operator);
          this.loadOperatorExceptions(operator);
          this.loadOperatorServices(operatorId);
        }
        this.setLoading(false);
        this.setError(null);
      },
      error: (error) => {
        console.error('Error loading operator:', error);
        this.setError('Failed to load operator details');
        this.setLoading(false);
      }
    });
  }

  // Load operator templates
  private loadOperatorTemplates(operator: Operator): void {
    if (operator.availabilityTemplates) {
      this.operatorTemplatesSubject.next(operator.availabilityTemplates);
    }
  }

  // Load operator exceptions
  private loadOperatorExceptions(operator: Operator): void {
    if (operator.availabilityExceptions) {
      this.operatorExceptionsSubject.next(operator.availabilityExceptions);
    }
  }

  // Load operator services
  private loadOperatorServices(operatorId: string): void {
    this.serviceService.getOperatorServices(operatorId).subscribe({
      next: (services) => {
        this.operatorServicesSubject.next(services);
      },
      error: (error) => {
        console.error('Error loading operator services:', error);
      }
    });
  }

  // Load availability for date range
  loadAvailability(operatorId: string, startDate: string, endDate: string): void {
    this.setLoading(true);
    this.operatorService.getOperatorAvailability(operatorId, startDate, endDate).subscribe({
      next: (dailyAvailability) => {
        // Update cache
        const cache = new Map(this.availabilityCacheSubject.value);
        dailyAvailability.forEach(day => {
          cache.set(day.date, day.slots);
        });
        this.availabilityCacheSubject.next(cache);
        this.lastRefreshSubject.next(new Date());
        this.setLoading(false);
        this.setError(null);
      },
      error: (error) => {
        console.error('Error loading availability:', error);
        this.setError('Failed to load availability');
        this.setLoading(false);
      }
    });
  }

  // Add a new operator
  addOperator(operator: Operator): void {
    const operators = [...this.operatorsSubject.value, operator];
    this.operatorsSubject.next(operators);
  }

  // Update an operator
  updateOperator(operator: Operator): void {
    const operators = this.operatorsSubject.value.map(op =>
      op.id === operator.id ? operator : op
    );
    this.operatorsSubject.next(operators);

    // Update selected operator if it's the same
    if (this.selectedOperatorSubject.value?.id === operator.id) {
      this.selectedOperatorSubject.next(operator);
    }
  }

  // Remove an operator
  removeOperator(operatorId: string): void {
    const operators = this.operatorsSubject.value.filter(op => op.id !== operatorId);
    this.operatorsSubject.next(operators);

    // Clear selection if removed operator was selected
    if (this.selectedOperatorSubject.value?.id === operatorId) {
      this.selectedOperatorSubject.next(null);
    }
  }

  // Add a new service
  addService(service: Service): void {
    const services = [...this.servicesSubject.value, service];
    this.servicesSubject.next(services);
  }

  // Update a service
  updateService(service: Service): void {
    const services = this.servicesSubject.value.map(s =>
      s.id === service.id ? service : s
    );
    this.servicesSubject.next(services);
  }

  // Remove a service
  removeService(serviceId: string): void {
    const services = this.servicesSubject.value.filter(s => s.id !== serviceId);
    this.servicesSubject.next(services);
  }

  // Add a template
  addTemplate(template: AvailabilityTemplate): void {
    const templates = [...this.operatorTemplatesSubject.value, template];
    this.operatorTemplatesSubject.next(templates);
  }

  // Update a template
  updateTemplate(template: AvailabilityTemplate): void {
    const templates = this.operatorTemplatesSubject.value.map(t =>
      t.id === template.id ? template : t
    );
    this.operatorTemplatesSubject.next(templates);
  }

  // Remove a template
  removeTemplate(templateId: string): void {
    const templates = this.operatorTemplatesSubject.value.filter(t => t.id !== templateId);
    this.operatorTemplatesSubject.next(templates);
  }

  // Add an exception
  addException(exception: AvailabilityException): void {
    const exceptions = [...this.operatorExceptionsSubject.value, exception];
    this.operatorExceptionsSubject.next(exceptions);
  }

  // Cache availability for a specific date
  cacheAvailability(date: string, slots: AvailabilitySlot[]): void {
    const cache = new Map(this.availabilityCacheSubject.value);
    cache.set(date, slots);
    this.availabilityCacheSubject.next(cache);
  }

  // Get cached availability for a date
  getCachedAvailability(date: string): AvailabilitySlot[] | undefined {
    return this.availabilityCacheSubject.value.get(date);
  }

  // Clear cache
  clearCache(): void {
    this.availabilityCacheSubject.next(new Map());
  }

  // Enable/disable auto-refresh
  setAutoRefresh(enabled: boolean): void {
    this.autoRefreshEnabledSubject.next(enabled);
  }

  // Manual refresh
  refreshAvailability(): void {
    const selectedOperator = this.selectedOperatorSubject.value;
    if (selectedOperator) {
      // Refresh availability for the current month
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      this.loadAvailability(selectedOperator.id, startDate, endDate);
    }
  }

  // Set loading state
  private setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  // Set error state
  private setError(error: string | null): void {
    this.errorSubject.next(error);
  }

  // Clear all state
  clearState(): void {
    this.operatorsSubject.next([]);
    this.servicesSubject.next([]);
    this.selectedOperatorSubject.next(null);
    this.operatorTemplatesSubject.next([]);
    this.operatorExceptionsSubject.next([]);
    this.operatorServicesSubject.next([]);
    this.availabilityCacheSubject.next(new Map());
    this.groupExceptionsSubject.next([]);
    this.errorSubject.next(null);
    this.loadingSubject.next(false);
    this.autoRefreshEnabledSubject.next(false);
    this.lastRefreshSubject.next(null);
  }
}
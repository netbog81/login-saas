import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkMenuModule } from '@angular/cdk/menu';

import { OperatorManagementComponent } from '../operator-management/operator-management.component';
import { ServiceManagementComponent } from '../service-management/service-management.component';
import { TemplateManagement } from '../template-management/template-management';
import { OperatorTemplateAssignment } from '../operator-template-assignment/operator-template-assignment';
import { OperatorCategoryManagementComponent } from '../operator-category-management/operator-category-management.component';
import { InstrumentationManagementComponent } from '../instrumentation-management/instrumentation-management.component';
import { GymManagementComponent } from '../gym-management/gym-management.component';
import { ServiceSubcategoryManagementComponent } from '../service-subcategory-management/service-subcategory-management.component';
import { AvailabilityStateService } from '../../../services/availability-state.service';
import { Subject, takeUntil } from 'rxjs';

type TabType = 'operators' | 'categories' | 'services' | 'subcategories' | 'templates' | 'assignments' | 'instrumentation' | 'gyms' | 'calendar';

@Component({
  selector: 'app-availability-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CdkMenuModule,
    OperatorManagementComponent,
    OperatorCategoryManagementComponent,
    ServiceManagementComponent,
    TemplateManagement,
    OperatorTemplateAssignment,
    InstrumentationManagementComponent,
    GymManagementComponent,
    ServiceSubcategoryManagementComponent
  ],
  templateUrl: './availability-dashboard.component.html',
  styleUrls: ['./availability-dashboard.component.scss']
})
export class AvailabilityDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  activeTab: TabType = 'operators';

  // Statistics
  totalOperators = 0;
  activeOperators = 0;
  totalServices = 0;
  activeServices = 0;

  constructor(
    private availabilityState: AvailabilityStateService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    // Subscribe to operators for statistics
    this.availabilityState.operators$
      .pipe(takeUntil(this.destroy$))
      .subscribe(operators => {
        this.totalOperators = operators.length;
        this.activeOperators = operators.filter(op => op.isActive).length;
      });

    // Subscribe to services for statistics
    this.availabilityState.services$
      .pipe(takeUntil(this.destroy$))
      .subscribe(services => {
        this.totalServices = services.length;
        this.activeServices = services.filter(s => s.isActive).length;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setActiveTab(tab: TabType) {
    this.ngZone.run(() => {
      this.activeTab = tab;
    });
  }

  refreshData() {
    this.availabilityState.loadOperators();
    this.availabilityState.loadServices();

    const selectedOperator = this.availabilityState['selectedOperatorSubject'].value;
    if (selectedOperator) {
      this.availabilityState.refreshAvailability();
    }
  }
}
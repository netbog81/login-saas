import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkMenuModule } from '@angular/cdk/menu';

import { OperatorManagementComponent } from '../operator-management/operator-management.component';
import { ServiceManagementComponent } from '../service-management/service-management.component';
import { AvailabilityStateService } from '../../../services/availability-state.service';

type TabType = 'operators' | 'services' | 'templates' | 'calendar';

@Component({
  selector: 'app-availability-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CdkMenuModule,
    OperatorManagementComponent,
    ServiceManagementComponent
  ],
  templateUrl: './availability-dashboard.component.html',
  styleUrls: ['./availability-dashboard.component.scss']
})
export class AvailabilityDashboardComponent implements OnInit {
  activeTab: TabType = 'operators';

  // Statistics
  totalOperators = 0;
  activeOperators = 0;
  totalServices = 0;
  activeServices = 0;

  constructor(
    private availabilityState: AvailabilityStateService
  ) {}

  ngOnInit() {
    // Subscribe to operators for statistics
    this.availabilityState.operators$.subscribe(operators => {
      this.totalOperators = operators.length;
      this.activeOperators = operators.filter(op => op.isActive).length;
    });

    // Subscribe to services for statistics
    this.availabilityState.services$.subscribe(services => {
      this.totalServices = services.length;
      this.activeServices = services.filter(s => s.isActive).length;
    });
  }

  setActiveTab(tab: TabType) {
    this.activeTab = tab;
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
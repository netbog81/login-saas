import { Component, OnInit, OnDestroy, ViewContainerRef, Injector, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, combineLatest } from 'rxjs';
import { Overlay, OverlayRef, OverlayConfig, ConnectedPosition } from '@angular/cdk/overlay';
import { OverlayModule } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

// Services
import { CalendarStateService, CalendarConfig } from '../services/calendar-state.service';
import { ApiService } from '../../../services/api.service';

// Components
import { CalendarHeaderComponent } from '../calendar-header/calendar-header.component';
import { CalendarSidebarComponent } from '../calendar-sidebar/calendar-sidebar.component';
import { CalendarToolbarComponent } from '../calendar-toolbar/calendar-toolbar.component';
import { CalendarGridComponent } from '../calendar-grid/calendar-grid.component';
import { CalendarWeeklyGridComponent } from '../calendar-weekly-grid/calendar-weekly-grid.component';
import { EventDialogComponent, EventDialogData, EventDialogResult } from '../event-dialog/event-dialog.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { AppointmentSummaryComponent, SummaryAction } from '../appointment-summary/appointment-summary.component';
import { CellEvent } from '../calendar-cell/calendar-cell.component';
import { EventAction } from '../calendar-event/calendar-event.component';

// Models
import { Appointment } from '../../../models/appointment.model';
import { User } from '../../../models/user.model';
import { Patient } from '../../../models/patient.model';
import { Availability } from '../../../models/availability.model';

@Component({
  selector: 'app-calendar-container',
  standalone: true,
  imports: [
    CommonModule,
    OverlayModule,
    CalendarHeaderComponent,
    CalendarSidebarComponent,
    CalendarToolbarComponent,
    CalendarGridComponent,
    CalendarWeeklyGridComponent,
    EventDialogComponent,
    ConfirmDialogComponent,
    AppointmentSummaryComponent
  ],
  templateUrl: './calendar-container.component.html',
  styleUrls: ['./calendar-container.component.scss']
})
export class CalendarContainerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // State from service
  config!: CalendarConfig;
  currentDate!: Date;
  visibleDates: string[] = [];
  selectedOperators: User[] = [];
  allUsers: User[] = [];
  appointments: Map<number, Map<string, Appointment[]>> = new Map();
  availabilities: Map<number, Map<string, Availability[]>> = new Map();
  patients: Patient[] = [];
  sidebarCollapsed: boolean = false;
  timeSlots: any[] = [];

  // Dialog state
  showEventDialog: boolean = false;
  eventDialogData!: EventDialogData;
  showDeleteConfirmDialog: boolean = false;
  appointmentToDelete: Appointment | null = null;

  // Summary overlay
  summaryOverlayRef: OverlayRef | null = null;
  currentSummaryAppointment: Appointment | null = null;
  isSummaryOpen: boolean = false;

  // Drag state
  dragStartCell: CellEvent | null = null;
  dragCurrentCell: CellEvent | null = null;
  isDragging: boolean = false;

  // Loading state
  isLoading: boolean = false;

  constructor(
    public stateService: CalendarStateService,
    private apiService: ApiService,
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
    private injector: Injector
  ) {}

  ngOnInit(): void {
    this.subscribeToState();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.closeSummary();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToState(): void {
    // Subscribe to config
    this.stateService.config$
      .pipe(takeUntil(this.destroy$))
      .subscribe(config => {
        this.config = config;
        this.loadAppointmentsForCurrentView();
      });

    // Subscribe to current date
    this.stateService.currentDate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(date => {
        this.currentDate = date;
        this.loadAppointmentsForCurrentView();
      });

    // Subscribe to view
    this.stateService.view$
      .pipe(takeUntil(this.destroy$))
      .subscribe(view => {
        this.visibleDates = view.visibleDates;
        this.timeSlots = view.timeSlots;
      });

    // Subscribe to selected operators
    this.stateService.selectedOperators$
      .pipe(takeUntil(this.destroy$))
      .subscribe(operators => {
        this.selectedOperators = operators;
      });

    // Subscribe to appointments
    this.stateService.appointments$
      .pipe(takeUntil(this.destroy$))
      .subscribe(appointments => {
        this.appointments = appointments;
      });

    // Subscribe to availabilities
    this.stateService.availabilities$
      .pipe(takeUntil(this.destroy$))
      .subscribe(availabilities => {
        this.availabilities = availabilities;
      });

    // Subscribe to sidebar state
    this.stateService.sidebarCollapsed$
      .pipe(takeUntil(this.destroy$))
      .subscribe(collapsed => {
        this.sidebarCollapsed = collapsed;
      });
  }

  private async loadInitialData(): Promise<void> {
    try {
      this.isLoading = true;

      // Load users
      const users = await this.apiService.getUsers().toPromise();
      this.allUsers = users || [];

      // Select all active users by default
      const activeUsers = this.allUsers.filter(u => u.active);
      this.stateService.setSelectedOperators(activeUsers);

      // Load patients
      const patients = await this.apiService.getPatients().toPromise();
      this.patients = patients || [];

      this.isLoading = false;
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.isLoading = false;
    }
  }

  private async loadAppointmentsForCurrentView(): Promise<void> {
    if (this.selectedOperators.length === 0) return;

    try {
      const appointmentsMap = new Map<number, Map<string, Appointment[]>>();
      const availabilitiesMap = new Map<number, Map<string, Availability[]>>();

      if (this.config.viewType === 'daily') {
        const dateStr = this.formatDate(this.currentDate);

        for (const user of this.selectedOperators) {
          const appointments = await this.apiService.getAppointmentsByDate(dateStr, user.id).toPromise();
          const availabilities = await this.apiService.getAvailabilitiesByDate(dateStr, user.id).toPromise();

          if (!appointmentsMap.has(user.id)) {
            appointmentsMap.set(user.id, new Map());
          }
          appointmentsMap.get(user.id)!.set(dateStr, appointments || []);

          if (!availabilitiesMap.has(user.id)) {
            availabilitiesMap.set(user.id, new Map());
          }
          availabilitiesMap.get(user.id)!.set(dateStr, availabilities || []);
        }
      } else {
        // Weekly view
        const startDate = this.visibleDates[0];
        const endDate = this.visibleDates[this.visibleDates.length - 1];

        for (const user of this.selectedOperators) {
          const appointments = await this.apiService.getAppointmentsByDateRange(startDate, endDate, user.id).toPromise();
          const availabilities = await this.apiService.getAvailabilitiesByDateRange(startDate, endDate, user.id).toPromise();

          if (!appointmentsMap.has(user.id)) {
            appointmentsMap.set(user.id, new Map());
          }

          // Group by date
          const userDateMap = appointmentsMap.get(user.id)!;
          (appointments || []).forEach(apt => {
            if (!userDateMap.has(apt.date)) {
              userDateMap.set(apt.date, []);
            }
            userDateMap.get(apt.date)!.push(apt);
          });

          // Group availabilities by date
          if (!availabilitiesMap.has(user.id)) {
            availabilitiesMap.set(user.id, new Map());
          }
          const userAvailMap = availabilitiesMap.get(user.id)!;
          (availabilities || []).forEach(avail => {
            if (!userAvailMap.has(avail.date)) {
              userAvailMap.set(avail.date, []);
            }
            userAvailMap.get(avail.date)!.push(avail);
          });
        }
      }

      this.stateService.setAppointments(appointmentsMap);
      this.stateService.setAvailabilities(availabilitiesMap);
    } catch (error) {
      console.error('Error loading appointments:', error);
    }
  }

  // Header events
  onNavigateToday(): void {
    this.stateService.navigateToToday();
  }

  onNavigatePrevious(): void {
    this.stateService.navigatePrevious();
  }

  onNavigateNext(): void {
    this.stateService.navigateNext();
  }

  onViewTypeChange(viewType: 'daily' | 'weekly'): void {
    this.stateService.updateConfig({ viewType });
  }

  // Sidebar events
  onUserToggle(user: User): void {
    this.stateService.toggleOperator(user);
  }

  onSelectAllUsers(): void {
    this.stateService.setSelectedOperators(this.allUsers.filter(u => u.active));
  }

  onDeselectAllUsers(): void {
    this.stateService.setSelectedOperators([]);
  }

  onToggleSidebar(): void {
    this.stateService.toggleSidebar();
  }

  // Toolbar events
  onConfigChange(configUpdate: Partial<CalendarConfig>): void {
    this.stateService.updateConfig(configUpdate);
  }

  // Grid cell events
  onCellMouseDown(event: CellEvent): void {
    // If summary is open, close it and don't start dragging
    if (this.isSummaryOpen) {
      this.closeSummary();
      return;
    }

    this.dragStartCell = event;
    this.dragCurrentCell = event;
    this.isDragging = true;
  }

  onCellMouseEnter(event: CellEvent): void {
    if (this.isDragging) {
      this.dragCurrentCell = event;
    }
  }

  onCellMouseUp(event: CellEvent): void {
    // Don't create appointment if we just closed the summary
    if (this.isDragging && this.dragStartCell && !this.isSummaryOpen) {
      this.createAppointmentFromDrag();
    }
    this.isDragging = false;
    this.dragStartCell = null;
    this.dragCurrentCell = null;
  }

  onCellDblClick(event: CellEvent): void {
    // Close summary if open
    if (this.isSummaryOpen) {
      this.closeSummary();
    }

    this.openEventDialog({
      defaultDate: event.date,
      defaultStartTime: event.timeSlot.time,
      defaultEndTime: this.addMinutesToTime(event.timeSlot.time, this.config.slotDuration),
      defaultUserId: event.userId,
      users: this.allUsers,
      patients: this.patients
    });
  }

  private createAppointmentFromDrag(): void {
    if (!this.dragStartCell || !this.dragCurrentCell) return;

    const startTime = this.dragStartCell.timeSlot.time;
    const endTime = this.addMinutesToTime(this.dragCurrentCell.timeSlot.time, this.config.slotDuration);

    this.openEventDialog({
      defaultDate: this.dragStartCell.date,
      defaultStartTime: startTime,
      defaultEndTime: endTime,
      defaultUserId: this.dragStartCell.userId,
      users: this.allUsers,
      patients: this.patients
    });
  }

  // Event events
  onEventClick(action: EventAction): void {
    // Show appointment summary on click
    this.showAppointmentSummary(action.appointment, action.mouseEvent);
  }

  onEventDblClick(action: EventAction): void {
    this.openEventDialog({
      appointment: action.appointment,
      users: this.allUsers,
      patients: this.patients
    });
  }

  onEventDragStart(appointment: Appointment): void {
    console.log('Event drag started:', appointment);
  }

  async onEventDragEnd(action: EventAction): Promise<void> {
    if (!action.newStartTime || !action.newEndTime) return;

    try {
      const updated: Appointment = {
        ...action.appointment,
        startTime: action.newStartTime,
        endTime: action.newEndTime
      };

      await this.apiService.updateAppointment(updated.id, updated).toPromise();
      this.stateService.updateAppointment(updated);
    } catch (error) {
      console.error('Error updating appointment:', error);
      alert('Errore durante lo spostamento dell\'appuntamento');
    }
  }

  async onEventResize(action: EventAction): Promise<void> {
    if (!action.newEndTime) return;

    try {
      const updated: Appointment = {
        ...action.appointment,
        endTime: action.newEndTime
      };

      await this.apiService.updateAppointment(updated.id, updated).toPromise();
      this.stateService.updateAppointment(updated);
    } catch (error) {
      console.error('Error resizing appointment:', error);
      alert('Errore durante il ridimensionamento dell\'appuntamento');
    }
  }

  async onEventDelete(action: EventAction): Promise<void> {
    this.appointmentToDelete = action.appointment;
    this.showDeleteConfirmDialog = true;
  }

  // Dialog events
  openEventDialog(data: EventDialogData): void {
    this.eventDialogData = data;
    this.showEventDialog = true;
  }

  async onDialogResult(result: EventDialogResult): Promise<void> {
    this.showEventDialog = false;

    if (result.action === 'cancel') {
      return;
    }

    if (result.action === 'delete' && result.appointment) {
      await this.deleteAppointment(result.appointment);
    }

    if (result.action === 'save' && result.appointment) {
      await this.saveAppointment(result.appointment);
    }
  }

  private async saveAppointment(appointment: Appointment): Promise<void> {
    try {
      if (appointment.id) {
        // Update
        const updated = await this.apiService.updateAppointment(appointment.id, appointment).toPromise();
        this.stateService.updateAppointment(updated!);
      } else {
        // Create (API returns array for recurring appointments)
        const createdArray = await this.apiService.createAppointment(appointment).toPromise();
        if (createdArray && createdArray.length > 0) {
          // Add all created appointments (could be multiple if recurring)
          createdArray.forEach(apt => this.stateService.addAppointment(apt));
        }
      }
    } catch (error) {
      console.error('Error saving appointment:', error);
      alert('Errore durante il salvataggio dell\'appuntamento');
    }
  }

  private async deleteAppointment(appointment: Appointment): Promise<void> {
    try {
      await this.apiService.deleteAppointment(appointment.id).toPromise();
      this.stateService.removeAppointment(appointment.id);
      await this.loadAppointmentsForCurrentView();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('Errore durante l\'eliminazione dell\'appuntamento');
    }
  }

  async onDeleteConfirm(): Promise<void> {
    this.showDeleteConfirmDialog = false;
    if (this.appointmentToDelete) {
      await this.deleteAppointment(this.appointmentToDelete);
      this.appointmentToDelete = null;
    }
  }

  onDeleteCancel(): void {
    this.showDeleteConfirmDialog = false;
    this.appointmentToDelete = null;
  }

  // Utility methods
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private addMinutesToTime(time: string, minutes: number): string {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }

  get slotHeight(): number {
    return Math.round(60 * this.config.zoom);
  }

  get mainDate(): string {
    return this.config.viewType === 'daily' ? this.formatDate(this.currentDate) : this.visibleDates[0];
  }

  // Appointment Summary methods
  showAppointmentSummary(appointment: Appointment, event?: MouseEvent): void {
    console.log('showAppointmentSummary called', appointment, event);

    // If summary is already open for a different appointment, close it first
    if (this.isSummaryOpen && this.currentSummaryAppointment?.id !== appointment.id) {
      this.closeSummary();
    }

    // If same appointment, just close it
    if (this.currentSummaryAppointment?.id === appointment.id && this.isSummaryOpen) {
      this.closeSummary();
      return;
    }

    // Get the event element position
    const target = event?.target as HTMLElement;
    if (!target) {
      console.log('No target element');
      return;
    }

    const eventElement = target.closest('.calendar-event') as HTMLElement;
    if (!eventElement) {
      console.log('No .calendar-event element found');
      return;
    }

    // Create overlay
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(eventElement)
      .withPositions([
        // Try to show on the right
        {
          originX: 'end',
          originY: 'top',
          overlayX: 'start',
          overlayY: 'top',
          offsetX: 8
        },
        // If no space on right, show on left
        {
          originX: 'start',
          originY: 'top',
          overlayX: 'end',
          overlayY: 'top',
          offsetX: -8
        },
        // If no horizontal space, show below
        {
          originX: 'start',
          originY: 'bottom',
          overlayX: 'start',
          overlayY: 'top',
          offsetY: 8
        },
        // If no space below, show above
        {
          originX: 'start',
          originY: 'top',
          overlayX: 'start',
          overlayY: 'bottom',
          offsetY: -8
        }
      ]);

    const overlayConfig = new OverlayConfig({
      positionStrategy,
      hasBackdrop: false,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      panelClass: 'appointment-summary-overlay'
    });

    this.summaryOverlayRef = this.overlay.create(overlayConfig);
    console.log('Overlay created', this.summaryOverlayRef);
    console.log('Overlay host element:', this.summaryOverlayRef.hostElement);
    console.log('Overlay pane element:', this.summaryOverlayRef.overlayElement);

    // Create component portal
    const portal = new ComponentPortal(AppointmentSummaryComponent, this.viewContainerRef);
    const componentRef = this.summaryOverlayRef.attach(portal);
    console.log('Component attached', componentRef);

    // Set component inputs
    componentRef.instance.appointment = appointment;
    componentRef.instance.user = this.getUserById(appointment.userId);

    // Handle component outputs
    componentRef.instance.action.subscribe((action: SummaryAction) => {
      this.handleSummaryAction(action);
    });

    componentRef.instance.clickOutside.subscribe(() => {
      if (!this.isDragging) {
        this.closeSummary();
      }
    });

    this.currentSummaryAppointment = appointment;
    this.isSummaryOpen = true;
    console.log('Summary should be open now', this.isSummaryOpen);

    // Force update position after the component is rendered
    setTimeout(() => {
      this.summaryOverlayRef?.updatePosition();
      console.log('Position updated');
    }, 0);
  }

  closeSummary(): void {
    if (this.summaryOverlayRef) {
      this.summaryOverlayRef.dispose();
      this.summaryOverlayRef = null;
    }
    this.currentSummaryAppointment = null;
    this.isSummaryOpen = false;
  }

  handleSummaryAction(action: SummaryAction): void {
    switch (action.type) {
      case 'edit':
        this.closeSummary();
        this.openEventDialog({
          appointment: action.appointment,
          users: this.allUsers,
          patients: this.patients
        });
        break;
      case 'delete':
        this.closeSummary();
        this.appointmentToDelete = action.appointment;
        this.showDeleteConfirmDialog = true;
        break;
      case 'share':
        this.shareAppointment(action.appointment, action.shareMethod);
        break;
      case 'close':
        this.closeSummary();
        break;
    }
  }

  shareAppointment(appointment: Appointment, method?: 'email' | 'whatsapp'): void {
    const user = this.getUserById(appointment.userId);
    const text = `Appuntamento: ${appointment.title}\nData: ${this.formatDateLocalized(new Date(appointment.date + 'T00:00:00'))}\nOra: ${appointment.startTime} - ${appointment.endTime}\nOperatore: ${user?.name || 'N/A'}${appointment.notes ? '\nNote: ' + appointment.notes : ''}`;

    if (method === 'whatsapp') {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, '_blank');
    } else if (method === 'email') {
      const subject = `Appuntamento - ${appointment.title}`;
      const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
      window.location.href = mailtoUrl;
    }
  }

  getUserById(userId: number): User | undefined {
    return this.allUsers.find(u => u.id === userId);
  }

  private formatDateLocalized(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('it-IT', options);
  }
}

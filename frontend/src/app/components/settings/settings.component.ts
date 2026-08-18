import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { SettingsService, GeneralSetting, AppointmentClickAction } from '../../services/settings.service';
import {
  NavigationSettingsService,
  NAV_SHOW_REGISTRY_KEY,
  NAV_SHOW_ACCOUNTING_KEY,
} from '../../services/navigation-settings.service';

interface AppointmentSettings {
  defaultSlotDuration: number;
  slotDurationPriority: 'operator' | 'system';
}

interface CalendarSettingsForm {
  startHour: number;
  endHour: number;
  showWorkingHoursOnly: boolean;
  showWeekend: boolean;
  slotDuration: number;
  defaultView: 'daily' | 'weekly';
  showUnavailableCellsBackground: boolean;
  blockAppointmentsOutsideAvailability: boolean;
  operatorsSelectedOnLoad: boolean;
  showGymInstructorsInOperators: boolean;
  defaultOperatorCategory: string;
  appointmentClickAction: AppointmentClickAction;
}

interface AutoAttendanceSettings {
  enabled: boolean;
  offsetMinutes: number;
}

interface NavigationSettings {
  showRegistryLink: boolean;
  showAccountingLink: boolean;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  appointmentSettings: AppointmentSettings = {
    defaultSlotDuration: 45,
    slotDurationPriority: 'operator',
  };
  originalSettings: AppointmentSettings = { ...this.appointmentSettings };

  calendarSettings: CalendarSettingsForm = {
    startHour: 7,
    endHour: 21,
    showWorkingHoursOnly: true,
    showWeekend: true,
    slotDuration: 15,
    defaultView: 'daily',
    showUnavailableCellsBackground: true,
    blockAppointmentsOutsideAvailability: false,
    operatorsSelectedOnLoad: false,
    showGymInstructorsInOperators: true,
    defaultOperatorCategory: 'all',
    appointmentClickAction: 'edit-first',
  };
  originalCalendarSettings: CalendarSettingsForm = { ...this.calendarSettings };

  autoAttendanceSettings: AutoAttendanceSettings = {
    enabled: false,
    offsetMinutes: 0,
  };
  originalAutoAttendanceSettings: AutoAttendanceSettings = { ...this.autoAttendanceSettings };

  // Visibilità dei link cross-modulo (Anagrafiche/Contabilità) nel menu.
  navigationSettings: NavigationSettings = {
    showRegistryLink: true,
    showAccountingLink: true,
  };
  originalNavigationSettings: NavigationSettings = { ...this.navigationSettings };

  // Auto-start trattamento: apre automaticamente il trattamento quando il
  // paziente è segnato presentato (solo se ha un unico percorso attivo).
  autoStartTreatmentEnabled = false;
  originalAutoStartTreatmentEnabled = false;
  // Limita l'auto-start ai soli appuntamenti di oggi.
  autoStartTreatmentOnlyToday = true;
  originalAutoStartTreatmentOnlyToday = true;

  // UI State
  loading = false;
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Options
  durationOptions = [15, 30, 45, 60];
  priorityOptions: { value: 'operator' | 'system'; label: string }[] = [
    { value: 'operator', label: 'Preferenza Operatore' },
    { value: 'system', label: 'Impostazione Sistema' },
  ];

  // Calendar options
  hourOptions = Array.from({ length: 24 }, (_, i) => i);
  calendarSlotOptions = [5, 10, 15, 20, 30, 45, 60];
  viewOptions: { value: 'daily' | 'weekly'; label: string }[] = [
    { value: 'daily', label: 'Giornaliera' },
    { value: 'weekly', label: 'Settimanale' },
  ];

  constructor(
    private settingsService: SettingsService,
    private navigationSettingsService: NavigationSettingsService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSettings(): void {
    this.loading = true;
    this.error = null;

    // Load all settings in parallel
    forkJoin({
      duration: this.settingsService.getSetting('appointment.defaultSlotDuration'),
      priority: this.settingsService.getSetting('appointment.slotDurationPriority'),
      calendarSettings: this.settingsService.getCalendarSettings(),
      autoAttendanceEnabled: this.settingsService.getSetting('autoAttendance.enabled'),
      autoAttendanceOffset: this.settingsService.getSetting('autoAttendance.offsetMinutes'),
      autoStartTreatment: this.settingsService.getSetting('autoStartTreatment.onAttended'),
      autoStartTreatmentOnlyToday: this.settingsService.getSetting('autoStartTreatment.onlyToday'),
      navShowRegistry: this.settingsService.getSetting(NAV_SHOW_REGISTRY_KEY),
      navShowAccounting: this.settingsService.getSetting(NAV_SHOW_ACCOUNTING_KEY),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          // Appointment settings
          if (results.duration) {
            this.appointmentSettings.defaultSlotDuration = results.duration.value as number;
          }
          if (results.priority) {
            this.appointmentSettings.slotDurationPriority = results.priority.value as 'operator' | 'system';
          }
          this.originalSettings = { ...this.appointmentSettings };

          // Calendar settings
          if (results.calendarSettings) {
            this.calendarSettings = { ...results.calendarSettings };
            this.originalCalendarSettings = { ...results.calendarSettings };
          }

          // Auto Attendance settings
          if (results.autoAttendanceEnabled) {
            this.autoAttendanceSettings.enabled = results.autoAttendanceEnabled.value as boolean;
          }
          if (results.autoAttendanceOffset) {
            this.autoAttendanceSettings.offsetMinutes = results.autoAttendanceOffset.value as number;
          }
          this.originalAutoAttendanceSettings = { ...this.autoAttendanceSettings };

          // Auto-start trattamento
          if (results.autoStartTreatment) {
            this.autoStartTreatmentEnabled = results.autoStartTreatment.value as boolean;
          }
          this.originalAutoStartTreatmentEnabled = this.autoStartTreatmentEnabled;
          if (results.autoStartTreatmentOnlyToday) {
            this.autoStartTreatmentOnlyToday = results.autoStartTreatmentOnlyToday.value as boolean;
          }
          this.originalAutoStartTreatmentOnlyToday = this.autoStartTreatmentOnlyToday;

          // Navigazione (chiave assente = default "mostra")
          if (results.navShowRegistry) {
            this.navigationSettings.showRegistryLink = results.navShowRegistry.value !== false;
          }
          if (results.navShowAccounting) {
            this.navigationSettings.showAccountingLink = results.navShowAccounting.value !== false;
          }
          this.originalNavigationSettings = { ...this.navigationSettings };

          this.loading = false;
        },
        error: (err) => {
          this.error = 'Errore nel caricamento delle impostazioni';
          this.loading = false;
          console.error('Error loading settings:', err);
        },
      });
  }

  saveSettings(): void {
    this.ngZone.run(() => {
      this.saving = true;
      this.error = null;
      this.successMessage = null;
    });

    forkJoin({
      // Appointment settings
      duration: this.settingsService.updateSetting(
        'appointment.defaultSlotDuration',
        this.appointmentSettings.defaultSlotDuration
      ),
      priority: this.settingsService.updateSetting(
        'appointment.slotDurationPriority',
        this.appointmentSettings.slotDurationPriority
      ),
      // Calendar settings
      calStartHour: this.settingsService.updateSetting(
        'calendar.startHour',
        this.calendarSettings.startHour
      ),
      calEndHour: this.settingsService.updateSetting(
        'calendar.endHour',
        this.calendarSettings.endHour
      ),
      calShowWorkingHoursOnly: this.settingsService.updateSetting(
        'calendar.showWorkingHoursOnly',
        this.calendarSettings.showWorkingHoursOnly
      ),
      calShowWeekend: this.settingsService.updateSetting(
        'calendar.showWeekend',
        this.calendarSettings.showWeekend
      ),
      calSlotDuration: this.settingsService.updateSetting(
        'calendar.slotDuration',
        this.calendarSettings.slotDuration
      ),
      calDefaultView: this.settingsService.updateSetting(
        'calendar.defaultView',
        this.calendarSettings.defaultView
      ),
      calShowUnavailableCellsBackground: this.settingsService.updateSetting(
        'calendar.showUnavailableCellsBackground',
        this.calendarSettings.showUnavailableCellsBackground
      ),
      // Upsert: la chiave puo' non esistere su tenant non ri-seedati
      calBlockOutsideAvailability: this.settingsService.upsertSetting(
        'calendar.blockAppointmentsOutsideAvailability',
        this.calendarSettings.blockAppointmentsOutsideAvailability,
        { valueType: 'boolean', category: 'calendar' }
      ),
      calOperatorsSelectedOnLoad: this.settingsService.upsertSetting(
        'calendar.operatorsSelectedOnLoad',
        this.calendarSettings.operatorsSelectedOnLoad,
        { valueType: 'boolean', category: 'calendar' }
      ),
      calShowGymInstructorsInOperators: this.settingsService.upsertSetting(
        'calendar.showGymInstructorsInOperators',
        this.calendarSettings.showGymInstructorsInOperators,
        { valueType: 'boolean', category: 'calendar' }
      ),
      calDefaultOperatorCategory: this.settingsService.upsertSetting(
        'calendar.defaultOperatorCategory',
        this.calendarSettings.defaultOperatorCategory,
        { valueType: 'string', category: 'calendar' }
      ),
      calAppointmentClickAction: this.settingsService.upsertSetting(
        'calendar.appointmentClickAction',
        this.calendarSettings.appointmentClickAction,
        { valueType: 'string', category: 'calendar' }
      ),
      // Auto Attendance settings
      autoAttendanceEnabled: this.settingsService.updateSetting(
        'autoAttendance.enabled',
        this.autoAttendanceSettings.enabled
      ),
      autoAttendanceOffset: this.settingsService.updateSetting(
        'autoAttendance.offsetMinutes',
        this.autoAttendanceSettings.offsetMinutes
      ),
      // Auto-start trattamento (upsert: chiave può non esistere su tenant
      // non ri-seedati).
      autoStartTreatment: this.settingsService.upsertSetting(
        'autoStartTreatment.onAttended',
        this.autoStartTreatmentEnabled,
        { valueType: 'boolean', category: 'autoStartTreatment' }
      ),
      autoStartTreatmentOnlyToday: this.settingsService.upsertSetting(
        'autoStartTreatment.onlyToday',
        this.autoStartTreatmentOnlyToday,
        { valueType: 'boolean', category: 'autoStartTreatment' }
      ),
      // Navigazione (upsert: chiavi non seedate sui tenant esistenti).
      navShowRegistry: this.settingsService.upsertSetting(
        NAV_SHOW_REGISTRY_KEY,
        this.navigationSettings.showRegistryLink,
        { valueType: 'boolean', category: 'navigation' }
      ),
      navShowAccounting: this.settingsService.upsertSetting(
        NAV_SHOW_ACCOUNTING_KEY,
        this.navigationSettings.showAccountingLink,
        { valueType: 'boolean', category: 'navigation' }
      ),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.originalSettings = { ...this.appointmentSettings };
          this.originalCalendarSettings = { ...this.calendarSettings };
          this.originalAutoAttendanceSettings = { ...this.autoAttendanceSettings };
          this.originalAutoStartTreatmentEnabled = this.autoStartTreatmentEnabled;
          this.originalAutoStartTreatmentOnlyToday = this.autoStartTreatmentOnlyToday;
          this.originalNavigationSettings = { ...this.navigationSettings };
          // Il menu principale si aggiorna subito, senza reload.
          this.navigationSettingsService.apply(
            this.navigationSettings.showRegistryLink,
            this.navigationSettings.showAccountingLink
          );
          this.saving = false;
          this.successMessage = 'Impostazioni salvate con successo';
          setTimeout(() => {
            this.successMessage = null;
          }, 3000);
        },
        error: (err) => {
          this.error = 'Errore nel salvataggio delle impostazioni';
          this.saving = false;
          console.error('Error saving settings:', err);
        },
      });
  }

  resetSettings(): void {
    this.ngZone.run(() => {
      this.appointmentSettings = { ...this.originalSettings };
      this.calendarSettings = { ...this.originalCalendarSettings };
      this.autoAttendanceSettings = { ...this.originalAutoAttendanceSettings };
      this.navigationSettings = { ...this.originalNavigationSettings };
      this.error = null;
      this.successMessage = null;
    });
  }

  hasChanges(): boolean {
    const appointmentChanged =
      this.appointmentSettings.defaultSlotDuration !== this.originalSettings.defaultSlotDuration ||
      this.appointmentSettings.slotDurationPriority !== this.originalSettings.slotDurationPriority;

    const calendarChanged =
      this.calendarSettings.startHour !== this.originalCalendarSettings.startHour ||
      this.calendarSettings.endHour !== this.originalCalendarSettings.endHour ||
      this.calendarSettings.showWorkingHoursOnly !== this.originalCalendarSettings.showWorkingHoursOnly ||
      this.calendarSettings.showWeekend !== this.originalCalendarSettings.showWeekend ||
      this.calendarSettings.slotDuration !== this.originalCalendarSettings.slotDuration ||
      this.calendarSettings.defaultView !== this.originalCalendarSettings.defaultView ||
      this.calendarSettings.showUnavailableCellsBackground !== this.originalCalendarSettings.showUnavailableCellsBackground ||
      this.calendarSettings.blockAppointmentsOutsideAvailability !== this.originalCalendarSettings.blockAppointmentsOutsideAvailability ||
      this.calendarSettings.operatorsSelectedOnLoad !== this.originalCalendarSettings.operatorsSelectedOnLoad ||
      this.calendarSettings.showGymInstructorsInOperators !== this.originalCalendarSettings.showGymInstructorsInOperators ||
      this.calendarSettings.defaultOperatorCategory !== this.originalCalendarSettings.defaultOperatorCategory ||
      this.calendarSettings.appointmentClickAction !== this.originalCalendarSettings.appointmentClickAction;

    const autoAttendanceChanged =
      this.autoAttendanceSettings.enabled !== this.originalAutoAttendanceSettings.enabled ||
      this.autoAttendanceSettings.offsetMinutes !== this.originalAutoAttendanceSettings.offsetMinutes;

    const autoStartTreatmentChanged =
      this.autoStartTreatmentEnabled !== this.originalAutoStartTreatmentEnabled ||
      this.autoStartTreatmentOnlyToday !== this.originalAutoStartTreatmentOnlyToday;

    const navigationChanged =
      this.navigationSettings.showRegistryLink !== this.originalNavigationSettings.showRegistryLink ||
      this.navigationSettings.showAccountingLink !== this.originalNavigationSettings.showAccountingLink;

    return appointmentChanged || calendarChanged || autoAttendanceChanged || autoStartTreatmentChanged || navigationChanged;
  }

  // Force change detection when settings change
  onSettingChange(): void {
    this.ngZone.run(() => {
      // Se gli istruttori palestra vengono nascosti ma erano la categoria di
      // default, si ricade su "tutte" (la categoria non sarebbe più valida).
      if (!this.calendarSettings.showGymInstructorsInOperators &&
          this.calendarSettings.defaultOperatorCategory === 'gym_instructor') {
        this.calendarSettings.defaultOperatorCategory = 'all';
      }
    });
  }

  formatHour(hour: number): string {
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  initializeDefaults(): void {
    this.ngZone.run(() => {
      this.loading = true;
      this.error = null;

      this.settingsService
        .initializeDefaults()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadSettings();
            this.successMessage = 'Impostazioni predefinite inizializzate';
            setTimeout(() => {
              this.successMessage = null;
            }, 3000);
          },
          error: (err) => {
            this.error = 'Errore nell\'inizializzazione delle impostazioni';
            this.loading = false;
            console.error('Error initializing defaults:', err);
          },
        });
    });
  }
}

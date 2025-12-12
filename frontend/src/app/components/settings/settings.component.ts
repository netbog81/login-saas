import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { SettingsService, GeneralSetting } from '../../services/settings.service';

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
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  };
  originalCalendarSettings: CalendarSettingsForm = { ...this.calendarSettings };

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
  calendarSlotOptions = [5, 10, 15, 20, 30, 60];
  viewOptions: { value: 'daily' | 'weekly'; label: string }[] = [
    { value: 'daily', label: 'Giornaliera' },
    { value: 'weekly', label: 'Settimanale' },
  ];

  constructor(private settingsService: SettingsService) {}

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
    this.saving = true;
    this.error = null;
    this.successMessage = null;

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
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.originalSettings = { ...this.appointmentSettings };
          this.originalCalendarSettings = { ...this.calendarSettings };
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
    this.appointmentSettings = { ...this.originalSettings };
    this.calendarSettings = { ...this.originalCalendarSettings };
    this.error = null;
    this.successMessage = null;
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
      this.calendarSettings.showUnavailableCellsBackground !== this.originalCalendarSettings.showUnavailableCellsBackground;

    return appointmentChanged || calendarChanged;
  }

  formatHour(hour: number): string {
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  initializeDefaults(): void {
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
  }
}

/**
 * Calendar Sync Settings Container
 * Layer 2: Smart Component
 */

import {
  Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';

import {
  CalendarSyncSettingsPanelComponent,
} from '../components/calendar-sync-settings-panel/calendar-sync-settings-panel.component';
import { OperatorGoogleCalendarService } from '../../operator-google-calendar/services/operator-google-calendar.service';
import { CalendarSyncSettings } from '../../operator-google-calendar/models/operator-google-calendar.model';

@Component({
  selector: 'app-calendar-sync-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CalendarSyncSettingsPanelComponent],
  template: `
    <app-calendar-sync-settings-panel
      [settings]="settings"
      [loading]="loading"
      [saving]="saving"
      (keepPast)="save({ keepPastAppointments: $event })"
      (keepCalendar)="save({ keepCalendarOnDisconnect: $event })">
    </app-calendar-sync-settings-panel>
  `,
})
export class CalendarSyncSettingsContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);
  private service = inject(OperatorGoogleCalendarService);
  private snackBar = inject(MatSnackBar);

  settings: CalendarSyncSettings | null = null;
  loading = false;
  saving = false;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private load(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.service.getSyncSettings().pipe(takeUntil(this.destroy$)).subscribe({
      next: (settings) => {
        this.settings = settings;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  save(input: { keepPastAppointments?: boolean; keepCalendarOnDisconnect?: boolean }): void {
    this.saving = true;
    this.cdr.markForCheck();

    this.service.updateSyncSettings(input).pipe(takeUntil(this.destroy$)).subscribe({
      next: (settings) => {
        this.settings = settings;
        this.saving = false;
        this.cdr.markForCheck();
        // La rimozione dei passati avviene alla sincronizzazione successiva,
        // non subito: dirlo evita che qualcuno la creda non funzionante e la
        // riaccenda dopo dieci secondi.
        if (input.keepPastAppointments === false) {
          this.snackBar.open(
            'Gli appuntamenti passati verranno rimossi dai calendari alla prossima sincronizzazione',
            'OK', { duration: 6000 },
          );
        }
      },
      error: (err: any) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.snackBar.open(
          err?.graphQLErrors?.[0]?.message || 'Modifica non riuscita',
          'OK', { duration: 6000 },
        );
        this.load();
      },
    });
  }
}

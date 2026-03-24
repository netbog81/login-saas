/**
 * Patient Appointments Dialog Container
 * Layer 2: Smart Component - Dialog per appuntamenti futuri paziente
 *
 * Responsabilita':
 * - Caricare appuntamenti futuri del paziente
 * - Gestire cancellazione appuntamenti
 * - Gestire invio recap WhatsApp
 * - Dialog draggable e resizable
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';

import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { Patient } from '../../../models/patient.model';
import { AvailabilityAppointment } from '../../../graphql/generated/types';
import { PatientAppointmentsListComponent } from '../components/patient-appointments-list/patient-appointments-list.component';

export interface PatientAppointmentsDialogData {
  patient: Patient;
}

@Component({
  selector: 'app-patient-appointments-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    DragDropModule,
    PatientAppointmentsListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-wrapper" cdkDrag cdkDragRootElement=".cdk-overlay-pane">
      <div class="dialog-header" cdkDragHandle>
        <div class="header-title">
          <mat-icon>event_note</mat-icon>
          <span>Appuntamenti - {{ patient.nome }} {{ patient.cognome }}</span>
        </div>
        <div class="header-actions">
          <button mat-icon-button (click)="dialogRef.close()" matTooltip="Chiudi">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <div class="dialog-content">
        @if (error) {
          <div class="error-banner">
            <span>{{ error }}</span>
            <button mat-icon-button (click)="error = null; cdr.markForCheck()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }

        <app-patient-appointments-list
          [appointments]="appointments"
          [loading]="loading"
          (cancelAppointment)="onCancel($event)"
          (sendRecap)="onSendRecap($event)">
        </app-patient-appointments-list>
      </div>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 100%;
      resize: both;
      overflow: auto;
      min-width: 400px;
      min-height: 300px;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #2c3e50;
      color: white;
      cursor: move;
      border-radius: 4px 4px 0 0;
      flex-shrink: 0;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .header-actions {
      display: flex;
      flex-shrink: 0;
    }

    .header-actions button {
      color: white;
    }

    .dialog-content {
      flex: 1;
      overflow-y: auto;
      background: white;
    }

    .error-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      background: #fee2e2;
      color: #dc2626;
      font-size: 0.875rem;

      button {
        color: #dc2626;
      }
    }

    @media (max-width: 600px) {
      .dialog-wrapper {
        min-width: 280px;
      }

      .dialog-header {
        padding: 8px 12px;
      }

      .header-title {
        font-size: 14px;
      }
    }
  `],
})
export class PatientAppointmentsDialogComponent implements OnInit, OnDestroy {
  readonly dialogRef = inject(MatDialogRef<PatientAppointmentsDialogComponent>);
  private readonly data: PatientAppointmentsDialogData = inject(MAT_DIALOG_DATA);
  private readonly appointmentService = inject(AvailabilityAppointmentService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly ngZone = inject(NgZone);
  readonly cdr = inject(ChangeDetectorRef);

  private readonly destroy$ = new Subject<void>();

  patient: Patient = this.data.patient;
  appointments: AvailabilityAppointment[] = [];
  loading = false;
  error: string | null = null;

  ngOnInit(): void {
    this.loadAppointments();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAppointments(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    this.appointmentService.getAppointmentsByPatient(this.patient.id, today)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (appointments) => {
          this.ngZone.run(() => {
            this.appointments = appointments;
            this.loading = false;
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('[PatientAppointmentsDialog] Error loading appointments:', err);
          this.ngZone.run(() => {
            this.loading = false;
            this.error = 'Errore nel caricamento degli appuntamenti';
            this.cdr.markForCheck();
          });
        },
      });
  }

  onCancel(apt: AvailabilityAppointment): void {
    this.appointmentService.cancelAppointment(apt.id, 'Cancellato dalla scheda paziente')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.snackBar.open('Appuntamento cancellato', 'OK', { duration: 3000 });
            this.loadAppointments();
          });
        },
        error: (err) => {
          console.error('[PatientAppointmentsDialog] Error cancelling appointment:', err);
          this.ngZone.run(() => {
            this.snackBar.open('Errore nella cancellazione', 'OK', { duration: 3000 });
            this.cdr.markForCheck();
          });
        },
      });
  }

  onSendRecap(apt: AvailabilityAppointment): void {
    this.appointmentService.sendRecap(apt.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.snackBar.open('Recap WhatsApp inviato', 'OK', { duration: 3000 });
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('[PatientAppointmentsDialog] Error sending recap:', err);
          this.ngZone.run(() => {
            this.snackBar.open('Errore nell\'invio del recap', 'OK', { duration: 3000 });
            this.cdr.markForCheck();
          });
        },
      });
  }
}

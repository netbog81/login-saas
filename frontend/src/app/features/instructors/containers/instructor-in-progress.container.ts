/**
 * Instructor In Progress Container
 * Layer 2: Smart Component
 *
 * Responsabilità:
 * - Tab 2: Slot in corso con colonne per paziente
 * - Rileva slot corrente via CurrentSlotDetectorService
 * - Carica percorsi terapeutici e trattamenti esistenti per ogni paziente
 * - Gestisce azioni: inizia trattamento, segna non presentato, apri dialog multi-trattamento
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { Subject, combineLatest, forkJoin, of } from 'rxjs';
import { takeUntil, filter, distinctUntilChanged, switchMap } from 'rxjs/operators';

import {
  AvailabilityAppointment,
  BookingStatus,
} from '../../../graphql/generated/types';
import { TherapeuticPath } from '../../../models/therapeutic-path.model';
import { Treatment } from '../../../models/treatment.model';
import { TreatmentService } from '../../../services/treatment.service';
import { TherapeuticPathService } from '../../../services/therapeutic-path.service';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';

import { InstructorWorkspaceStateService } from '../services/instructor-workspace-state.service';
import { InstructorWorkspaceService } from '../services/instructor-workspace.service';
import { CurrentSlotDetectorService } from '../services/current-slot-detector.service';
import { SlotGroup, PatientTreatmentColumn } from '../models/instructor-workspace.model';
import { InProgressColumnComponent } from '../components/in-progress-column/in-progress-column.component';
import {
  MultiTreatmentDialogContainer,
} from './multi-treatment-dialog.container';
import { MultiTreatmentDialogData } from '../models/instructor-workspace.model';

@Component({
  selector: 'app-instructor-in-progress-container',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    InProgressColumnComponent,
  ],
  providers: [CurrentSlotDetectorService],
  template: `
    <div class="in-progress-container">
      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <span>Caricamento...</span>
        </div>
      } @else if (!currentSlot) {
        <div class="empty-state">
          <mat-icon>schedule</mat-icon>
          <h3>Nessuno slot in corso al momento</h3>
          <p>Gli appuntamenti compariranno qui quando arriva l'orario previsto</p>
        </div>
      } @else {
        <!-- Header slot corrente -->
        <div class="slot-header">
          <div class="slot-info">
            <mat-icon>fitness_center</mat-icon>
            <span class="slot-gym">{{ currentSlot.gymRoom.name }}</span>
            <mat-icon>schedule</mat-icon>
            <span class="slot-time">{{ currentSlot.startTime }} - {{ currentSlot.endTime }}</span>
            <span class="slot-count">{{ currentSlot.appointments.length }}/{{ currentSlot.gymRoom.maxCapacity }} pazienti</span>
          </div>
          <button mat-raised-button color="primary"
                  [disabled]="!hasAttendedWithoutTreatment"
                  (click)="onStartAllTreatments()">
            <mat-icon>play_circle</mat-icon>
            Inizia trattamento per tutti i pazienti
          </button>
        </div>

        <!-- Colonne pazienti -->
        <div class="columns-container">
          @for (col of columns; track col.appointment.id) {
            <app-in-progress-column
              [appointment]="col.appointment"
              [activePaths]="col.activePaths"
              [existingTreatment]="col.existingTreatment"
              [isAttended]="col.isAttended"
              (startTreatment)="onStartTreatment($event)"
              (openTreatment)="onOpenTreatment($event)"
              (markNoShow)="onMarkNoShow($event)"
              (markAttended)="onMarkAttended($event)">
            </app-in-progress-column>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .in-progress-container {
      padding: 16px 24px;
    }

    .loading-container {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 32px;
      justify-content: center;
      color: #64748b;
    }

    .empty-state {
      text-align: center;
      padding: 64px 24px;
      color: #94a3b8;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
      }

      h3 {
        margin: 16px 0 8px;
        color: #475569;
      }

      p {
        margin: 0;
        font-size: 0.9rem;
      }
    }

    .slot-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .slot-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95rem;
    }

    .slot-gym {
      font-weight: 600;
      color: #15803d;
    }

    .slot-time {
      font-weight: 500;
      color: #334155;
    }

    .slot-count {
      color: #64748b;
      font-size: 0.85rem;
    }

    .columns-container {
      display: flex;
      gap: 16px;
      overflow-x: auto;
      padding-bottom: 8px;
    }

    @media (max-width: 599px) {
      .in-progress-container {
        padding: 12px;
      }

      .slot-header {
        flex-direction: column;
        align-items: stretch;
      }

      .columns-container {
        gap: 12px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorInProgressContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = false;
  currentSlot: SlotGroup | null = null;
  columns: PatientTreatmentColumn[] = [];

  get hasAttendedWithoutTreatment(): boolean {
    return this.columns.some((c) => c.isAttended && !c.existingTreatment);
  }

  constructor(
    private stateService: InstructorWorkspaceStateService,
    private workspaceService: InstructorWorkspaceService,
    private slotDetector: CurrentSlotDetectorService,
    private treatmentService: TreatmentService,
    private pathService: TherapeuticPathService,
    private appointmentService: AvailabilityAppointmentService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Quando operatore cambia, carica appuntamenti di oggi e avvia detector
    combineLatest([
      this.stateService.selectedOperator$.pipe(
        filter((op) => op !== null),
        distinctUntilChanged((a, b) => a?.id === b?.id),
      ),
      this.stateService.selectedDate$.pipe(
        distinctUntilChanged((a, b) => a.toDateString() === b.toDateString()),
      ),
    ])
      .pipe(
        takeUntil(this.destroy$),
        switchMap(([operator, date]) => {
          if (!operator) return of(null);
          this.loading = true;
          this.cdr.markForCheck();
          const dateStr = date.toISOString().split('T')[0];
          return this.workspaceService.loadAppointments(operator.id, dateStr, dateStr);
        }),
      )
      .subscribe({
        next: (result) => {
          this.loading = false;
          if (result) {
            this.slotDetector.start(result.appointments);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });

    // Reagisce al cambio di slot corrente
    this.slotDetector.currentSlot$.pipe(takeUntil(this.destroy$)).subscribe((slot) => {
      this.currentSlot = slot;
      if (slot) {
        this.loadColumnsData(slot.appointments);
      } else {
        this.columns = [];
      }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.slotDetector.reset();
  }

  onStartTreatment(event: { appointmentId: string; pathId: string }): void {
    this.treatmentService
      .createTreatment(event.appointmentId, event.pathId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.refreshColumns();
        },
        error: (err) => {
          const msg = err?.graphQLErrors?.[0]?.message || 'Errore nella creazione del trattamento';
          alert(msg);
        },
      });
  }

  onStartAllTreatments(): void {
    const attendedWithoutTreatment = this.columns.filter(
      (c) => c.isAttended && !c.existingTreatment && c.selectedPathId,
    );

    if (attendedWithoutTreatment.length === 0) {
      this.openMultiTreatmentDialog();
      return;
    }

    // Crea trattamenti per tutti i pazienti ATTENDED senza trattamento
    const creates$ = attendedWithoutTreatment.map((col) =>
      this.treatmentService.createTreatment(col.appointment.id, col.selectedPathId!),
    );

    forkJoin(creates$)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.openMultiTreatmentDialog();
        },
        error: (err) => {
          const msg = err?.graphQLErrors?.[0]?.message || 'Errore nella creazione dei trattamenti';
          alert(msg);
          this.refreshColumns();
        },
      });
  }

  onOpenTreatment(_treatment: Treatment): void {
    this.openMultiTreatmentDialog();
  }

  onMarkNoShow(appointmentId: string): void {
    this.appointmentService
      .revertAttended(appointmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.refreshColumns(),
        error: (err) => {
          console.error('[InProgressContainer] Error marking no-show:', err);
        },
      });
  }

  onMarkAttended(appointmentId: string): void {
    this.appointmentService
      .markAsAttended(appointmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.refreshColumns(),
        error: (err) => {
          console.error('[InProgressContainer] Error marking attended:', err);
        },
      });
  }

  private openMultiTreatmentDialog(): void {
    // Singleton: non aprire se già aperto
    if (this.dialog.getDialogById('multi-treatment-dialog')) {
      return;
    }

    if (!this.currentSlot) return;

    const data: MultiTreatmentDialogData = {
      appointments: this.currentSlot.appointments,
      operatorId: this.stateService.selectedOperatorId!,
      date: this.currentSlot.date,
    };

    const dialogRef = this.dialog.open(MultiTreatmentDialogContainer, {
      id: 'multi-treatment-dialog',
      width: '95vw',
      maxWidth: '95vw',
      height: '85vh',
      hasBackdrop: true,
      disableClose: false,
      panelClass: 'multi-treatment-dialog-panel',
      data,
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.refreshColumns();
    });
  }

  private refreshColumns(): void {
    if (this.currentSlot) {
      // Ricarica appuntamenti per aggiornare stati
      const dateStr = this.stateService.selectedDate.toISOString().split('T')[0];
      this.workspaceService
        .loadAppointments(this.stateService.selectedOperatorId!, dateStr, dateStr)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            this.slotDetector.updateAppointments(result.appointments);
          },
        });
    }
  }

  private loadColumnsData(appointments: AvailabilityAppointment[]): void {
    if (appointments.length === 0) {
      this.columns = [];
      return;
    }

    // Per ogni appuntamento, carica percorsi terapeutici e trattamento esistente
    const loads$ = appointments.map((apt) => {
      const patientId = apt.patientId?.toString();
      return forkJoin({
        paths: patientId
          ? this.pathService.getPathsByPatient(patientId)
          : of([] as TherapeuticPath[]),
        treatment: this.treatmentService.getTreatmentByAppointment(apt.id).pipe(
          // Il servizio potrebbe restituire null se non esiste
          switchMap((t) => of(t)),
        ),
      });
    });

    forkJoin(loads$)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          this.columns = appointments.map((apt, i) => {
            const activePaths = (results[i].paths || []).filter(
              (p) => p.status?.toLowerCase() === 'active',
            );
            const isAttended = apt.bookingStatus === BookingStatus.Attended;

            return {
              appointment: apt,
              patientId: apt.patientId?.toString() || '',
              patientName: apt.clientName,
              activePaths,
              existingTreatment: results[i].treatment || null,
              isAttended,
              selectedPathId: activePaths.length === 1 ? activePaths[0].id : null,
            };
          });
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[InProgressContainer] Error loading columns data:', err);
          // Fallback: costruisci colonne senza dati extra
          this.columns = appointments.map((apt) => ({
            appointment: apt,
            patientId: apt.patientId?.toString() || '',
            patientName: apt.clientName,
            activePaths: [],
            existingTreatment: null,
            isAttended: apt.bookingStatus === BookingStatus.Attended,
            selectedPathId: null,
          }));
          this.cdr.markForCheck();
        },
      });
  }
}

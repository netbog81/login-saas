/**
 * Multi Treatment Dialog Container
 * Layer 2: Smart Component
 *
 * Responsabilità:
 * - Dialog multi-trattamento aperto via MatDialog
 * - N colonne (una per paziente nello slot)
 * - Carica percorsi terapeutici e trattamenti esistenti per ogni paziente
 * - Gestisce salvataggio e completamento indipendente per colonna
 * - Singleton (gestito dal caller tramite dialog ID)
 * - Draggable via cdkDrag
 */

import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, switchMap, catchError } from 'rxjs/operators';

import { AvailabilityAppointment, BookingStatus } from '../../../graphql/generated/types';
import { TherapeuticPath } from '../../../models/therapeutic-path.model';
import { Treatment, CompleteTreatmentInput } from '../../../models/treatment.model';
import { TreatmentService } from '../../../services/treatment.service';
import { TherapeuticPathService } from '../../../services/therapeutic-path.service';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { PatientService } from '../../../services/patient.service';
import { PatientFolderDialogComponent } from '../../operators-new/components/patient-folder-dialog/patient-folder-dialog.component';

import {
  MultiTreatmentDialogData,
  TreatmentColumnState,
} from '../models/instructor-workspace.model';
import {
  MultiTreatmentPanelComponent,
  PanelSaveResult,
  PanelCompleteResult,
} from '../components/multi-treatment-panel/multi-treatment-panel.component';

@Component({
  selector: 'app-multi-treatment-dialog-container',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    DragDropModule,
    MultiTreatmentPanelComponent,
  ],
  template: `
    <div class="dialog-wrapper" cdkDrag cdkDragRootElement=".cdk-overlay-pane">
      <!-- Header (draggable handle) -->
      <div class="dialog-header" cdkDragHandle>
        <div class="header-info">
          <mat-icon>fitness_center</mat-icon>
          <h2>Trattamenti in corso</h2>
          <span class="patient-count">{{ columns.length }} pazienti</span>
        </div>
        <button mat-icon-button (click)="onClose()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Loading -->
      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <span>Caricamento dati trattamenti...</span>
        </div>
      }

      <!-- Columns -->
      @if (!loading) {
        <div class="columns-scroll">
          <div class="columns-container">
            @for (col of columns; track col.appointment.id) {
              <app-multi-treatment-panel
                [columnState]="col"
                [isSaving]="col.isSaving"
                (save)="onSave($event)"
                (completeTreatment)="onComplete($event)"
                (markAttended)="onMarkAttended($event)"
                (markNoShow)="onMarkNoShow($event)"
                (openPatientFolder)="onOpenPatientFolder($event)"
                (createTreatment)="onCreateTreatment($event)">
              </app-multi-treatment-panel>
            }
          </div>
        </div>
      }

      <!-- Footer -->
      <div class="dialog-footer">
        <button mat-raised-button (click)="onClose()">
          <mat-icon>close</mat-icon>
          Chiudi Finestra
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #f8fafc;
      border-radius: 8px;
      overflow: hidden;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: linear-gradient(135deg, #0d9488 0%, #065f46 100%);
      color: white;
      cursor: move;
      flex-shrink: 0;
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-info h2 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .patient-count {
      font-size: 0.8rem;
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 10px;
      border-radius: 10px;
    }

    .loading-container {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 48px;
      justify-content: center;
      color: #64748b;
      flex: 1;
    }

    .columns-scroll {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }

    .columns-container {
      display: flex;
      gap: 16px;
      min-height: 100%;
    }

    .dialog-footer {
      display: flex;
      justify-content: center;
      padding: 12px 20px;
      background: white;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    @media (max-width: 599px) {
      .columns-container {
        flex-direction: column;
      }

      .columns-scroll {
        padding: 12px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiTreatmentDialogContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = true;
  columns: TreatmentColumnState[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MultiTreatmentDialogData,
    private dialogRef: MatDialogRef<MultiTreatmentDialogContainer>,
    private dialog: MatDialog,
    private treatmentService: TreatmentService,
    private pathService: TherapeuticPathService,
    private appointmentService: AvailabilityAppointmentService,
    private patientService: PatientService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadColumnsData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSave(result: PanelSaveResult): void {
    const col = this.findColumn(result.appointmentId);
    if (!col || !col.treatment) return;

    col.isSaving = true;
    this.cdr.markForCheck();

    this.treatmentService
      .updateTreatment({
        id: result.treatmentId,
        therapeuticPathId: result.therapeuticPathId,
        clinicalNotes: result.clinicalNotes,
        secretaryNotes: result.secretaryNotes,
        patientNotes: result.patientNotes,
        price: result.price,
        scontoFE: result.scontoFE,
        painBefore: result.painBefore,
        painAfter: result.painAfter,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          col.treatment = updated;
          col.isSaving = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          col.isSaving = false;
          const msg = err?.graphQLErrors?.[0]?.message || 'Errore durante il salvataggio';
          alert(msg);
          this.cdr.markForCheck();
        },
      });
  }

  onComplete(result: PanelCompleteResult): void {
    const col = this.findColumn(result.formData.appointmentId);
    if (!col || !col.treatment) return;

    col.isSaving = true;
    this.cdr.markForCheck();

    // Prima salva, poi completa
    this.treatmentService
      .updateTreatment({
        id: result.treatmentId,
        therapeuticPathId: result.formData.therapeuticPathId,
        clinicalNotes: result.formData.clinicalNotes,
        secretaryNotes: result.formData.secretaryNotes,
        patientNotes: result.formData.patientNotes,
        price: result.formData.price,
        scontoFE: result.formData.scontoFE,
        painBefore: result.formData.painBefore,
        painAfter: result.formData.painAfter,
      })
      .pipe(
        switchMap((updated) => {
          const input: CompleteTreatmentInput = {
            price: updated.price || 0,
            clinicalNotes: updated.clinicalNotes,
            secretaryNotes: updated.secretaryNotes,
            operatorNotes: updated.operatorNotes,
          };
          return this.treatmentService.completeTreatment(updated.id, input);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (completed) => {
          col.treatment = completed;
          col.isSaving = false;
          col.isCompleted = true;
          this.cdr.markForCheck();
        },
        error: (err) => {
          col.isSaving = false;
          const msg = err?.graphQLErrors?.[0]?.message || 'Errore durante il completamento';
          alert(msg);
          this.cdr.markForCheck();
        },
      });
  }

  onMarkAttended(appointmentId: string): void {
    this.appointmentService
      .markAsAttended(appointmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const col = this.findColumn(appointmentId);
          if (col) {
            col.isAttended = true;
            this.cdr.markForCheck();
          }
        },
      });
  }

  onMarkNoShow(appointmentId: string): void {
    this.appointmentService
      .revertAttended(appointmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const col = this.findColumn(appointmentId);
          if (col) {
            col.isAttended = false;
            this.cdr.markForCheck();
          }
        },
      });
  }

  onOpenPatientFolder(patientId: string): void {
    this.patientService.getPatient(patientId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (patient) => {
          if (!patient) return;
          const folderRef = this.dialog.open(PatientFolderDialogComponent, {
            data: {
              patient,
              operatorId: this.data.appointments[0]?.operatorId
            },
            width: '95vw',
            maxWidth: '1400px',
            height: '90vh',
            panelClass: 'patient-folder-dialog-panel'
          });
          // Dopo chiusura scheda paziente, ricarica i percorsi per questa colonna
          folderRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(() => {
            this.refreshColumnPaths(patientId);
          });
        },
      });
  }

  onCreateTreatment(event: { appointmentId: string; pathId: string }): void {
    const col = this.findColumn(event.appointmentId);
    if (!col) return;

    col.isSaving = true;
    this.cdr.markForCheck();

    this.treatmentService
      .createTreatment(event.appointmentId, event.pathId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (treatment) => {
          col.treatment = treatment;
          col.isSaving = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          col.isSaving = false;
          const msg = err?.graphQLErrors?.[0]?.message || 'Errore nella creazione del trattamento';
          alert(msg);
          this.cdr.markForCheck();
        },
      });
  }

  onClose(): void {
    this.dialogRef.close();
  }

  private findColumn(appointmentId: string): TreatmentColumnState | undefined {
    return this.columns.find((c) => c.appointment.id === appointmentId);
  }

  private refreshColumnPaths(patientId: string): void {
    this.pathService.getPathsByPatient(patientId)
      .pipe(
        catchError(() => of([] as TherapeuticPath[])),
        takeUntil(this.destroy$),
      )
      .subscribe((paths) => {
        const activePaths = paths.filter((p) => p.status?.toLowerCase() === 'active');
        // Aggiorna tutte le colonne di questo paziente
        for (const col of this.columns) {
          if (col.patientId === patientId) {
            col.activePaths = activePaths;
          }
        }
        this.cdr.markForCheck();
      });
  }

  private loadColumnsData(): void {
    const appointments = this.data.appointments;

    // 2 query batch parallele invece di N*2 query singole
    const patientIds = [...new Set(
      appointments.map((a) => a.patientId?.toString()).filter((id): id is string => !!id)
    )];
    const appointmentIds = appointments.map((a) => a.id);

    forkJoin({
      paths: this.pathService.getPathsByPatients(patientIds).pipe(catchError(() => of([] as TherapeuticPath[]))),
      treatments: this.treatmentService.getTreatmentsByAppointments(appointmentIds).pipe(catchError(() => of([] as Treatment[]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ paths, treatments }) => {
          // Indicizza per lookup rapido
          const pathsByPatient = new Map<string, TherapeuticPath[]>();
          for (const p of paths) {
            const pid = (p as any).patientId?.toString() || '';
            if (!pathsByPatient.has(pid)) pathsByPatient.set(pid, []);
            pathsByPatient.get(pid)!.push(p);
          }
          const treatmentByApt = new Map<string, Treatment>();
          for (const t of treatments) {
            treatmentByApt.set(t.appointmentId, t);
          }

          this.columns = appointments.map((apt) => {
            const pid = apt.patientId?.toString() || '';
            const activePaths = (pathsByPatient.get(pid) || []).filter(
              (p) => p.status?.toLowerCase() === 'active',
            );
            const treatment = treatmentByApt.get(apt.id) || null;
            const isAttended = apt.bookingStatus === BookingStatus.Attended;

            return {
              appointment: apt,
              patientId: pid,
              patientName: apt.clientName,
              treatment,
              activePaths,
              isAttended,
              isSaving: false,
              isCompleted: treatment?.status?.toLowerCase() === 'operator_completed' || treatment?.status?.toLowerCase() === 'closed',
            };
          });
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          // Fallback
          this.columns = appointments.map((apt) => ({
            appointment: apt,
            patientId: apt.patientId?.toString() || '',
            patientName: apt.clientName,
            treatment: null,
            activePaths: [],
            isAttended: apt.bookingStatus === BookingStatus.Attended,
            isSaving: false,
            isCompleted: false,
          }));
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }
}

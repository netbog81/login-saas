/**
 * Instructor Executed Container
 * Layer 2: Smart Component
 *
 * Responsabilita':
 * - Tab 3: Trattamenti eseguiti (slot temporalmente passati)
 * - Carica appuntamenti del giorno selezionato + trattamenti associati
 * - Filtra per slot passati: helper filterPastSlots()
 *   - Data futura: vuoto
 *   - Data passata: tutti gli slot
 *   - Oggi: solo slot con endTime <= ora corrente
 * - Auto-refresh ogni 60s SOLO se la data e' oggi (per far avanzare lo "spartiacque")
 * - Apre MultiTreatmentDialogContainer per visualizza/modifica
 * - Riapre trattamenti completati via TreatmentService.reopenTreatment()
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { Subject, combineLatest, forkJoin, of, interval } from 'rxjs';
import { takeUntil, filter, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';

import { AvailabilityAppointment, BookingStatus } from '../../../graphql/generated/types';
import { Treatment } from '../../../models/treatment.model';
import { TreatmentService } from '../../../services/treatment.service';

import { InstructorWorkspaceStateService } from '../services/instructor-workspace-state.service';
import { InstructorWorkspaceService } from '../services/instructor-workspace.service';
import {
  SlotGroup,
  ExecutedSlotGroup,
  ExecutedPatientEntry,
  MultiTreatmentDialogData,
  groupAppointmentsBySlot,
  filterPastSlots,
  formatDateLocal,
} from '../models/instructor-workspace.model';
import { ExecutedSlotCardComponent } from '../components/executed-slot-card/executed-slot-card.component';
import { MultiTreatmentDialogContainer } from './multi-treatment-dialog.container';

@Component({
  selector: 'app-instructor-executed-container',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ExecutedSlotCardComponent,
  ],
  template: `
    <div class="executed-container">
      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <span>Caricamento trattamenti eseguiti...</span>
        </div>
      } @else if (error) {
        <div class="error-message">{{ error }}</div>
      } @else if (executedSlots.length === 0) {
        <div class="empty-state">
          <mat-icon>history_toggle_off</mat-icon>
          <h3>Nessun trattamento eseguito</h3>
          <p>{{ getEmptyMessage() }}</p>
        </div>
      } @else {
        <div class="slots-list">
          @for (slot of executedSlots; track slot.key) {
            <app-executed-slot-card
              [slot]="slot"
              (openSlot)="onOpenSlot($event)"
              (openPatient)="onOpenPatient($event)"
              (reopenPatient)="onReopenPatient($event)">
            </app-executed-slot-card>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .executed-container {
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

    .error-message {
      padding: 16px;
      background: #fee2e2;
      color: #dc2626;
      border-radius: 8px;
      margin-bottom: 16px;
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

    .slots-list {
      display: flex;
      flex-direction: column;
    }

    @media (max-width: 599px) {
      .executed-container {
        padding: 12px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorExecutedContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private refreshTimer$ = new Subject<void>();

  loading = false;
  error: string | null = null;
  executedSlots: ExecutedSlotGroup[] = [];

  private allAppointments: AvailabilityAppointment[] = [];

  constructor(
    private stateService: InstructorWorkspaceStateService,
    private workspaceService: InstructorWorkspaceService,
    private treatmentService: TreatmentService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    // Reagisce a cambi di operatore o data
    combineLatest([
      this.stateService.selectedOperator$.pipe(
        filter((op) => op !== null),
        distinctUntilChanged((a, b) => a?.id === b?.id),
      ),
      this.stateService.selectedDate$.pipe(
        distinctUntilChanged((a, b) => a.toDateString() === b.toDateString()),
      ),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([operator, date]) => {
        if (operator) {
          this.loadAppointments(operator.id, date);
          this.setupAutoRefresh(date);
        }
      });
  }

  ngOnDestroy(): void {
    this.refreshTimer$.next();
    this.refreshTimer$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Avvia/aggiorna il timer di auto-refresh.
   * Attivo SOLO se la data selezionata e' oggi (gli slot devono "scivolare" nel passato).
   */
  private setupAutoRefresh(date: Date): void {
    this.refreshTimer$.next(); // ferma il precedente

    const todayStr = formatDateLocal(new Date());
    const selectedStr = formatDateLocal(date);
    if (selectedStr !== todayStr) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      interval(60000)
        .pipe(takeUntil(this.refreshTimer$), takeUntil(this.destroy$))
        .subscribe(() => {
          this.ngZone.run(() => this.rebuildExecutedSlots());
        });
    });
  }

  private loadAppointments(operatorId: string, date: Date): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    const dateStr = formatDateLocal(date);

    this.workspaceService
      .loadAppointments(operatorId, dateStr, dateStr)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.allAppointments = result.appointments;
          this.error = result.error || null;
          this.rebuildExecutedSlots();
        },
        error: () => {
          this.loading = false;
          this.error = 'Errore nel caricamento degli appuntamenti';
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Ricostruisce gli slot eseguiti:
   * 1. Filtra appuntamenti del giorno selezionato
   * 2. Raggruppa in SlotGroup
   * 3. Filtra solo slot passati
   * 4. Per ogni slot carica trattamenti dei pazienti
   */
  private rebuildExecutedSlots(): void {
    const date = this.stateService.selectedDate;
    const dateStr = formatDateLocal(date);

    const dayAppts = this.allAppointments.filter((a) => a.appointmentDate === dateStr);
    const allSlots = groupAppointmentsBySlot(dayAppts);
    const pastSlots = filterPastSlots(allSlots, date);

    if (pastSlots.length === 0) {
      this.executedSlots = [];
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    // Carica trattamenti per tutti i pazienti degli slot passati
    const loads$ = pastSlots.map((slot) => this.loadSlotPatients(slot));

    forkJoin(loads$)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (executed) => {
          this.executedSlots = executed;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.error = 'Errore nel caricamento dei trattamenti';
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Carica i trattamenti per i pazienti di uno specifico slot.
   */
  private loadSlotPatients(slot: SlotGroup) {
    const treatments$ = slot.appointments.map((apt) =>
      this.treatmentService.getTreatmentByAppointment(apt.id).pipe(
        catchError(() => of(null as Treatment | null)),
      ),
    );

    if (treatments$.length === 0) {
      return of<ExecutedSlotGroup>({
        ...slot,
        patients: [],
      });
    }

    return forkJoin(treatments$).pipe(
      switchMap((treatments) => {
        const patients: ExecutedPatientEntry[] = slot.appointments.map((apt, i) => ({
          appointment: apt,
          patientId: apt.patientId?.toString() || '',
          patientName: apt.clientName,
          treatment: treatments[i] || null,
          isAttended: apt.bookingStatus === BookingStatus.Attended,
        }));
        return of<ExecutedSlotGroup>({
          ...slot,
          patients,
        });
      }),
    );
  }

  // ==================== AZIONI ====================

  /**
   * Apre il dialog multi-trattamento per tutti i pazienti dello slot.
   */
  onOpenSlot(slot: ExecutedSlotGroup): void {
    this.openDialog(slot);
  }

  /**
   * Apre il dialog multi-trattamento centrato su un singolo paziente.
   * Per coerenza con la richiesta, passa comunque tutti i pazienti dello slot.
   */
  onOpenPatient(entry: ExecutedPatientEntry): void {
    const slot = this.executedSlots.find((s) =>
      s.patients.some((p) => p.appointment.id === entry.appointment.id),
    );
    if (slot) {
      this.openDialog(slot);
    }
  }

  /**
   * Riapre un trattamento OPERATOR_COMPLETED -> IN_PROGRESS.
   */
  onReopenPatient(entry: ExecutedPatientEntry): void {
    if (!entry.treatment) return;

    const ok = confirm(
      `Riaprire il trattamento di ${entry.patientName}?\n\nIl trattamento tornera' allo stato "In corso" e potra' essere modificato.`,
    );
    if (!ok) return;

    this.treatmentService
      .reopenTreatment(entry.treatment.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Ricarica appuntamenti per riflettere il nuovo stato
          const operatorId = this.stateService.selectedOperatorId;
          const date = this.stateService.selectedDate;
          if (operatorId) {
            this.loadAppointments(operatorId, date);
          }
        },
        error: (err) => {
          const msg = err?.graphQLErrors?.[0]?.message || 'Errore durante la riapertura del trattamento';
          alert(msg);
        },
      });
  }

  // ==================== HELPERS ====================

  private openDialog(slot: ExecutedSlotGroup): void {
    if (this.dialog.getDialogById('multi-treatment-dialog')) {
      return;
    }

    const operatorId = this.stateService.selectedOperatorId;
    if (!operatorId) return;

    const data: MultiTreatmentDialogData = {
      appointments: slot.appointments,
      operatorId,
      date: slot.date,
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

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Ricarica per riflettere eventuali modifiche
        const opId = this.stateService.selectedOperatorId;
        const date = this.stateService.selectedDate;
        if (opId) {
          this.loadAppointments(opId, date);
        }
      });
  }

  getEmptyMessage(): string {
    const today = formatDateLocal(new Date());
    const selected = formatDateLocal(this.stateService.selectedDate);
    if (selected > today) {
      return 'Per le date future non ci sono trattamenti eseguiti.';
    }
    if (selected === today) {
      return 'Nessuno slot e\' ancora terminato per oggi. Gli slot conclusi compariranno qui automaticamente.';
    }
    return 'Nessun trattamento per la data selezionata.';
  }
}

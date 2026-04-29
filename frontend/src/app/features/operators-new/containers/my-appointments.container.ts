import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, of } from 'rxjs';
import { takeUntil, catchError, finalize } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { MyAppointmentsService } from '../services/my-appointments.service';
import { MyAppointment } from '../models/my-appointments.model';
import {
  MyAppointmentsFilters,
  MyAppointmentsViewMode,
} from '../models/my-appointments-filter.model';
import { MyAppointmentsFiltersComponent } from '../components/my-appointments/my-appointments-filters/my-appointments-filters.component';
import {
  MyAppointmentsListComponent,
  AppointmentGroup,
} from '../components/my-appointments/my-appointments-list/my-appointments-list.component';

interface PatientOption {
  id: string;
  label: string;
}

/**
 * Smart container "I miei appuntamenti" — Layer 2.
 *
 * Responsabilità:
 *  - chiamare MyAppointmentsService (Layer 3) per fetch
 *  - tenere stato UI (filtri attivi, vista flat/byPatient, loading, error)
 *  - filtrare in memoria per status e patientId (filtro client-side)
 *  - raggruppare per paziente quando viewMode='byPatient'
 *  - costruire le opzioni paziente per l'autocomplete dei filtri
 *
 * APPROACH FK: GraphQL Fragments — vedi MY_APPOINTMENT_FIELDS.
 *
 * NgZone: BaseGraphQLService gestisce automaticamente l'integrazione con
 * NgZone via ApolloZoneService — non servono ngZone.run() manuali.
 */
@Component({
  selector: 'app-my-appointments-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MyAppointmentsFiltersComponent,
    MyAppointmentsListComponent,
  ],
  template: `
    <mat-card class="my-appts-card">
      <mat-card-content>
        <app-my-appointments-filters
          [filters]="filters"
          [viewMode]="viewMode"
          [patientOptions]="patientOptions"
          (filtersChange)="onFiltersChange($event)"
          (viewModeChange)="onViewModeChange($event)">
        </app-my-appointments-filters>

        @if (error) {
          <div class="error-banner">
            <span>{{ error }}</span>
            <button (click)="reload()">Riprova</button>
          </div>
        }

        <app-my-appointments-list
          [appointments]="filteredAppointments"
          [groups]="groups"
          [groupedView]="viewMode === 'byPatient'"
          [loading]="loading">
        </app-my-appointments-list>
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      .my-appts-card {
        background: white;
      }
      .error-banner {
        background: #fdecea;
        color: #b71c1c;
        padding: 8px 12px;
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 12px 0;
      }
      .error-banner button {
        background: none;
        border: 1px solid #b71c1c;
        color: #b71c1c;
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
      }
    `,
  ],
})
export class MyAppointmentsContainer implements OnInit, OnDestroy {
  /**
   * Operator id da cui filtrare. Quando cambia (es. l'utente seleziona
   * un altro operatore nella dashboard) ricarica.
   */
  @Input() operatorId: string | null = null;

  filters: MyAppointmentsFilters = {};
  viewMode: MyAppointmentsViewMode = 'flat';

  loading = false;
  error: string | null = null;

  private allAppointments: MyAppointment[] = [];
  filteredAppointments: MyAppointment[] = [];
  groups: AppointmentGroup[] = [];
  patientOptions: PatientOption[] = [];

  private destroy$ = new Subject<void>();
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly service = inject(MyAppointmentsService);

  ngOnInit(): void {
    this.loadAppointments();
  }

  ngOnChanges(): void {
    // Reagisce al cambio di operatorId
    if (this.operatorId) this.loadAppointments();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  reload(): void {
    this.loadAppointments();
  }

  onFiltersChange(next: MyAppointmentsFilters): void {
    const dateRangeChanged =
      next.dateFrom !== this.filters.dateFrom ||
      next.dateTo !== this.filters.dateTo;
    this.filters = next;
    if (dateRangeChanged) {
      // Range data → richiede nuova fetch backend (filtro server-side)
      this.loadAppointments();
    } else {
      // Status/patient → filtro client-side
      this.applyClientFilters();
    }
  }

  onViewModeChange(mode: MyAppointmentsViewMode): void {
    this.viewMode = mode;
    this.rebuildGroups();
    this.cdr.markForCheck();
  }

  private loadAppointments(): void {
    if (!this.operatorId) {
      this.allAppointments = [];
      this.filteredAppointments = [];
      this.groups = [];
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.service
      .getMyAppointments(this.operatorId, {
        dateFrom: this.filters.dateFrom,
        dateTo: this.filters.dateTo,
      })
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.ngZone.run(() => {
            this.error = err?.message ?? 'Errore caricamento appuntamenti';
          });
          return of([] as MyAppointment[]);
        }),
        finalize(() => {
          this.ngZone.run(() => {
            this.loading = false;
            this.cdr.markForCheck();
          });
        }),
      )
      .subscribe(list => {
        this.ngZone.run(() => {
          // Ordino per data discendente: più recenti prima
          this.allAppointments = [...list].sort((a, b) => {
            const da = `${a.appointmentDate}T${a.startTime ?? '00:00'}`;
            const db = `${b.appointmentDate}T${b.startTime ?? '00:00'}`;
            return db.localeCompare(da);
          });
          this.rebuildPatientOptions();
          this.applyClientFilters();
        });
      });
  }

  /**
   * Applica i filtri client-side (status + patientId) e rigenera vista
   * raggruppata. Lasciato pubblico/protected via metodo per chiarezza.
   */
  private applyClientFilters(): void {
    const { statuses, patientId } = this.filters;
    this.filteredAppointments = this.allAppointments.filter(a => {
      if (statuses && statuses.length > 0 && !statuses.includes(a.bookingStatus))
        return false;
      if (patientId && a.patientId !== patientId) return false;
      return true;
    });
    this.rebuildGroups();
    this.cdr.markForCheck();
  }

  private rebuildGroups(): void {
    if (this.viewMode !== 'byPatient') {
      this.groups = [];
      return;
    }
    const map = new Map<string, AppointmentGroup>();
    for (const a of this.filteredAppointments) {
      // Raggruppa su patientId (più affidabile di clientName che potrebbe
      // avere varianti di formattazione). Fallback su clientName per
      // appuntamenti con paziente sconosciuto/walk-in.
      const key = a.patientId ?? a.clientName ?? '__no_patient__';
      const label = a.clientName ?? 'Senza paziente';
      if (!map.has(key)) {
        map.set(key, { patientLabel: label, appointments: [] });
      }
      map.get(key)!.appointments.push(a);
    }
    this.groups = Array.from(map.values()).sort((a, b) =>
      a.patientLabel.localeCompare(b.patientLabel, 'it'),
    );
  }

  private rebuildPatientOptions(): void {
    const map = new Map<string, PatientOption>();
    for (const a of this.allAppointments) {
      if (!a.patientId) continue;
      if (!map.has(a.patientId)) {
        map.set(a.patientId, {
          id: a.patientId,
          label: a.clientName ?? a.patientId,
        });
      }
    }
    this.patientOptions = Array.from(map.values()).sort((x, y) =>
      x.label.localeCompare(y.label, 'it'),
    );
  }
}

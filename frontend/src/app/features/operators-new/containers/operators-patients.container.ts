/**
 * Operators Patients Container
 * Layer 2: Smart Component - Coordinatore Lista Pazienti
 *
 * Responsabilità:
 * - Caricare lista pazienti dal servizio
 * - Gestire ricerca e filtri
 * - Orchestrare azioni sui pazienti
 * - Mostrare info operatore selezionato dal state service condiviso
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { PatientService } from '../../../services/patient.service';
import { Patient } from '../../../models/patient.model';
import { Operator } from '../../../graphql/generated/types';

import { PatientSearchComponent } from '../components/patients-list/patient-search/patient-search.component';
import { PatientTableComponent } from '../components/patients-list/patient-table/patient-table.component';
import { PatientFolderDialogComponent } from '../components/patient-folder-dialog/patient-folder-dialog.component';
import { PatientAppointmentsDialogComponent } from './patient-appointments-dialog.component';
import { OperatorWorkspaceStateService } from '../services/operator-workspace-state.service';

import {
  PatientsListUIState,
  createInitialPatientsListState
} from '../models';

@Component({
  selector: 'app-operators-patients-container',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    PatientSearchComponent,
    PatientTableComponent
  ],
  template: `
    <div class="patients-container">
      <!-- Header -->
      <header class="patients-header">
        <div class="header-content">
          <h1>Pazienti</h1>
          <p class="subtitle">
            @if (selectedOperator) {
              Gestione anagrafica - Operatore: {{ selectedOperator.name }} {{ selectedOperator.surname }}
            } @else {
              Gestione anagrafica pazienti
            }
          </p>
        </div>
      </header>

      <!-- Error banner -->
      @if (uiState.error) {
        <div class="error-banner">
          <span>{{ uiState.error }}</span>
          <button (click)="clearError()">×</button>
        </div>
      }

      <!-- Search -->
      <section class="search-section">
        <app-patient-search
          [searching]="uiState.searching"
          [disabled]="uiState.loading"
          (search)="onSearch($event)">
        </app-patient-search>
      </section>

      <!-- Patients Table -->
      <section class="table-section">
        <app-patient-table
          [patients]="displayedPatients"
          [loading]="uiState.loading"
          [selectedPatientId]="uiState.selectedPatientId"
          [emptyMessage]="getEmptyMessage()"
          (patientSelect)="onPatientSelect($event)"
          (patientView)="onPatientView($event)"
          (viewAppointments)="onViewAppointments($event)"
          (newAppointment)="onNewAppointment($event)">
        </app-patient-table>
      </section>
    </div>
  `,
  styles: [`
    .patients-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .patients-header {
      margin-bottom: 24px;

      .header-content {
        display: flex;
        flex-direction: column;
      }

      h1 {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 700;
        color: #1e293b;
      }

      .subtitle {
        margin: 4px 0 0;
        font-size: 0.9375rem;
        color: #64748b;
      }
    }

    .error-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      margin-bottom: 24px;
      background: #fee2e2;
      color: #dc2626;
      border-radius: 8px;
      font-size: 0.875rem;

      button {
        background: none;
        border: none;
        font-size: 1.25rem;
        cursor: pointer;
        color: #dc2626;
        padding: 0 4px;
      }
    }

    .search-section {
      margin-bottom: 16px;
    }

    .table-section {
      flex: 1;
      min-height: 0;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    /* Responsive */
    @media (max-width: 599px) {
      .patients-container {
        padding: 16px;
      }

      .patients-header {
        margin-bottom: 16px;

        h1 {
          font-size: 1.5rem;
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperatorsPatientsContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  uiState: PatientsListUIState = createInitialPatientsListState();
  patients: Patient[] = [];
  displayedPatients: Patient[] = [];
  selectedOperator: Operator | null = null;

  constructor(
    private stateService: OperatorWorkspaceStateService,
    private patientService: PatientService,
    private router: Router,
    private dialog: MatDialog,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Sottoscrivi all'operatore selezionato
    this.stateService.selectedOperator$
      .pipe(takeUntil(this.destroy$))
      .subscribe(operator => {
        this.selectedOperator = operator;
        this.cdr.markForCheck();
      });

    // Carica pazienti
    this.loadPatients();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadPatients(): void {
    this.uiState = { ...this.uiState, loading: true, error: null };
    this.cdr.markForCheck();

    // NOTE registry: pageSize è capped a 100 lato registry. Per dataset
    // grandi (3700+ pazienti) la lista iniziale carica solo i primi 100;
    // l'utente trova chiunque digitando 3+ caratteri nel box ricerca, che
    // scatena POST /subjects/global-search col motore trigrammi+fonetico.
    this.patientService.getPatients(100, 0)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (patients) => {
          this.ngZone.run(() => {
            this.patients = patients;
            this.displayedPatients = patients;
            this.uiState = { ...this.uiState, loading: false };
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('[OperatorsPatientsContainer] Error loading patients:', err);
          this.ngZone.run(() => {
            this.uiState = {
              ...this.uiState,
              loading: false,
              error: 'Errore nel caricamento dei pazienti'
            };
            this.cdr.markForCheck();
          });
        }
      });
  }

  onSearch(searchTerm: string): void {
    const trimmed = searchTerm.trim();
    this.uiState = { ...this.uiState, searchTerm: trimmed, searching: true };
    this.cdr.markForCheck();

    if (!trimmed) {
      // Box vuoto → torna alla lista iniziale
      this.displayedPatients = this.patients;
      this.uiState = { ...this.uiState, searching: false };
      this.cdr.markForCheck();
      return;
    }

    // Il registry richiede min 3 char per global-search; sotto la soglia
    // mostriamo il filtro client-side della lista già caricata (50/100).
    if (trimmed.length < 3) {
      const lower = trimmed.toLowerCase();
      this.displayedPatients = this.patients.filter((p) => {
        const name = `${p.nome ?? ''} ${p.cognome ?? ''}`.toLowerCase();
        const phone = (p.cellulare || p.telefono || '').toLowerCase();
        return name.includes(lower) || phone.includes(lower);
      });
      this.uiState = { ...this.uiState, searching: false };
      this.cdr.markForCheck();
      return;
    }

    // 3+ char → ricerca remota sul registry (trigrammi + fonetico, l'intero dataset)
    this.patientService.searchPatients(trimmed)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          this.ngZone.run(() => {
            this.displayedPatients = results;
            this.uiState = { ...this.uiState, searching: false };
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('[OperatorsPatientsContainer] Error searching patients:', err);
          this.ngZone.run(() => {
            this.uiState = {
              ...this.uiState,
              searching: false,
              error: 'Errore nella ricerca'
            };
            this.cdr.markForCheck();
          });
        }
      });
  }

  onPatientSelect(patient: Patient): void {
    this.uiState = { ...this.uiState, selectedPatientId: patient.id };
    this.cdr.markForCheck();
  }

  onPatientView(patient: Patient): void {
    console.log('[OperatorsPatientsContainer] Opening patient folder dialog:', patient.id);

    this.dialog.open(PatientFolderDialogComponent, {
      data: {
        patient: patient,
        operatorId: this.selectedOperator?.id
      },
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      panelClass: 'patient-folder-dialog-panel'
    });
  }

  onViewAppointments(patient: Patient): void {
    this.dialog.open(PatientAppointmentsDialogComponent, {
      data: { patient },
      width: '700px',
      height: '500px',
      panelClass: 'resizable-dialog-panel',
    });
  }

  onNewAppointment(patient: Patient): void {
    // Navigate to calendar with patient pre-selected
    console.log('[OperatorsPatientsContainer] New appointment for patient:', patient.id);
    this.router.navigate(['/calendar'], {
      queryParams: { patientId: patient.id }
    });
  }

  clearError(): void {
    this.uiState = { ...this.uiState, error: null };
    this.cdr.markForCheck();
  }

  getEmptyMessage(): string {
    if (this.uiState.searchTerm) {
      return `Nessun paziente trovato per "${this.uiState.searchTerm}"`;
    }
    return 'Nessun paziente presente';
  }
}

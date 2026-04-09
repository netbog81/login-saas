import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil, firstValueFrom } from 'rxjs';
import { Patient, getPatientDisplayName, getPatientPhone } from '../../../models/patient.model';
import { PatientService } from '../../../services/patient.service';
import { PatientAppointmentsDialogComponent } from '../../../features/operators-new/containers/patient-appointments-dialog.component';
import { PatientTableComponent } from '../../../features/operators-new/components/patients-list/patient-table/patient-table.component';
import { PatientFolderDialogComponent } from '../../../features/operators-new/components/patient-folder-dialog/patient-folder-dialog.component';

type StatoAnagrafica = 'BOZZA' | 'PARZIALE' | 'COMPLETA' | 'DA_VERIFICARE';  // GraphQL enum key names

@Component({
  selector: 'app-patient-management',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatButtonModule, MatTooltipModule, PatientTableComponent],
  templateUrl: './patient-management.component.html',
  styleUrls: ['./patient-management.component.scss']
})
export class PatientManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  patients: Patient[] = [];
  filteredPatients: Patient[] = [];
  selectedPatient: Patient | null = null;

  // UI State
  loading = false;
  error: string | null = null;
  viewMode: 'grid' | 'list' = 'grid';

  // Form State
  showPatientForm = false;
  isEditMode = false;
  editingPatientId: string | null = null;
  editingPatient: Partial<Patient> = this.getEmptyPatient();
  formError: string | null = null;
  savingPatient = false;

  // Filter state
  searchTerm = '';
  selectedStateFilter: StatoAnagrafica | null = null;

  // Stats
  totalPatients = 0;
  completePatients = 0;
  pendingPatients = 0;

  // Overlay click tracking (per evitare chiusura durante click-and-drag)
  overlayMouseDownTarget: EventTarget | null = null;

  onOverlayMouseDown(event: MouseEvent): void {
    this.overlayMouseDownTarget = event.target;
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.overlayMouseDownTarget === event.currentTarget &&
        event.target === event.currentTarget) {
      this.closePatientForm();
    }
    this.overlayMouseDownTarget = null;
  }

  constructor(
    private patientService: PatientService,
    private ngZone: NgZone,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPatients();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getEmptyPatient(): Partial<Patient> {
    return {
      nome: '',
      cognome: '',
      codiceFiscale: '',
      telefono: '',
      cellulare: '',
      email: '',
      dataNascita: undefined,
      genere: 'NON_SPECIFICATO',  // GraphQL enum key name
      tipoPaziente: 'ADULTO_AUTONOMO',  // GraphQL enum key name
      indirizzo: '',
      citta: '',
      cap: '',
      notes: '',
      consensoPrivacy: false,
      consensoMarketing: false
    };
  }

  loadPatients(): void {
    this.loading = true;
    this.error = null;

    this.patientService.getPatients()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (patients) => {
          this.patients = patients;
          this.applyFilters();
          this.updateStats();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading patients:', error);
          this.error = 'Errore nel caricamento dei pazienti';
          this.loading = false;
        }
      });
  }

  private updateStats(): void {
    this.totalPatients = this.patients.length;
    this.completePatients = this.patients.filter(p => p.statoAnagrafica === 'COMPLETA').length;
    this.pendingPatients = this.patients.filter(p =>
      p.statoAnagrafica === 'BOZZA' || p.statoAnagrafica === 'PARZIALE'
    ).length;
  }

  applyFilters(): void {
    let result = [...this.patients];

    // Search filter
    if (this.searchTerm.trim()) {
      const search = this.searchTerm.toLowerCase();
      result = result.filter(p =>
        p.nome?.toLowerCase().includes(search) ||
        p.cognome?.toLowerCase().includes(search) ||
        p.codiceFiscale?.toLowerCase().includes(search) ||
        p.telefono?.includes(search) ||
        p.cellulare?.includes(search) ||
        p.email?.toLowerCase().includes(search)
      );
    }

    // State filter
    if (this.selectedStateFilter) {
      result = result.filter(p => p.statoAnagrafica === this.selectedStateFilter);
    }

    this.filteredPatients = result;
  }

  onSearchChange(): void {
    this.ngZone.run(() => {
      this.applyFilters();
    });
  }

  onStateFilterChange(state: StatoAnagrafica | null): void {
    this.ngZone.run(() => {
      this.selectedStateFilter = state;
      this.applyFilters();
    });
  }

  // Form management
  openNewPatientForm(): void {
    this.ngZone.run(() => {
      this.isEditMode = false;
      this.editingPatientId = null;
      this.editingPatient = this.getEmptyPatient();
      this.formError = null;
      this.showPatientForm = true;
    });
  }

  openAppointments(patient: Patient): void {
    this.dialog.open(PatientAppointmentsDialogComponent, {
      data: { patient },
      width: '700px',
      height: '500px',
      panelClass: 'resizable-dialog-panel',
    });
  }

  openEditPatientForm(patient: Patient): void {
    this.ngZone.run(() => {
      this.isEditMode = true;
      this.editingPatientId = patient.id;
      this.editingPatient = { ...patient };
      this.formError = null;
      this.showPatientForm = true;
    });
  }

  closePatientForm(): void {
    this.ngZone.run(() => {
      this.showPatientForm = false;
      this.isEditMode = false;
      this.editingPatientId = null;
      this.editingPatient = this.getEmptyPatient();
      this.formError = null;
    });
  }

  async savePatient(): Promise<void> {
    if (this.savingPatient) return;

    const nome = this.editingPatient.nome?.trim();
    const cognome = this.editingPatient.cognome?.trim();

    if (!nome || !cognome) {
      this.formError = 'Nome e cognome sono obbligatori';
      return;
    }

    // Validazione contatto: almeno telefono, cellulare o email
    const telefono = this.editingPatient.telefono?.trim();
    const cellulare = this.editingPatient.cellulare?.trim();
    const email = this.editingPatient.email?.trim();

    if (!telefono && !cellulare && !email) {
      this.formError = 'Almeno un contatto (telefono, cellulare o email) è obbligatorio';
      return;
    }

    this.savingPatient = true;
    this.formError = null;

    // Estrae solo i campi validi per l'input GraphQL (esclude campi readonly/computed)
    console.log('Raw editingPatient:', JSON.stringify(this.editingPatient, null, 2));
    const patientInput = this.extractValidInputFields(this.editingPatient);
    console.log('Filtered patientInput:', JSON.stringify(patientInput, null, 2));

    try {
      if (this.isEditMode && this.editingPatientId) {
        await firstValueFrom(
          this.patientService.updatePatient(this.editingPatientId, patientInput)
        );
      } else {
        await firstValueFrom(
          this.patientService.createPatient(patientInput)
        );
      }

      this.loadPatients();
      this.closePatientForm();
    } catch (error) {
      console.error('Error saving patient:', error);
      this.formError = this.isEditMode
        ? 'Errore durante l\'aggiornamento del paziente'
        : 'Errore durante la creazione del paziente';
    } finally {
      this.savingPatient = false;
    }
  }

  selectPatient(patient: Patient): void {
    this.ngZone.run(() => {
      this.selectedPatient = this.selectedPatient?.id === patient.id ? null : patient;
    });
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  onPatientView(patient: Patient): void {
    this.dialog.open(PatientFolderDialogComponent, {
      data: { patient },
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      panelClass: 'patient-folder-dialog-panel'
    });
  }

  onNewAppointment(patient: Patient): void {
    this.router.navigate(['/calendar'], {
      queryParams: { patientId: patient.id }
    });
  }

  // Helper methods
  getDisplayName(patient: Patient): string {
    return getPatientDisplayName(patient);
  }

  getPhone(patient: Patient): string {
    return getPatientPhone(patient);
  }

  getInitials(patient: Patient): string {
    const nome = patient.nome?.charAt(0)?.toUpperCase() || '';
    const cognome = patient.cognome?.charAt(0)?.toUpperCase() || '';
    return `${nome}${cognome}`;
  }

  getStateLabel(state?: string): string {
    const labels: Record<string, string> = {
      'BOZZA': 'Bozza',
      'PARZIALE': 'Parziale',
      'COMPLETA': 'Completa',
      'DA_VERIFICARE': 'Da verificare'
    };
    return state ? labels[state] || state : 'N/D';
  }

  getStateClass(state?: string): string {
    const classes: Record<string, string> = {
      'BOZZA': 'state-draft',
      'PARZIALE': 'state-partial',
      'COMPLETA': 'state-complete',
      'DA_VERIFICARE': 'state-verify'
    };
    return state ? classes[state] || '' : '';
  }

  getAge(dataNascita?: Date | string): number | null {
    if (!dataNascita) return null;
    const birth = new Date(dataNascita);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  formatDate(date?: Date | string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('it-IT');
  }

  /**
   * Estrae solo i campi validi per CreatePatientInput/UpdatePatientInput.
   * Esclude campi readonly/computed come __typename, id, nomeCompleto, etc.
   * Esclude anche stringhe vuote per campi opzionali.
   */
  private extractValidInputFields(patient: Partial<Patient>): Partial<Patient> {
    // Lista dei campi accettati dall'input GraphQL (da CreatePatientInput)
    const validFields = [
      'nome', 'cognome', 'genere', 'tipoPaziente',
      'codiceFiscale', 'dataNascita', 'comuneNascita', 'nazioneNascita', 'luogoNascitaEstero', 'statoCivile',
      'telefono', 'cellulare', 'email', 'pec', 'fax',
      'indirizzo', 'citta', 'provincia', 'cap', 'nazioneResidenza',
      'medicoBase', 'gruppoSanguigno', 'notes', 'allergie', 'farmaciInUso', 'patologieCroniche',
      'codiceSdi',
      'statoAnagrafica', 'statoPrivacy',
      'consensoPrivacy', 'dataConsensoPrivacy', 'consensoMarketing', 'consensoRicercaMedica',
      'cancellationsByYear', 'noShowsByYear',
      'convenzioneId',
      'codicePaziente', 'attivo', 'noteAmministrative'
    ];

    // Campi obbligatori che devono sempre essere inclusi
    const requiredFields = ['nome', 'cognome', 'genere', 'tipoPaziente'];

    const result: Partial<Patient> = {};
    for (const field of validFields) {
      const value = (patient as any)[field];

      // Includi sempre i campi obbligatori
      if (requiredFields.includes(field)) {
        if (value !== undefined && value !== null) {
          (result as any)[field] = value;
        }
        continue;
      }

      // Per i campi opzionali, escludi undefined, null e stringhe vuote
      if (value !== undefined && value !== null && value !== '') {
        (result as any)[field] = value;
      }
    }
    return result;
  }
}

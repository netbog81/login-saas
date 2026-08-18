import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil, firstValueFrom, Subscription } from 'rxjs';
import { Patient, getPatientDisplayName, getPatientPhone } from '../../../models/patient.model';
import { PatientService } from '../../../services/patient.service';
import { AddressAutocompleteService, AddressSuggestion } from '../../../services/address-autocomplete.service';
import { PatientAppointmentsDialogComponent } from '../../../features/operators-new/containers/patient-appointments-dialog.component';
import { PatientTreatmentsDialogComponent } from '../patient-treatments-dialog/patient-treatments-dialog.component';
import { PatientVouchersDialogComponent } from '../../../features/voucher-fe/components/patient-vouchers-dialog/patient-vouchers-dialog.component';
import { PatientTableComponent } from '../../../features/operators-new/components/patients-list/patient-table/patient-table.component';
import { PatientFolderDialogComponent } from '../../../features/operators-new/components/patient-folder-dialog/patient-folder-dialog.component';
import { tokenizeQuery, matchesAllTokens } from '../../../shared/utils/token-match';
import { WhatsappChatStateService } from '../../../features/whatsapp-chat/services/whatsapp-chat-state.service';

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
  /**
   * `true` quando `patients` contiene i risultati della ricerca remota sul
   * registry: in quel caso `applyFilters` salta il filtro testuale locale
   * (vedi commento del metodo).
   */
  private remoteResults = false;

  // Stats
  totalPatients = 0;
  completePatients = 0;
  pendingPatients = 0;

  // Address autocomplete state (registry → Google Places)
  addressSuggestions: AddressSuggestion[] = [];
  addressDropdownOpen = false;
  private addressSearchTimer?: ReturnType<typeof setTimeout>;
  private addressSearchSub?: Subscription;

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
    private addressAutocompleteService: AddressAutocompleteService,
    private ngZone: NgZone,
    private dialog: MatDialog,
    private router: Router,
    private chatState: WhatsappChatStateService
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

    // Registry max pageSize = 100. Per ricerche oltre i primi 100, l'utente
    // digita 3+ char nel box e parte la global-search remota (vedi onSearchChange).
    this.patientService.getPatients(100, 0)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (patients) => {
          this.patients = patients;
          this.remoteResults = false;
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

  /**
   * Filtraggio combinato:
   * - 0–2 caratteri  → filtro client-side sui pazienti già caricati (max 100)
   * - 3+ caratteri   → ricerca remota (POST /subjects/global-search del registry,
   *                    full-text + trigrammi + fonetico, intero dataset 3700+)
   *
   * Sui risultati remoti il filtro testuale NON viene riapplicato: il registry
   * ha già filtrato sull'intero dataset e un secondo filtro locale può solo
   * togliere match validi (es. il fonetico "Rosi" → "Rossi", che substring
   * non è).
   */
  applyFilters(): void {
    let result = [...this.patients];

    const term = this.searchTerm.trim();
    if (term && !this.remoteResults) {
      const tokens = tokenizeQuery(term);
      result = result.filter(p =>
        matchesAllTokens(
          [p.nome, p.cognome, p.codiceFiscale, p.telefono, p.cellulare, p.email],
          tokens,
        ),
      );
    }

    if (this.selectedStateFilter) {
      result = result.filter(p => p.statoAnagrafica === this.selectedStateFilter);
    }

    this.filteredPatients = result;
  }

  onSearchChange(): void {
    this.ngZone.run(() => {
      const term = this.searchTerm.trim();

      if (term.length >= 3) {
        // Search remoto sul registry (intero dataset)
        this.loading = true;
        this.patientService.searchPatients(term)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (patients) => {
              this.patients = patients;
              this.remoteResults = true;
              this.applyFilters();
              this.updateStats();
              this.loading = false;
            },
            error: (error) => {
              console.error('Error searching patients:', error);
              this.error = 'Errore nella ricerca';
              this.loading = false;
            }
          });
      } else if (term.length === 0) {
        // Box vuoto → ricarica i primi 100
        this.loadPatients();
      } else {
        // 1-2 char → filtro client-side sulla lista già caricata
        this.remoteResults = false;
        this.applyFilters();
      }
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

  /** Apre l'elenco di tutti i trattamenti eseguiti del paziente (stato, data, ecc.). */
  openTreatments(patient: Patient): void {
    this.dialog.open(PatientTreatmentsDialogComponent, {
      data: { patient },
      width: '640px',
      height: '520px',
      panelClass: 'resizable-dialog-panel',
    });
  }

  /** Apre l'elenco dei voucher FE del paziente (emetti, modifica importo, sospendi/annulla). */
  openVouchers(patient: Patient): void {
    this.dialog.open(PatientVouchersDialogComponent, {
      data: { patient },
      width: '680px',
      height: '560px',
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
      this.addressSuggestions = [];
      this.addressDropdownOpen = false;
      if (this.addressSearchTimer) clearTimeout(this.addressSearchTimer);
      this.addressSearchSub?.unsubscribe();
    });
  }

  // ==================== ADDRESS AUTOCOMPLETE ====================

  /**
   * Triggerato a ogni keystroke nel campo "Indirizzo".
   * Debounce 300ms; chiama il registry quando >= 3 char.
   */
  onAddressInputChange(value: string): void {
    const q = (value || '').trim();
    if (this.addressSearchTimer) clearTimeout(this.addressSearchTimer);
    if (q.length < 3) {
      this.addressSuggestions = [];
      this.addressDropdownOpen = false;
      return;
    }
    this.addressSearchTimer = setTimeout(() => {
      this.addressSearchSub?.unsubscribe();
      this.addressSearchSub = this.addressAutocompleteService.search(q, 'IT').subscribe({
        next: (results) => {
          this.ngZone.run(() => {
            this.addressSuggestions = results || [];
            this.addressDropdownOpen = this.addressSuggestions.length > 0;
          });
        },
        error: () => {
          this.ngZone.run(() => {
            this.addressSuggestions = [];
            this.addressDropdownOpen = false;
          });
        },
      });
    }, 300);
  }

  /**
   * Click su un suggerimento: popoliamo i campi indirizzo/cap/città/provincia.
   * Usa (mousedown) e non (click) per evitare il blur dell'input prima della selezione.
   */
  onAddressSuggestionPick(s: AddressSuggestion): void {
    const fullStreet = [s.street, s.streetNumber].filter(Boolean).join(', ');
    this.editingPatient = {
      ...this.editingPatient,
      indirizzo: fullStreet || s.fullAddress,
      cap: s.zipCode || this.editingPatient.cap,
      citta: s.city || this.editingPatient.citta,
      provincia: (s.province || '').toUpperCase().substring(0, 2) || this.editingPatient.provincia,
    };
    this.addressSuggestions = [];
    this.addressDropdownOpen = false;
  }

  /**
   * Chiude il dropdown all'uscita dall'input (con piccolo delay
   * per non ammazzare il click sull'opzione).
   */
  onAddressBlur(): void {
    setTimeout(() => {
      this.addressDropdownOpen = false;
    }, 200);
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

  /**
   * Apre il riquadro di chat WhatsApp col paziente, come dalla scheda
   * appuntamento. Il riquadro vive nella shell dell'applicazione, quindi resta
   * aperto anche cambiando pagina.
   */
  openWhatsappChat(patient: Patient): void {
    const phone = this.getPhone(patient);
    if (!phone) return;

    this.chatState.openForPhone({
      phone,
      patientId: patient.id,
      patientName: this.getDisplayName(patient),
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

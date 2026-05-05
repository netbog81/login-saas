import { Component, Inject, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators, AbstractControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Patient } from '../../../models/patient.model';
import { PatientService } from '../../../services/patient.service';
import { AddressAutocompleteService, AddressSuggestion } from '../../../services/address-autocomplete.service';
import { firstValueFrom, Observable, of } from 'rxjs';

/**
 * Dati opzionali da passare al dialog per pre-popolare i campi.
 */
export interface NewPatientDialogData {
  nome?: string;
  cognome?: string;
}

/**
 * Risultato restituito dal dialog alla chiusura.
 */
export interface NewPatientDialogResult {
  patient?: Patient;
  cancelled: boolean;
}

/**
 * Dialog per la creazione di un nuovo paziente.
 *
 * Utilizza MatDialog di Angular Material per garantire una corretta
 * gestione della change detection in qualsiasi contesto, inclusi
 * overlay custom del calendario.
 *
 * Segue l'architettura a 5 layer:
 * - Layer 3: Dumb Component (presentazionale)
 * - Usa ChangeDetectionStrategy.OnPush
 * - Riceve dati via MAT_DIALOG_DATA
 * - Restituisce risultati via MatDialogRef.close()
 */
@Component({
  selector: 'app-new-patient-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule
  ],
  template: `
    <h2 mat-dialog-title>Nuovo Paziente</h2>

    <mat-dialog-content>
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="form-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nome *</mat-label>
            <input matInput formControlName="nome" placeholder="Nome">
            <mat-error *ngIf="form.get('nome')?.hasError('required')">
              Il nome è obbligatorio
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Cognome *</mat-label>
            <input matInput formControlName="cognome" placeholder="Cognome">
            <mat-error *ngIf="form.get('cognome')?.hasError('required')">
              Il cognome è obbligatorio
            </mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Telefono</mat-label>
            <input matInput formControlName="telefono" placeholder="06 1234567">
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Cellulare</mat-label>
            <input matInput formControlName="cellulare" placeholder="333 1234567">
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" placeholder="email@esempio.it">
          <mat-error *ngIf="form.get('email')?.hasError('email')">
            Email non valida
          </mat-error>
        </mat-form-field>

        <!-- Indirizzo con autocomplete via registry → Google Places -->
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
          <mat-label>Indirizzo</mat-label>
          <input matInput
                 formControlName="indirizzo"
                 placeholder="Via, civico, città"
                 [matAutocomplete]="addressAuto">
          <mat-icon matSuffix>place</mat-icon>
          <mat-autocomplete #addressAuto="matAutocomplete"
                            (optionSelected)="onAddressSelected($event)"
                            [displayWith]="displayAddress">
            @for (s of addressSuggestions$ | async; track s.fullAddress) {
              <mat-option [value]="s">{{ s.fullAddress }}</mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>

        <div class="form-row form-row-3">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>CAP</mat-label>
            <input matInput formControlName="cap" placeholder="00100">
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Città</mat-label>
            <input matInput formControlName="citta">
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Prov.</mat-label>
            <input matInput formControlName="provincia" maxlength="2">
          </mat-form-field>
        </div>

        <!-- Errore: almeno un contatto obbligatorio -->
        <div class="contact-error" *ngIf="form.hasError('noContact') && form.touched">
          <mat-icon color="warn">warning</mat-icon>
          <span>Almeno un contatto (telefono, cellulare o email) è obbligatorio</span>
        </div>

        <!-- Errore server -->
        <div class="server-error" *ngIf="serverError">
          <mat-icon color="warn">error</mat-icon>
          <span>{{ serverError }}</span>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="onCancel()" [disabled]="saving">
        Annulla
      </button>
      <button mat-flat-button color="primary" (click)="onSubmit()" [disabled]="saving">
        <mat-spinner *ngIf="saving" diameter="20"></mat-spinner>
        <span *ngIf="!saving">Aggiungi Paziente</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 400px;
      /* NOTA: padding-top su mat-dialog-content NON funziona con Angular Material MDC
         perché Material usa margini negativi internamente. Usare margin-top su .form-row:first-child */
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .form-row.form-row-3 {
      grid-template-columns: 1fr 2fr 80px;
    }

    .form-row:first-child {
      margin-top: 8px; /* Spazio per floating label del primo campo (Nome/Cognome) */
    }

    .full-width {
      width: 100%;
    }

    mat-form-field {
      width: 100%;
    }

    .contact-error, .server-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      margin-bottom: 16px;
      border-radius: 4px;
    }

    .contact-error {
      background-color: #fff3cd;
      color: #856404;
    }

    .server-error {
      background-color: #f8d7da;
      color: #721c24;
    }

    mat-dialog-actions {
      padding: 16px 24px;
    }

    mat-dialog-actions button {
      min-width: 120px;
    }

    mat-spinner {
      display: inline-block;
    }
  `]
})
export class NewPatientDialogComponent {
  private fb = inject(FormBuilder);
  private patientService = inject(PatientService);
  private addressAutocomplete = inject(AddressAutocompleteService);

  form: FormGroup;
  saving = false;
  serverError = '';

  /** Suggerimenti indirizzo dal registry (Google Places sotto). */
  addressSuggestions$: Observable<AddressSuggestion[]> = of([]);

  constructor(
    public dialogRef: MatDialogRef<NewPatientDialogComponent, NewPatientDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: NewPatientDialogData
  ) {
    this.form = this.fb.group({
      nome: [data?.nome || '', Validators.required],
      cognome: [data?.cognome || '', Validators.required],
      telefono: [''],
      cellulare: [''],
      email: ['', Validators.email],
      indirizzo: [''],
      cap: [''],
      citta: [''],
      provincia: [''],
    }, {
      validators: [this.atLeastOneContactValidator]
    });

    // Autocomplete: si attiva con 3+ char nel campo indirizzo.
    const indirizzoControl = this.form.get('indirizzo') as FormControl;
    this.addressSuggestions$ = indirizzoControl.valueChanges.pipe(
      this.addressAutocomplete.searchPipe('IT'),
    );
  }

  /**
   * Quando l'utente seleziona un suggerimento, popoliamo i campi
   * indirizzo/cap/città/provincia.
   */
  onAddressSelected(event: MatAutocompleteSelectedEvent): void {
    const s = event.option.value as AddressSuggestion;
    if (!s) return;
    const fullStreet = [s.street, s.streetNumber].filter(Boolean).join(', ');
    this.form.patchValue({
      indirizzo: fullStreet || s.fullAddress,
      cap: s.zipCode || '',
      citta: s.city || '',
      provincia: (s.province || '').toUpperCase().substring(0, 2),
    });
  }

  /**
   * displayWith dell'autocomplete: quando l'utente seleziona un'opzione,
   * Material chiama questa funzione per scrivere il valore nell'input.
   * Per noi è la sola via semplificata.
   */
  displayAddress = (s: AddressSuggestion | string | null): string => {
    if (!s) return '';
    if (typeof s === 'string') return s;
    return [s.street, s.streetNumber].filter(Boolean).join(', ') || s.fullAddress;
  };

  /**
   * Validatore custom: almeno un contatto è obbligatorio.
   */
  private atLeastOneContactValidator(control: AbstractControl): { [key: string]: boolean } | null {
    const group = control as FormGroup;
    const telefono = group.get('telefono')?.value?.trim();
    const cellulare = group.get('cellulare')?.value?.trim();
    const email = group.get('email')?.value?.trim();

    if (!telefono && !cellulare && !email) {
      return { noContact: true };
    }
    return null;
  }

  /**
   * Gestisce il submit del form.
   */
  async onSubmit(): Promise<void> {
    // Marca tutti i campi come touched per mostrare gli errori
    this.form.markAllAsTouched();

    if (this.form.invalid || this.saving) {
      return;
    }

    this.saving = true;
    this.serverError = '';

    try {
      const patientData = {
        nome: this.form.value.nome.trim(),
        cognome: this.form.value.cognome.trim(),
        telefono: this.form.value.telefono?.trim() || '',
        cellulare: this.form.value.cellulare?.trim() || '',
        email: this.form.value.email?.trim() || '',
        indirizzo: this.form.value.indirizzo?.trim() || '',
        cap: this.form.value.cap?.trim() || '',
        citta: this.form.value.citta?.trim() || '',
        provincia: this.form.value.provincia?.trim().toUpperCase() || '',
        genere: 'NON_SPECIFICATO' as const,
        tipoPaziente: 'ADULTO_AUTONOMO' as const
      };

      const patient = await firstValueFrom(this.patientService.createPatient(patientData));
      this.dialogRef.close({ patient, cancelled: false });
    } catch (error) {
      console.error('[NewPatientDialog] Error creating patient:', error);
      this.serverError = 'Errore nella creazione del paziente. Riprova.';
      this.saving = false;
    }
  }

  /**
   * Annulla e chiude il dialog.
   */
  onCancel(): void {
    this.dialogRef.close({ cancelled: true });
  }
}

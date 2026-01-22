import { Component, Inject, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Patient } from '../../../models/patient.model';
import { PatientService } from '../../../services/patient.service';
import { firstValueFrom } from 'rxjs';

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
    MatProgressSpinnerModule
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

  form: FormGroup;
  saving = false;
  serverError = '';

  constructor(
    public dialogRef: MatDialogRef<NewPatientDialogComponent, NewPatientDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: NewPatientDialogData
  ) {
    this.form = this.fb.group({
      nome: [data?.nome || '', Validators.required],
      cognome: [data?.cognome || '', Validators.required],
      telefono: [''],
      cellulare: [''],
      email: ['', Validators.email]
    }, {
      validators: [this.atLeastOneContactValidator]
    });
  }

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

import { ChangeDetectionStrategy, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Observable, of, startWith, switchMap, debounceTime, distinctUntilChanged, catchError } from 'rxjs';
import { PatientService } from '../../../../services/patient.service';
import { Patient } from '../../../../models/patient.model';
import { formatPhone } from '../../models/whatsapp-chat.model';

export interface LinkPatientDialogData {
  /** Numero della conversazione da collegare (sole cifre). */
  phoneNumber: string;
  /** Nome profilo WhatsApp, se disponibile: aiuta a riconoscere chi scrive. */
  contactName?: string;
}

export interface LinkPatientDialogResult {
  patientId: string;
  patientName: string;
}

/**
 * Layer 1 — Dumb Component (dialog).
 *
 * Collega un numero sconosciuto a un paziente dell'anagrafica. Serve alle
 * conversazioni nate da un messaggio in arrivo: quelle aperte da un
 * appuntamento hanno gia' il paziente.
 */
@Component({
  selector: 'app-link-patient-dialog',
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
    MatAutocompleteModule,
  ],
  template: `
    <h2 mat-dialog-title>Collega a un paziente</h2>

    <mat-dialog-content>
      <div class="contact-recap">
        <mat-icon>phone</mat-icon>
        <div>
          <div class="contact-phone">{{ phoneLabel }}</div>
          @if (data.contactName) {
            <div class="contact-name">Profilo WhatsApp: {{ data.contactName }}</div>
          }
        </div>
      </div>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
        <mat-label>Paziente</mat-label>
        <input matInput
               [formControl]="searchControl"
               [matAutocomplete]="auto"
               placeholder="Cerca per nome, cognome o telefono…">
        <mat-autocomplete #auto="matAutocomplete"
                          [displayWith]="displayPatient"
                          (optionSelected)="onSelected($event)">
          @for (patient of filtered$ | async; track patient.id) {
            <mat-option [value]="patient">
              <span class="option-name">{{ patient.cognome }} {{ patient.nome }}</span>
              @if (patient.cellulare || patient.telefono) {
                <span class="option-phone"> — {{ patient.cellulare || patient.telefono }}</span>
              }
            </mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="dialogRef.close()">Annulla</button>
      <button mat-flat-button color="primary" [disabled]="!selected" (click)="confirm()">
        Collega
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: 420px; }
    .full-width { width: 100%; }

    .contact-recap {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      margin-bottom: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;

      mat-icon { color: #667eea; }
    }

    .contact-phone {
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }

    .contact-name {
      font-size: 12px;
      color: #64748b;
    }

    .option-phone {
      color: #64748b;
      font-size: 0.875rem;
    }
  `],
})
export class LinkPatientDialogComponent implements OnInit {
  private readonly patientService = inject(PatientService);

  searchControl = new FormControl('');
  filtered$!: Observable<Patient[]>;
  selected?: Patient;

  constructor(
    public dialogRef: MatDialogRef<LinkPatientDialogComponent, LinkPatientDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: LinkPatientDialogData,
  ) {}

  ngOnInit(): void {
    // Ricerca remota dal terzo carattere, come negli altri autocomplete
    // paziente: l'anagrafica ha migliaia di record e non è precaricata qui.
    this.filtered$ = this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(250),
      distinctUntilChanged((a, b) =>
        (typeof a === 'string' ? a : '') === (typeof b === 'string' ? b : ''),
      ),
      switchMap((value) => {
        const term = (typeof value === 'string' ? value : '').trim();
        if (term.length < 3) return of([] as Patient[]);
        return this.patientService.searchPatients(term).pipe(catchError(() => of([] as Patient[])));
      }),
    );
  }

  get phoneLabel(): string {
    return formatPhone(this.data.phoneNumber);
  }

  displayPatient = (patient: Patient | string | null): string => {
    if (!patient) return '';
    if (typeof patient === 'string') return patient;
    return `${patient.cognome ?? ''} ${patient.nome ?? ''}`.trim();
  };

  onSelected(event: MatAutocompleteSelectedEvent): void {
    this.selected = event.option.value as Patient;
  }

  confirm(): void {
    if (!this.selected) return;
    this.dialogRef.close({
      patientId: String(this.selected.id),
      patientName: this.displayPatient(this.selected),
    });
  }
}

import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import {
  Observable,
  of,
  startWith,
  switchMap,
  debounceTime,
  distinctUntilChanged,
  catchError,
  map,
} from 'rxjs';
import { PatientService } from '../../../../services/patient.service';
import { Patient } from '../../../../models/patient.model';

export interface NewChatDialogResult {
  phone: string;
  patientId: string;
  patientName: string;
}

/**
 * Layer 1 — Dumb Component (dialog).
 *
 * Avvia una conversazione partendo dall'anagrafica invece che da un
 * appuntamento o da un messaggio in arrivo: si cerca il paziente e si apre
 * direttamente la chat col suo numero.
 *
 * I pazienti senza recapito telefonico vengono esclusi dai risultati: sceglierne
 * uno non porterebbe da nessuna parte, e la ragione non sarebbe evidente.
 */
@Component({
  selector: 'app-new-chat-dialog',
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
    <h2 mat-dialog-title>Nuova chat</h2>

    <mat-dialog-content>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
        <mat-label>Paziente</mat-label>
        <input matInput
               cdkFocusInitial
               [formControl]="searchControl"
               [matAutocomplete]="auto"
               placeholder="Cerca per nome, cognome o telefono…">
        <mat-icon matSuffix>search</mat-icon>
        <mat-autocomplete #auto="matAutocomplete"
                          [displayWith]="displayPatient"
                          (optionSelected)="onSelected($event)">
          @for (patient of filtered$ | async; track patient.id) {
            <mat-option [value]="patient">
              <span class="option-name">{{ patient.cognome }} {{ patient.nome }}</span>
              <span class="option-phone"> — {{ phoneOf(patient) }}</span>
            </mat-option>
          }
        </mat-autocomplete>
        <mat-hint>Vengono elencati solo i pazienti con un numero di telefono</mat-hint>
      </mat-form-field>

      @if (selected) {
        <div class="selection">
          <mat-icon>chat</mat-icon>
          <div>
            <div class="selection-name">{{ displayPatient(selected) }}</div>
            <div class="selection-phone">{{ phoneOf(selected) }}</div>
          </div>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="dialogRef.close()">Annulla</button>
      <button mat-flat-button color="primary" [disabled]="!selected" (click)="confirm()">
        Apri chat
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: 420px; }
    .full-width { width: 100%; }

    .selection {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 20px;
      padding: 10px 12px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 4px;

      mat-icon { color: #16a34a; }
    }

    .selection-name { font-weight: 500; }

    .selection-phone {
      font-size: 12px;
      color: #64748b;
      font-variant-numeric: tabular-nums;
    }

    .option-phone {
      color: #64748b;
      font-size: 0.875rem;
    }
  `],
})
export class NewChatDialogComponent implements OnInit {
  private readonly patientService = inject(PatientService);

  searchControl = new FormControl('');
  filtered$!: Observable<Patient[]>;
  selected?: Patient;

  constructor(public dialogRef: MatDialogRef<NewChatDialogComponent, NewChatDialogResult>) {}

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
        return this.patientService.searchPatients(term).pipe(
          map((patients) => patients.filter((patient) => !!this.phoneOf(patient))),
          catchError(() => of([] as Patient[])),
        );
      }),
    );
  }

  phoneOf(patient: Patient): string {
    return patient.cellulare || patient.telefono || '';
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
      phone: this.phoneOf(this.selected),
      patientId: String(this.selected.id),
      patientName: this.displayPatient(this.selected),
    });
  }
}

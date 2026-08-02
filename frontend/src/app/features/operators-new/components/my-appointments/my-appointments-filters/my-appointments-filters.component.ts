import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import {
  MyAppointmentsFilters,
  MyAppointmentsViewMode,
} from '../../../models/my-appointments-filter.model';
import { MyAppointmentStatus } from '../../../models/my-appointments.model';
import { tokenizeQuery, matchesAllTokens } from '../../../../../shared/utils/token-match';

interface PatientOption {
  id: string;
  label: string;
}

const STATUS_OPTIONS: { value: MyAppointmentStatus; label: string }[] = [
  { value: 'scheduled', label: 'Prenotato' },
  { value: 'confirmed', label: 'Confermato' },
  { value: 'attended', label: 'Eseguito' },
  { value: 'no_show', label: 'No-show' },
  { value: 'cancelled', label: 'Disdetto' },
  { value: 'cancelled_early', label: 'Disdetto in anticipo' },
  { value: 'cancelled_late', label: 'Disdetto in ritardo' },
];

/**
 * Filtri dumb per "I miei appuntamenti".
 *
 * Layer 1 (presentational): solo Input/Output, niente chiamate GraphQL,
 * niente business logic. Emette `filtersChange` ad ogni modifica e
 * `viewModeChange` quando cambia la modalità di visualizzazione.
 */
@Component({
  selector: 'app-my-appointments-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
  ],
  template: `
    <div class="filters-row">
      <mat-form-field appearance="outline" class="date-field">
        <mat-label>Da</mat-label>
        <input
          matInput
          [matDatepicker]="pickerFrom"
          [ngModel]="dateFromAsDate"
          (ngModelChange)="onDateFromChange($event)" />
        <mat-datepicker-toggle matIconSuffix [for]="pickerFrom"></mat-datepicker-toggle>
        <mat-datepicker #pickerFrom></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" class="date-field">
        <mat-label>A</mat-label>
        <input
          matInput
          [matDatepicker]="pickerTo"
          [ngModel]="dateToAsDate"
          (ngModelChange)="onDateToChange($event)" />
        <mat-datepicker-toggle matIconSuffix [for]="pickerTo"></mat-datepicker-toggle>
        <mat-datepicker #pickerTo></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" class="status-field">
        <mat-label>Stato</mat-label>
        <mat-select
          multiple
          [ngModel]="filters.statuses ?? []"
          (ngModelChange)="onStatusesChange($event)">
          @for (opt of statusOptions; track opt.value) {
            <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="patient-field">
        <mat-label>Paziente</mat-label>
        <input
          type="text"
          matInput
          [ngModel]="patientSearchText"
          (ngModelChange)="onPatientSearchInput($event)"
          [matAutocomplete]="autoPatient"
          placeholder="Cerca paziente..." />
        <mat-autocomplete
          #autoPatient="matAutocomplete"
          [displayWith]="displayPatient"
          (optionSelected)="onPatientSelected($event.option.value)">
          @for (p of filteredPatients; track p.id) {
            <mat-option [value]="p">{{ p.label }}</mat-option>
          }
        </mat-autocomplete>
        @if (filters.patientId) {
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="onClearPatient()"
            aria-label="Rimuovi filtro paziente">
            <mat-icon>close</mat-icon>
          </button>
        }
      </mat-form-field>

      <button
        mat-stroked-button
        type="button"
        class="clear-all"
        (click)="onClearAll()">
        <mat-icon>filter_alt_off</mat-icon>
        Pulisci filtri
      </button>

      <mat-button-toggle-group
        [value]="viewMode"
        (change)="onViewModeChange($event.value)">
        <mat-button-toggle value="flat" matTooltip="Lista piatta">
          <mat-icon>view_list</mat-icon>
        </mat-button-toggle>
        <mat-button-toggle value="byPatient" matTooltip="Raggruppa per paziente">
          <mat-icon>groups</mat-icon>
        </mat-button-toggle>
      </mat-button-toggle-group>
    </div>
  `,
  styles: [
    `
      .filters-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .date-field {
        flex: 0 0 160px;
      }
      .status-field {
        flex: 0 0 200px;
      }
      .patient-field {
        flex: 1 1 240px;
        min-width: 240px;
      }
      .clear-all {
        height: 40px;
      }
      @media (max-width: 600px) {
        .filters-row > * {
          flex: 1 1 100% !important;
          min-width: 0;
        }
      }
    `,
  ],
})
export class MyAppointmentsFiltersComponent {
  @Input() filters: MyAppointmentsFilters = {};
  @Input() viewMode: MyAppointmentsViewMode = 'flat';
  @Input() patientOptions: PatientOption[] = [];

  @Output() filtersChange = new EventEmitter<MyAppointmentsFilters>();
  @Output() viewModeChange = new EventEmitter<MyAppointmentsViewMode>();

  readonly statusOptions = STATUS_OPTIONS;

  patientSearchText = '';
  filteredPatients: PatientOption[] = [];

  /** Converte la stringa YYYY-MM-DD del filtro in Date per il picker. */
  get dateFromAsDate(): Date | null {
    return this.filters.dateFrom ? new Date(this.filters.dateFrom) : null;
  }
  get dateToAsDate(): Date | null {
    return this.filters.dateTo ? new Date(this.filters.dateTo) : null;
  }

  ngOnChanges(): void {
    // Se filters.patientId arriva esterno, prepopola la search con la label
    const sel = this.patientOptions.find(p => p.id === this.filters.patientId);
    this.patientSearchText = sel?.label ?? '';
    this.filteredPatients = this.patientOptions;
  }

  onDateFromChange(d: Date | null): void {
    this.emit({ dateFrom: this.toIsoDate(d) });
  }

  onDateToChange(d: Date | null): void {
    this.emit({ dateTo: this.toIsoDate(d) });
  }

  onStatusesChange(statuses: MyAppointmentStatus[]): void {
    this.emit({ statuses: statuses.length ? statuses : undefined });
  }

  onPatientSearchInput(text: string): void {
    this.patientSearchText = text;
    if (typeof text !== 'string') return;
    const q = text.trim();
    // Match a token: la label è "Cognome Nome", ma l'utente può digitare
    // nell'ordine che preferisce.
    const tokens = tokenizeQuery(q);
    this.filteredPatients = q
      ? this.patientOptions.filter(p => matchesAllTokens([p.label], tokens))
      : this.patientOptions;
    // Se l'utente cancella tutto, rimuove anche il filtro id.
    if (q.length === 0 && this.filters.patientId) {
      this.emit({ patientId: undefined });
    }
  }

  onPatientSelected(option: PatientOption): void {
    this.patientSearchText = option.label;
    this.emit({ patientId: option.id });
  }

  onClearPatient(): void {
    this.patientSearchText = '';
    this.emit({ patientId: undefined });
  }

  onClearAll(): void {
    this.patientSearchText = '';
    this.filtersChange.emit({});
  }

  onViewModeChange(mode: MyAppointmentsViewMode): void {
    this.viewModeChange.emit(mode);
  }

  displayPatient = (p?: PatientOption | null): string => p?.label ?? '';

  /** Gestisce ngModel dell'autocomplete con stringa o oggetto. */
  private toIsoDate(d: Date | null): string | undefined {
    if (!d) return undefined;
    // YYYY-MM-DD in timezone locale (usiamo direttamente i valori del Date locale)
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private emit(patch: Partial<MyAppointmentsFilters>): void {
    this.filtersChange.emit({ ...this.filters, ...patch });
  }
}

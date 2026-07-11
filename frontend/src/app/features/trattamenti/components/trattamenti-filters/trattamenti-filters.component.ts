import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  TrattamentiFilters,
  TrattamentiViewMode,
  TreatmentStatus,
  TreatmentBillingStatus,
} from '../../models/trattamento.model';
import { BILLING_STATUS_LABELS } from '../treatment-billing-section/treatment-billing-section.component';

interface OperatorOption {
  id: string;
  label: string;
}

interface PatientOption {
  id: string;
  label: string;
}

const STATUS_LABELS: Record<TreatmentStatus, string> = {
  [TreatmentStatus.WAITING]: 'In attesa',
  [TreatmentStatus.IN_PROGRESS]: 'In corso',
  [TreatmentStatus.OPERATOR_COMPLETED]: 'Da chiudere',
  [TreatmentStatus.CLOSED]: 'Chiusi',
};

/**
 * Dumb component: filtri per la lista trattamenti.
 * Non conosce il backend; emette solo eventi di cambiamento verso il container.
 */
@Component({
  selector: 'app-trattamenti-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
  ],
  template: `
    <div class="filters-wrapper">
      <!-- VIEW MODE -->
      @if (showViewMode) {
        <div class="filters-row">
          <span class="filters-label">Vista:</span>
          <mat-button-toggle-group
            [value]="viewMode"
            (change)="viewModeChange.emit($event.value)"
            hideSingleSelectionIndicator>
            <mat-button-toggle value="flat">
              <mat-icon>list</mat-icon>
              Elenco
            </mat-button-toggle>
            <mat-button-toggle value="by-patient">
              <mat-icon>account_circle</mat-icon>
              Per paziente
            </mat-button-toggle>
            @if (canSelectOperator) {
              <mat-button-toggle value="by-operator">
                <mat-icon>badge</mat-icon>
                Per operatore
              </mat-button-toggle>
            }
            <mat-button-toggle value="by-day-operator">
              <mat-icon>calendar_view_day</mat-icon>
              Giorno / Operatore
            </mat-button-toggle>
          </mat-button-toggle-group>
        </div>
      }

      <!-- STATUS CHIPS -->
      <div class="filters-row">
        <span class="filters-label">Stato:</span>
        <mat-chip-listbox
          multiple
          [value]="filters.statuses || []"
          (change)="onStatusesChange($event.value)">
          @for (s of allStatuses; track s) {
            <mat-chip-option [value]="s">{{ labelFor(s) }}</mat-chip-option>
          }
        </mat-chip-listbox>
      </div>

      <!-- BILLING STATUS CHIPS (sessione 6 — stato fatturazione cross-modulo) -->
      <div class="filters-row">
        <span class="filters-label">Fatturazione:</span>
        <mat-chip-listbox
          multiple
          [value]="filters.billingStatuses || []"
          (change)="onBillingStatusesChange($event.value)">
          @for (b of allBillingStatuses; track b) {
            <mat-chip-option [value]="b">{{ billingLabelFor(b) }}</mat-chip-option>
          }
        </mat-chip-listbox>
      </div>

      <!-- DATE RANGE + OPERATOR + PATIENT -->
      <div class="filters-row filters-row-wrap">
        <mat-form-field appearance="outline" class="field-date">
          <mat-label>Dal</mat-label>
          <input
            matInput
            [matDatepicker]="pickerFrom"
            [value]="dateFromAsDate"
            (dateChange)="onDateFromChange($event.value)" />
          <mat-datepicker-toggle matIconSuffix [for]="pickerFrom"></mat-datepicker-toggle>
          <mat-datepicker #pickerFrom></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline" class="field-date">
          <mat-label>Al</mat-label>
          <input
            matInput
            [matDatepicker]="pickerTo"
            [value]="dateToAsDate"
            (dateChange)="onDateToChange($event.value)" />
          <mat-datepicker-toggle matIconSuffix [for]="pickerTo"></mat-datepicker-toggle>
          <mat-datepicker #pickerTo></mat-datepicker>
        </mat-form-field>

        <!-- Bottoni rapidi di selezione intervallo -->
        <div class="quick-dates">
          <button mat-stroked-button type="button" (click)="setToday()">Oggi</button>
          <button mat-stroked-button type="button" (click)="setThisWeek()">Settimana</button>
          <button mat-stroked-button type="button" (click)="setThisMonth()">Mese</button>
          <button mat-stroked-button type="button" (click)="setLastMonths(2)">Ultimi 2 mesi</button>
          <button mat-stroked-button type="button" (click)="setLastMonths(3)">Ultimi 3 mesi</button>
          <!-- "Tutti i trattamenti": azzera l'intervallo date per mostrare lo
               storico completo (del paziente se selezionato, altrimenti di
               tutti — la lista è paginata quindi il volume non è un problema). -->
          <button mat-flat-button color="primary" type="button"
                  (click)="showAllForPatient()"
                  matTooltip="Mostra tutti i trattamenti, senza filtro di data">
            <mat-icon>history</mat-icon>
            Tutti i trattamenti
          </button>
        </div>

        @if (canSelectOperator) {
          <mat-form-field appearance="outline" class="field-operator">
            <mat-label>Operatore</mat-label>
            <mat-select
              [value]="filters.operatorId || null"
              (selectionChange)="operatorIdChange.emit($event.value)">
              <mat-option [value]="null">Tutti</mat-option>
              @for (op of operators; track op.id) {
                <mat-option [value]="op.id">{{ op.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        <mat-form-field appearance="outline" class="field-patient">
          <mat-label>Paziente</mat-label>
          <input matInput
                 [matAutocomplete]="patientAuto"
                 [(ngModel)]="patientSearchText"
                 (ngModelChange)="onPatientSearchInput($event)"
                 placeholder="Cerca paziente…" />
          @if (patientSearchText) {
            <button matIconSuffix mat-icon-button type="button"
                    (click)="clearPatient()" matTooltip="Rimuovi filtro paziente">
              <mat-icon>close</mat-icon>
            </button>
          }
          <mat-autocomplete #patientAuto="matAutocomplete"
                            (optionSelected)="onPatientSelected($event.option.value)"
                            [displayWith]="displayPatient">
            @for (p of patients; track p.id) {
              <mat-option [value]="p">{{ p.label }}</mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>
      </div>

      <!-- BILLING FLAGS (solo segreteria) -->
      @if (showBillingFlags) {
        <div class="filters-row filters-row-wrap filters-row-tight">
          <mat-form-field appearance="outline" class="field-triflag">
            <mat-label>Inviato a fatturazione</mat-label>
            <mat-select
              [value]="filters.readyForBilling ?? null"
              (selectionChange)="readyForBillingChange.emit($event.value)">
              <mat-option [value]="null">Tutti</mat-option>
              <mat-option [value]="true">Sì</mat-option>
              <mat-option [value]="false">No</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="field-triflag">
            <mat-label>Fatturato</mat-label>
            <mat-select
              [value]="filters.isInvoicedToPatient ?? null"
              (selectionChange)="isInvoicedChange.emit($event.value)">
              <mat-option [value]="null">Tutti</mat-option>
              <mat-option [value]="true">Sì</mat-option>
              <mat-option [value]="false">No</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="field-triflag">
            <mat-label>Sconto FE</mat-label>
            <mat-select
              [value]="filters.scontoFE ?? null"
              (selectionChange)="scontoFEChange.emit($event.value)">
              <mat-option [value]="null">Tutti</mat-option>
              <mat-option [value]="true">Sì</mat-option>
              <mat-option [value]="false">No</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      }

      <div class="filters-row filters-row-actions">
        <button mat-stroked-button (click)="reset.emit()">
          <mat-icon>clear</mat-icon>
          Reset filtri
        </button>
      </div>
    </div>
  `,
  styles: [`
    .filters-wrapper {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px 0;
    }
    .filters-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: nowrap;
    }
    .filters-row-wrap { flex-wrap: wrap; }
    .filters-row-tight { gap: 8px; }
    .filters-row-actions { justify-content: flex-end; }
    .filters-label {
      font-weight: 500;
      color: rgba(0,0,0,0.6);
      white-space: nowrap;
    }
    mat-form-field {
      min-width: 140px;
    }
    .field-date { width: 160px; }
    .field-operator, .field-patient { min-width: 200px; flex: 1; }
    .field-triflag { width: 180px; }
    mat-chip-listbox { display: flex; flex-wrap: wrap; gap: 4px; }
    .quick-dates { display: flex; align-items: center; gap: 6px; }
    .quick-dates button { min-width: 0; padding: 0 12px; line-height: 32px; }
  `],
})
export class TrattamentiFiltersComponent {
  @Input() filters: TrattamentiFilters = {};
  @Input() viewMode: TrattamentiViewMode = 'flat';
  @Input() operators: OperatorOption[] = [];
  @Input() patients: PatientOption[] = [];
  /** Se true, mostra il selettore operatore (segreteria/admin). */
  @Input() canSelectOperator = false;
  /** Se true, mostra i flag pronto/fatturato/scontoFE (segreteria/admin). */
  @Input() showBillingFlags = false;
  /** Se true, mostra il toggle di vista (flat / by-patient / by-operator). */
  @Input() showViewMode = true;

  @Output() statusesChange = new EventEmitter<TreatmentStatus[]>();
  @Output() billingStatusesChange = new EventEmitter<TreatmentBillingStatus[]>();
  @Output() dateFromChange = new EventEmitter<string | null>();
  @Output() dateToChange = new EventEmitter<string | null>();
  /** Imposta dal+al in un colpo solo (bottoni rapidi oggi/settimana/mese). */
  @Output() dateRangeChange = new EventEmitter<{ from: string; to: string }>();
  @Output() operatorIdChange = new EventEmitter<string | null>();
  @Output() patientIdChange = new EventEmitter<string | null>();
  /** Termine di ricerca paziente (debounced lato container → registry). */
  @Output() patientSearchTerm = new EventEmitter<string>();
  @Output() readyForBillingChange = new EventEmitter<boolean | null>();
  @Output() isInvoicedChange = new EventEmitter<boolean | null>();
  @Output() scontoFEChange = new EventEmitter<boolean | null>();
  @Output() viewModeChange = new EventEmitter<TrattamentiViewMode>();
  /** Azzera l'intervallo date (dal/al = null): storico completo paziente. */
  @Output() clearDates = new EventEmitter<void>();
  @Output() reset = new EventEmitter<void>();

  /**
   * Stati selezionabili come filtro. WAITING è escluso intenzionalmente:
   * il valore non è presente nell'enum DB (`treatments_status_enum`) di
   * nessun tenant attualmente, quindi se passato al backend produce
   * `invalid input value for enum`. L'enum TS lo conserva come literal
   * per retrocompatibilità di switch/case ma non va mai inviato a SQL.
   */
  allStatuses: TreatmentStatus[] = [
    TreatmentStatus.IN_PROGRESS,
    TreatmentStatus.OPERATOR_COMPLETED,
    TreatmentStatus.CLOSED,
  ];

  labelFor(s: TreatmentStatus): string {
    return STATUS_LABELS[s] ?? s;
  }

  onStatusesChange(value: TreatmentStatus[]): void {
    this.statusesChange.emit(value);
  }

  /**
   * Stati billing selezionabili come filtro. Ordine ragionato (flusso temporale):
   * NOT_READY → READY_FOR_BILLING → SENT → PENDING → INVOICED → ...
   * I 4 stati post-INVOICED (REFUNDED, PARTIALLY_REFUNDED, REISSUED, CANCELLED)
   * a fondo lista perché meno frequenti.
   */
  allBillingStatuses: TreatmentBillingStatus[] = [
    TreatmentBillingStatus.NotReady,
    TreatmentBillingStatus.ReadyForBilling,
    TreatmentBillingStatus.Sent,
    TreatmentBillingStatus.Pending,
    TreatmentBillingStatus.Invoiced,
    TreatmentBillingStatus.PartiallyRefunded,
    TreatmentBillingStatus.Refunded,
    TreatmentBillingStatus.Reissued,
    TreatmentBillingStatus.Cancelled,
  ];

  billingLabelFor(b: TreatmentBillingStatus): string {
    return BILLING_STATUS_LABELS[b] ?? b;
  }

  onBillingStatusesChange(value: TreatmentBillingStatus[]): void {
    this.billingStatusesChange.emit(value);
  }

  get dateFromAsDate(): Date | null {
    return this.filters.dateFrom ? new Date(this.filters.dateFrom) : null;
  }

  get dateToAsDate(): Date | null {
    return this.filters.dateTo ? new Date(this.filters.dateTo) : null;
  }

  onDateFromChange(date: Date | null): void {
    this.dateFromChange.emit(date ? this.toIsoDate(date) : null);
  }

  onDateToChange(date: Date | null): void {
    this.dateToChange.emit(date ? this.toIsoDate(date) : null);
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ==================== RICERCA PAZIENTE ====================

  /** Testo digitato nel campo di ricerca paziente. */
  patientSearchText = '';
  private patientSearchDebounce?: ReturnType<typeof setTimeout>;

  /** Mostra il nome del paziente selezionato nell'input dell'autocomplete. */
  displayPatient = (p: PatientOption | string | null): string => {
    if (!p) return '';
    return typeof p === 'string' ? p : p.label;
  };

  /** Debounce la ricerca remota; ignora finché < 2 caratteri. */
  onPatientSearchInput(term: string): void {
    if (this.patientSearchDebounce) clearTimeout(this.patientSearchDebounce);
    // Se l'utente cancella il testo, azzera anche il filtro.
    if (!term || !term.trim()) {
      this.patientIdChange.emit(null);
    }
    const value = (term || '').trim();
    if (value.length < 2) return;
    this.patientSearchDebounce = setTimeout(() => {
      this.patientSearchTerm.emit(value);
    }, 300);
  }

  onPatientSelected(p: PatientOption): void {
    this.patientSearchText = p.label;
    this.patientIdChange.emit(p.id);
  }

  clearPatient(): void {
    this.patientSearchText = '';
    this.patientIdChange.emit(null);
    this.patientSearchTerm.emit('');
  }

  // ==================== BOTTONI RAPIDI DATA ====================

  /** Oggi: dal === al === oggi. */
  setToday(): void {
    const now = new Date();
    const iso = this.toIsoDate(now);
    this.dateRangeChange.emit({ from: iso, to: iso });
  }

  /** Questa settimana: lunedì → domenica della settimana corrente. */
  setThisWeek(): void {
    const now = new Date();
    const dow = now.getDay(); // 0=Dom..6=Sab
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    this.dateRangeChange.emit({ from: this.toIsoDate(monday), to: this.toIsoDate(sunday) });
  }

  /** Questo mese: primo → ultimo giorno del mese corrente. */
  setThisMonth(): void {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    this.dateRangeChange.emit({ from: this.toIsoDate(first), to: this.toIsoDate(last) });
  }

  /** Ultimi N mesi: da (oggi - N mesi) a oggi. */
  setLastMonths(months: number): void {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    this.dateRangeChange.emit({ from: this.toIsoDate(from), to: this.toIsoDate(now) });
  }

  /**
   * "Tutti i trattamenti": azzera l'intervallo date per mostrare lo storico
   * completo del paziente selezionato. Visibile solo quando c'è un paziente.
   */
  showAllForPatient(): void {
    this.clearDates.emit();
  }
}

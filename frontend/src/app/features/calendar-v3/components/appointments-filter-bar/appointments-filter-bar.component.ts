/**
 * Appointments Filter Bar — Calendario V3
 * Layer 1: Dumb Component
 *
 * Filtri della lista appuntamenti nella finestra Gestisci Appuntamenti:
 * periodo (campi data + periodi rapidi) e, quando si cerca per operatore,
 * tipo di fascia (retribuita / non retribuita) e nome del paziente.
 *
 * Il filtro testuale lavora sui risultati già caricati e cerca in titolo,
 * paziente, note e servizi: risponde sia a "quando rivede la signora Rossi?"
 * sia a "dove sono finite le riunioni?" — che per le fasce non retribuite è
 * l'unico modo di ritrovarle, non avendo un paziente. È tollerante: bastano
 * pezzi di parola e regge un refuso (vedi `shared/utils/text-match`).
 *
 * Solo @Input/@Output, nessuna logica di dominio, nessun GraphQL.
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnChanges, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  DateRange, DateRangePreset, DATE_RANGE_PRESET_LABELS,
} from '../../../../shared/utils/date-range-presets';

/** Quali fasce mostrare quando si cerca per operatore. */
export type PaymentFilter = 'all' | 'paid' | 'unpaid';

@Component({
  selector: 'app-v3-appointments-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatButtonToggleModule,
    MatFormFieldModule, MatInputModule, MatIconModule,
    MatDatepickerModule, MatNativeDateModule, MatTooltipModule,
  ],
  template: `
    <div class="filter-bar">
      <div class="row row-dates">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date-field">
          <mat-label>Dal</mat-label>
          <input matInput [matDatepicker]="dpFrom"
                 [ngModel]="fromDate"
                 (dateChange)="onFromChange($event.value)">
          <mat-datepicker-toggle matSuffix [for]="dpFrom"></mat-datepicker-toggle>
          <mat-datepicker #dpFrom></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date-field">
          <mat-label>Al</mat-label>
          <!-- Vuoto non è "non impostato" ma "senza fine": senza dirlo, il
               filtro "Da oggi in poi" sembrerebbe un campo rimasto in bianco. -->
          <input matInput [matDatepicker]="dpTo"
                 placeholder="senza limite"
                 [ngModel]="toDate"
                 (dateChange)="onToChange($event.value)">
          <mat-datepicker-toggle matSuffix [for]="dpTo"></mat-datepicker-toggle>
          <mat-datepicker #dpTo></mat-datepicker>
        </mat-form-field>
      </div>

      <div class="row row-presets">
        @for (preset of presets; track preset) {
          <button mat-stroked-button class="preset-btn" type="button"
                  (click)="presetSelected.emit(preset)">
            {{ presetLabel(preset) }}
          </button>
        }

        <span class="row-spacer"></span>

        <!-- Stampa ed export di quello che si sta guardando: filtrata
             l'agenda per operatore e periodo, il passo dopo è portarsela via. -->
        <button mat-icon-button type="button" class="export-btn"
                [disabled]="!canExport"
                (click)="print.emit()"
                matTooltip="Stampa l'elenco filtrato">
          <mat-icon>print</mat-icon>
        </button>
        <button mat-icon-button type="button" class="export-btn"
                [disabled]="!canExport"
                (click)="exportCsv.emit()"
                matTooltip="Esporta l'elenco filtrato in CSV">
          <mat-icon>download</mat-icon>
        </button>
      </div>

      @if (mode === 'operator') {
        <div class="row row-operator-filters">
          <mat-button-toggle-group [value]="paymentFilter"
                                   (change)="paymentFilterChange.emit($event.value)"
                                   hideSingleSelectionIndicator
                                   class="payment-toggle">
            <mat-button-toggle value="all">Tutti</mat-button-toggle>
            <mat-button-toggle value="paid" matTooltip="Solo appuntamenti con paziente">
              Retribuiti
            </mat-button-toggle>
            <mat-button-toggle value="unpaid" matTooltip="Pause, riunioni, fasce non retribuite">
              Non retribuiti
            </mat-button-toggle>
          </mat-button-toggle-group>

          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="patient-field">
            <mat-label>Cerca nel titolo o nel paziente</mat-label>
            <input matInput
                   [ngModel]="patientFilter"
                   (ngModelChange)="patientFilterChange.emit($event)"
                   placeholder="Es: rossi, riun, pausa pra"
                   autocomplete="off">
            @if (patientFilter) {
              <button mat-icon-button matSuffix type="button"
                      (click)="patientFilterChange.emit('')"
                      matTooltip="Rimuovi il filtro">
                <mat-icon>close</mat-icon>
              </button>
            } @else {
              <mat-icon matSuffix>person_search</mat-icon>
            }
          </mat-form-field>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; flex: 0 0 auto; }
    .filter-bar {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-bottom: 8px;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .date-field { flex: 1 1 140px; min-width: 128px; }
    .patient-field { flex: 1 1 180px; min-width: 160px; }
    .preset-btn {
      font-size: 0.72rem;
      line-height: 26px;
      padding: 0 8px;
      min-width: 0;
    }
    .row-spacer { flex: 1 1 auto; }
    .export-btn {
      width: 30px;
      height: 30px;
      line-height: 30px;
      color: #64748b;
    }
    .export-btn mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .payment-toggle { height: 30px; }
    ::ng-deep .payment-toggle .mat-button-toggle-label-content {
      line-height: 28px;
      font-size: 0.74rem;
      padding: 0 10px;
    }
  `],
})
export class V3AppointmentsFilterBarComponent implements OnChanges {
  /** 'patient' nasconde i filtri che hanno senso solo per operatore. */
  @Input() mode: 'patient' | 'operator' = 'patient';
  @Input() range: DateRange = { from: '', to: '' };
  @Input() paymentFilter: PaymentFilter = 'all';
  @Input() patientFilter = '';

  @Output() rangeChange = new EventEmitter<DateRange>();
  @Output() presetSelected = new EventEmitter<DateRangePreset>();
  @Output() paymentFilterChange = new EventEmitter<PaymentFilter>();
  @Output() patientFilterChange = new EventEmitter<string>();
  @Output() print = new EventEmitter<void>();
  @Output() exportCsv = new EventEmitter<void>();

  /** Falso quando non c'è nulla da stampare: i pulsanti restano spenti. */
  @Input() canExport = false;

  // Ordine crescente di ampiezza, così l'ultimo è quello che non finisce mai.
  readonly presets: DateRangePreset[] = [
    'today', 'thisWeek', 'thisMonth', 'nextMonth', 'next30Days', 'fromToday',
  ];

  /**
   * Il range arriva come stringhe, i datepicker vogliono Date. Campi STABILI
   * ricalcolati in ngOnChanges: un getter che costruisce un nuovo Date a ogni
   * giro, legato a un @Input OnPush, farebbe ridisegnare il calendario in
   * continuazione.
   */
  fromDate: Date | null = null;
  toDate: Date | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['range']) {
      this.fromDate = this.range.from ? new Date(this.range.from + 'T00:00:00') : null;
      this.toDate = this.range.to ? new Date(this.range.to + 'T00:00:00') : null;
    }
  }

  presetLabel(preset: DateRangePreset): string {
    return DATE_RANGE_PRESET_LABELS[preset];
  }

  onFromChange(date: Date | null): void {
    if (!date) return;
    this.rangeChange.emit({ from: this.toIso(date), to: this.range.to });
  }

  onToChange(date: Date | null): void {
    if (!date) return;
    this.rangeChange.emit({ from: this.range.from, to: this.toIso(date) });
  }

  private toIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

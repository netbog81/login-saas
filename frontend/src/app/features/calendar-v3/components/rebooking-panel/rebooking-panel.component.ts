/**
 * Rebooking Panel — Calendario V3
 * Layer 1: Dumb Component
 *
 * Pannello di riprenotazione di un appuntamento:
 * - riepilogo appuntamento corrente + pulsante "Modifica appuntamento"
 * - filtro per categoria operatore + card operatori responsiva
 * - range date (input manuale o datepicker) con durata
 * - navigazione slot a pagine di 2 settimane (avanti/indietro)
 * - griglia slot disponibili a colonne-giorno, scrollabile
 *
 * Solo @Input/@Output. Nessuna logica di business, nessun GraphQL.
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
  OnChanges, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AvailabilityAppointment } from '../../../../graphql/generated/types';
import {
  RebookingSlot, RebookingOperatorOption, RebookingSlotsByDay,
} from '../../models/rebooking.model';

/** Etichette leggibili per le macro-categorie operatore. */
const CATEGORY_LABELS: Record<string, string> = {
  PHYSIOTHERAPIST: 'Fisioterapisti',
  GYM_INSTRUCTOR: 'Istruttori palestra',
  DOCTOR: 'Medici',
  NURSE: 'Infermieri',
};

@Component({
  selector: 'app-v3-rebooking-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatButtonToggleModule,
    MatIconModule, MatCheckboxModule, MatChipsModule, MatFormFieldModule,
    MatInputModule, MatDatepickerModule, MatNativeDateModule,
    MatTooltipModule, MatProgressSpinnerModule,
  ],
  template: `
    @if (!appointment) {
      <div class="rb-empty">
        <mat-icon>swap_horiz</mat-icon>
        <span>Seleziona un appuntamento e premi "Sposta"</span>
      </div>
    } @else {
      <div class="rb-panel">
        <!-- Riepilogo appuntamento corrente -->
        <div class="rb-current">
          <div class="rb-current-head">
            <div class="rb-section-title">Appuntamento da spostare</div>
            <button mat-stroked-button class="rb-edit-btn"
                    (click)="editAppointment.emit()"
                    matTooltip="Modifica servizi, strumenti, note">
              <mat-icon>edit</mat-icon>
              Modifica
            </button>
          </div>
          <div class="rb-current-row">
            <mat-icon class="rb-ic">event</mat-icon>
            {{ formatDate(appointment.appointmentDate) }},
            {{ appointment.startTime }} - {{ appointment.endTime }}
          </div>
          <div class="rb-current-row">
            <mat-icon class="rb-ic">person</mat-icon>
            {{ originalOperatorName }}
          </div>
          <div class="rb-preserve-note">
            <mat-icon class="rb-ic-sm">lock</mat-icon>
            Servizi, strumenti e note vengono mantenuti (modificabili col tasto sopra).
          </div>
        </div>

        <!-- Parametri di ricerca -->
        <div class="rb-params">
          <div class="rb-section-title">Cerca disponibilità</div>

          <!-- Filtro categoria operatore -->
          @if (categories.length > 1) {
            <div class="rb-categories">
              <span class="rb-mini-label">Categoria:</span>
              <mat-chip-listbox [value]="activeCategory"
                                (change)="categoryChange.emit($event.value ?? '')">
                <mat-chip-option value="">Tutte</mat-chip-option>
                @for (cat of categories; track cat) {
                  <mat-chip-option [value]="cat">{{ categoryLabel(cat) }}</mat-chip-option>
                }
              </mat-chip-listbox>
            </div>
          }

          <!-- Card operatori (responsiva, va a capo) -->
          <div class="rb-operators-card">
            @if (operatorOptions.length === 0) {
              <span class="rb-mini-hint">Nessun operatore in questa categoria</span>
            } @else {
              @for (op of operatorOptions; track op.operatorId) {
                <mat-checkbox class="rb-op-chk"
                              [checked]="op.selected"
                              (change)="toggleOperator.emit(op.operatorId)">
                  {{ op.name }}@if (op.isOriginal) { <span class="rb-orig">(orig.)</span> }
                </mat-checkbox>
              }
            }
          </div>

          <!-- Range date + durata -->
          <div class="rb-range">
            <mat-form-field appearance="outline" class="rb-field">
              <mat-label>Dal</mat-label>
              <input matInput [matDatepicker]="dpStart"
                     [ngModel]="rangeStartDate"
                     (dateChange)="onRangeStart($event.value)">
              <mat-datepicker-toggle matSuffix [for]="dpStart"></mat-datepicker-toggle>
              <mat-datepicker #dpStart></mat-datepicker>
            </mat-form-field>
            <mat-form-field appearance="outline" class="rb-field">
              <mat-label>Al</mat-label>
              <input matInput [matDatepicker]="dpEnd"
                     [ngModel]="rangeEndDate"
                     (dateChange)="onRangeEnd($event.value)">
              <mat-datepicker-toggle matSuffix [for]="dpEnd"></mat-datepicker-toggle>
              <mat-datepicker #dpEnd></mat-datepicker>
            </mat-form-field>
            <mat-form-field appearance="outline" class="rb-field rb-field-sm">
              <mat-label>Durata (min)</mat-label>
              <input matInput type="number" min="5" step="5" [ngModel]="durationMinutes"
                     (ngModelChange)="durationChange.emit(+$event)">
            </mat-form-field>
            <button mat-flat-button color="primary" class="rb-search-btn"
                    (click)="search.emit()" [disabled]="loading">
              <mat-icon>search</mat-icon>
              Cerca slot
            </button>
          </div>
        </div>

        <!-- Navigazione settimane -->
        @if (slotsSearched || loading) {
          <div class="rb-week-nav">
            <button mat-stroked-button class="rb-nav-btn"
                    (click)="pageWeeks.emit('prev')"
                    [disabled]="!canPageBack || loading"
                    matTooltip="2 settimane precedenti">
              <mat-icon>chevron_left</mat-icon>
              2 sett.
            </button>
            <span class="rb-week-label">{{ rangeLabel }}</span>
            <button mat-stroked-button class="rb-nav-btn"
                    (click)="pageWeeks.emit('next')"
                    [disabled]="loading"
                    matTooltip="2 settimane successive">
              2 sett.
              <mat-icon>chevron_right</mat-icon>
            </button>
          </div>
        }

        <!-- Griglia slot -->
        <div class="rb-results">
          @if (loading) {
            <div class="rb-results-state">
              <mat-spinner diameter="32"></mat-spinner>
            </div>
          } @else if (searched && slotsByDay.length === 0) {
            <div class="rb-results-state hint">
              Nessuno slot disponibile nel periodo selezionato
            </div>
          } @else if (slotsByDay.length > 0) {
            <div class="rb-day-columns">
              @for (day of slotsByDay; track day.date) {
                <div class="rb-day-col">
                  <div class="rb-day-header">{{ formatDayShort(day.date) }}</div>
                  <div class="rb-day-slots">
                    @for (slot of day.slots; track slotKey(slot)) {
                      <button class="rb-slot"
                              [class.selected]="isSelected(slot)"
                              (click)="selectSlot.emit(slot)">
                        <span class="rb-slot-time">{{ slot.startTime }}</span>
                        <span class="rb-slot-op">{{ operatorShortName(slot.operatorId) }}</span>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Azione conferma -->
        <div class="rb-confirm">
          <button mat-flat-button color="primary"
                  [disabled]="!selectedSlot || saving"
                  (click)="confirm.emit()">
            @if (saving) {
              <mat-spinner diameter="18"></mat-spinner>
            } @else {
              <mat-icon>check</mat-icon>
            }
            Conferma spostamento
          </button>
          @if (selectedSlot) {
            <span class="rb-confirm-info">
              → {{ formatDate(selectedSlot.date) }}, {{ selectedSlot.startTime }}
              ({{ operatorShortName(selectedSlot.operatorId) }})
            </span>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .rb-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 100%;
      color: #94a3b8;
    }
    .rb-empty mat-icon { font-size: 40px; width: 40px; height: 40px; }
    .rb-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 10px;
      min-height: 0;
    }
    .rb-section-title {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #64748b;
    }
    .rb-mini-label {
      font-size: 0.74rem;
      color: #64748b;
      font-weight: 500;
    }
    .rb-mini-hint {
      font-size: 0.78rem;
      color: #94a3b8;
      font-style: italic;
    }
    /* Appuntamento corrente */
    .rb-current {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      flex: 0 0 auto;
    }
    .rb-current-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .rb-edit-btn {
      font-size: 0.74rem;
      line-height: 26px;
      padding: 0 8px;
      min-width: 0;
    }
    .rb-edit-btn .mat-icon {
      font-size: 15px; width: 15px; height: 15px; margin-right: 3px;
    }
    .rb-current-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      color: #1e293b;
    }
    .rb-ic { font-size: 17px; width: 17px; height: 17px; color: #0284c7; }
    .rb-ic-sm { font-size: 14px; width: 14px; height: 14px; }
    .rb-preserve-note {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 6px;
      font-size: 0.74rem;
      color: #64748b;
      font-style: italic;
    }
    /* Parametri */
    .rb-params { flex: 0 0 auto; }
    .rb-categories {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 6px 0;
      flex-wrap: wrap;
    }
    /* Card operatori responsiva: va a capo, non sfora il bordo */
    .rb-operators-card {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      padding: 8px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fafafa;
      margin-bottom: 8px;
      max-height: 110px;
      overflow-y: auto;
    }
    .rb-op-chk { font-size: 0.82rem; }
    .rb-orig { color: #94a3b8; font-size: 0.74rem; }
    .rb-range {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      flex-wrap: wrap;
    }
    .rb-field { width: 150px; }
    .rb-field-sm { width: 120px; }
    .rb-search-btn { margin-top: 6px; }
    /* Navigazione settimane */
    .rb-week-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex: 0 0 auto;
    }
    .rb-nav-btn {
      font-size: 0.76rem;
      line-height: 30px;
      padding: 0 8px;
      min-width: 0;
    }
    .rb-nav-btn .mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .rb-week-label {
      font-size: 0.8rem;
      color: #475569;
      font-weight: 500;
    }
    /* Griglia slot: scrollabile in entrambe le direzioni */
    .rb-results {
      flex: 1 1 auto;
      min-height: 120px;
      overflow: auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: white;
    }
    .rb-results-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 120px;
      color: #64748b;
      font-size: 0.85rem;
    }
    .rb-results-state.hint { font-style: italic; }
    .rb-day-columns {
      display: flex;
      gap: 8px;
      padding: 10px;
      align-items: flex-start;
      width: max-content;
    }
    .rb-day-col {
      flex: 0 0 128px;
      display: flex;
      flex-direction: column;
    }
    .rb-day-header {
      font-size: 0.76rem;
      font-weight: 600;
      color: #475569;
      text-align: center;
      padding: 4px;
      background: #f1f5f9;
      border-radius: 6px;
      text-transform: capitalize;
      margin-bottom: 6px;
    }
    .rb-day-slots {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .rb-slot {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      padding: 6px 4px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #f0fdf4;
      cursor: pointer;
      transition: all 0.12s;
    }
    .rb-slot:hover {
      border-color: #22c55e;
      background: #dcfce7;
    }
    .rb-slot.selected {
      border-color: #16a34a;
      background: #16a34a;
      color: white;
    }
    .rb-slot-time { font-size: 0.85rem; font-weight: 600; }
    .rb-slot-op { font-size: 0.68rem; opacity: 0.8; }
    .rb-confirm {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 0 0 auto;
    }
    .rb-confirm-info {
      font-size: 0.82rem;
      color: #16a34a;
      font-weight: 500;
    }
  `],
})
export class V3RebookingPanelComponent implements OnChanges {
  @Input() appointment: AvailabilityAppointment | null = null;
  @Input() originalOperatorName = '';
  @Input() operatorOptions: RebookingOperatorOption[] = [];
  @Input() categories: string[] = [];
  @Input() activeCategory = '';
  @Input() rangeStart = '';
  @Input() rangeEnd = '';
  @Input() durationMinutes = 45;
  @Input() slotsByDay: RebookingSlotsByDay[] = [];
  @Input() selectedSlot: RebookingSlot | null = null;
  @Input() loading = false;
  @Input() saving = false;
  /** true dopo che una ricerca slot e' stata eseguita. */
  @Input() searched = false;
  /** alias di searched, usato per mostrare la barra di navigazione. */
  @Input() slotsSearched = false;
  /** false quando rangeStart e' gia' a oggi (non si scorre nel passato). */
  @Input() canPageBack = true;

  @Output() toggleOperator = new EventEmitter<string>();
  @Output() categoryChange = new EventEmitter<string>();
  @Output() rangeStartChange = new EventEmitter<string>();
  @Output() rangeEndChange = new EventEmitter<string>();
  @Output() durationChange = new EventEmitter<number>();
  @Output() search = new EventEmitter<void>();
  @Output() pageWeeks = new EventEmitter<'prev' | 'next'>();
  @Output() editAppointment = new EventEmitter<void>();
  @Output() selectSlot = new EventEmitter<RebookingSlot>();
  @Output() confirm = new EventEmitter<void>();

  /**
   * rangeStart/rangeEnd come Date per i datepicker. Campi STABILI
   * ricalcolati solo in ngOnChanges: un getter che crea `new Date()` a
   * ogni chiamata e' legato a [ngModel] manderebbe il datepicker in loop
   * (referenze sempre diverse → change detection infinita).
   */
  rangeStartDate: Date | null = null;
  rangeEndDate: Date | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rangeStart']) {
      this.rangeStartDate = this.rangeStart
        ? new Date(this.rangeStart + 'T00:00:00') : null;
    }
    if (changes['rangeEnd']) {
      this.rangeEndDate = this.rangeEnd
        ? new Date(this.rangeEnd + 'T00:00:00') : null;
    }
  }

  onRangeStart(date: Date | null): void {
    if (date) this.rangeStartChange.emit(this.toIso(date));
  }
  onRangeEnd(date: Date | null): void {
    if (date) this.rangeEndChange.emit(this.toIso(date));
  }

  get rangeLabel(): string {
    if (!this.rangeStart || !this.rangeEnd) return '';
    return `${this.formatDate(this.rangeStart)} → ${this.formatDate(this.rangeEnd)}`;
  }

  categoryLabel(category: string): string {
    return CATEGORY_LABELS[category] ?? category;
  }

  formatDate(date: string): string {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('it-IT', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  }

  formatDayShort(date: string): string {
    return this.formatDate(date);
  }

  slotKey(slot: RebookingSlot): string {
    return `${slot.operatorId}|${slot.date}|${slot.startTime}`;
  }

  isSelected(slot: RebookingSlot): boolean {
    const s = this.selectedSlot;
    return !!s && s.operatorId === slot.operatorId &&
      s.date === slot.date && s.startTime === slot.startTime;
  }

  operatorShortName(operatorId: string): string {
    const op = this.operatorOptions.find(o => o.operatorId === operatorId);
    return op?.name ?? '—';
  }

  private toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

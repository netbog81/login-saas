/**
 * Patient Search — Calendario V3
 * Layer 1: Dumb Component
 *
 * Ricerca paziente per nome/cognome/telefono e lista risultati
 * selezionabile. Solo @Input/@Output, nessuna logica, nessun GraphQL.
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Patient, getPatientDisplayName } from '../../../../models/patient.model';

@Component({
  selector: 'app-v3-patient-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatFormFieldModule, MatInputModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="patient-search">
      <mat-form-field appearance="outline" class="search-field">
        <mat-label>Cerca paziente</mat-label>
        <input matInput
               [(ngModel)]="term"
               (ngModelChange)="onTermChange($event)"
               placeholder="Nome, cognome o telefono"
               autocomplete="off">
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>

      @if (loading) {
        <div class="search-state">
          <mat-spinner diameter="28"></mat-spinner>
        </div>
      } @else if (term.length > 0 && term.length < 2) {
        <div class="search-state hint">Digita almeno 2 caratteri</div>
      } @else if (searched && patients.length === 0) {
        <div class="search-state hint">Nessun paziente trovato</div>
      } @else {
        <div class="patient-list">
          @for (p of patients; track p.id) {
            <button class="patient-row"
                    [class.selected]="p.id === selectedPatientId"
                    (click)="selectPatient.emit(p)">
              <mat-icon class="row-icon">person</mat-icon>
              <span class="row-main">
                <span class="row-name">{{ displayName(p) }}</span>
                @if (p.telefono) {
                  <span class="row-phone">{{ p.telefono }}</span>
                }
              </span>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .patient-search {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .search-field { width: 100%; }
    .search-state {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      color: #64748b;
      font-size: 0.85rem;
    }
    .search-state.hint { font-style: italic; }
    .patient-list {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .patient-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 10px;
      border: 1px solid transparent;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      text-align: left;
      transition: background 0.12s;
    }
    .patient-row:hover { background: #f1f5f9; }
    .patient-row.selected {
      background: #e0f2fe;
      border-color: #38bdf8;
    }
    .row-icon {
      color: #94a3b8;
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
    }
    .row-main {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .row-name {
      font-size: 0.88rem;
      font-weight: 500;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .row-phone {
      font-size: 0.75rem;
      color: #64748b;
    }
  `],
})
export class V3PatientSearchComponent {
  @Input() patients: Patient[] = [];
  @Input() loading = false;
  /** true dopo che una ricerca e' stata eseguita (per il "nessun risultato"). */
  @Input() searched = false;
  @Input() selectedPatientId: string | null = null;

  /** Emesso a ogni cambio del testo di ricerca. */
  @Output() termChange = new EventEmitter<string>();
  @Output() selectPatient = new EventEmitter<Patient>();

  term = '';

  onTermChange(value: string): void {
    this.termChange.emit(value);
  }

  displayName(p: Patient): string {
    return getPatientDisplayName(p);
  }
}

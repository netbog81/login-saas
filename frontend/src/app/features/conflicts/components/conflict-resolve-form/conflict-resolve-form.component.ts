/**
 * Conflict Resolve Form
 * Layer 1: Dumb Component (presentazionale, OnPush)
 *
 * Il corpo del dialog di risoluzione: riepilogo dell'appuntamento in
 * conflitto, campi di riprogrammazione manuale e nota. Non esegue nulla —
 * emette `submit` con l'azione scelta e i dati compilati, e il container
 * (Layer 2) chiama il service.
 *
 * La riprogrammazione manuale è pre-compilata con data e orario ATTUALI
 * dell'appuntamento invece che vuota: chi riprogramma di solito sposta di
 * mezz'ora o al giorno dopo, e partire dal valore corrente rende quel caso
 * un'unica modifica invece di tre campi da riempire.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  ConflictedAppointment,
  ConflictOrigin,
  ConflictResolutionAction,
  conflictReasonLabel,
  conflictReasonDescription,
} from '../../models/conflict.model';

/** Scelta compilata dall'utente, pronta per il service. */
export interface ConflictResolveSubmit {
  action: ConflictResolutionAction;
  notes?: string;
  /** Solo per RESCHEDULE. */
  newDate?: string;
  newStartTime?: string;
  newEndTime?: string;
}

@Component({
  selector: 'app-conflict-resolve-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  template: `
    <div class="resolve-form">
      <!-- Riepilogo: cosa si sta risolvendo -->
      <div class="conflict-head">
        <mat-icon class="head-icon">warning</mat-icon>
        <div class="head-body">
          <div class="head-title">{{ reasonLabel }}</div>
          <div class="head-text">{{ reasonDescription }}</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Paziente</span>
          <span class="info-value">{{ appointment.clientName || '—' }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Data</span>
          <span class="info-value">{{ formatDate(appointment.appointmentDate) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Orario</span>
          <span class="info-value">{{ hhmm(appointment.startTime) }} - {{ hhmm(appointment.endTime) }}</span>
        </div>
        <div class="info-row" *ngIf="appointment.operatorName">
          <span class="info-label">Operatore</span>
          <span class="info-value">
            <span class="operator-badge"
                  [style.background]="appointment.operatorColor || '#64748b'">
              {{ appointment.operatorName }}
            </span>
          </span>
        </div>
        <div class="info-row" *ngIf="appointment.gymRoomName">
          <span class="info-label">Sala</span>
          <span class="info-value">{{ appointment.gymRoomName }}</span>
        </div>
        <div class="info-row" *ngIf="appointment.serviceName">
          <span class="info-label">Servizio</span>
          <span class="info-value">{{ appointment.serviceName }}</span>
        </div>
      </div>

      <!-- Avviso serie: la risoluzione tocca solo questa occorrenza -->
      <div class="series-note" *ngIf="appointment.isRecurring">
        <mat-icon>repeat</mat-icon>
        <span>
          Fa parte di una serie ricorrente: l'azione scelta riguarda solo
          questa occorrenza.
        </span>
      </div>

      <mat-divider></mat-divider>

      <!-- Riprogrammazione manuale -->
      <div class="reschedule-section">
        <div class="section-label">Riprogramma a mano</div>
        <div class="reschedule-fields">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nuova data</mat-label>
            <input matInput [matDatepicker]="newDatePicker"
                   [(ngModel)]="newDate" name="newDate">
            <mat-datepicker-toggle matIconSuffix [for]="newDatePicker"></mat-datepicker-toggle>
            <mat-datepicker #newDatePicker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="time-field">
            <mat-label>Inizio</mat-label>
            <input matInput type="time" [(ngModel)]="newStartTime" name="newStartTime">
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="time-field">
            <mat-label>Fine</mat-label>
            <input matInput type="time" [(ngModel)]="newEndTime" name="newEndTime">
          </mat-form-field>
        </div>
      </div>

      <!-- Nota di risoluzione -->
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
        <mat-label>Nota sulla risoluzione (facoltativa)</mat-label>
        <textarea matInput rows="2" [(ngModel)]="notes" name="notes"
                  placeholder="Es. paziente avvisato per telefono"></textarea>
      </mat-form-field>

      <!-- Azioni -->
      <div class="resolve-actions">
        <button mat-flat-button color="primary" type="button"
                [disabled]="busy"
                matTooltip="Lascia l'appuntamento dov'è e togli la segnalazione"
                (click)="emit(Actions.Keep)">
          <mat-icon>check</mat-icon>
          Accetta
        </button>

        <button mat-stroked-button type="button"
                *ngIf="canMove"
                [disabled]="busy"
                [matTooltip]="moveTooltip"
                (click)="move.emit()">
          <mat-icon>swap_horiz</mat-icon>
          Sposta su slot libero
        </button>

        <button mat-stroked-button type="button"
                [disabled]="busy || !canReschedule"
                matTooltip="Applica la data e l'orario indicati qui sopra"
                (click)="emit(Actions.Reschedule)">
          <mat-icon>event_repeat</mat-icon>
          Riprogramma
        </button>

        <span class="spacer"></span>

        <button mat-stroked-button color="warn" type="button"
                [disabled]="busy"
                matTooltip="Annulla l'appuntamento"
                (click)="emit(Actions.Cancel)">
          <mat-icon>event_busy</mat-icon>
          Cancella
        </button>
      </div>
    </div>
  `,
  styles: [`
    .resolve-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .conflict-head {
      display: flex;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 8px;
      border-left: 4px solid #dc2626;
      background: #fef2f2;
      color: #7f1d1d;
    }

    .head-icon { color: #dc2626; flex: 0 0 auto; }
    .head-body { min-width: 0; }
    .head-title { font-weight: 600; }
    .head-text { margin-top: 4px; font-size: 0.8125rem; line-height: 1.4; }

    .info-grid {
      display: grid;
      /* auto-fit: due colonne sul desktop, una sola sotto i 420px utili,
         senza dover duplicare la griglia in una media query. */
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 8px 20px;
    }

    .info-row {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
    }

    .info-label {
      flex: 0 0 82px;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #64748b;
    }

    .info-value {
      font-size: 0.9375rem;
      color: #0f172a;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .operator-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      color: #fff;
      font-size: 0.8125rem;
    }

    .series-note {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      background: #eff6ff;
      color: #1e40af;
      font-size: 0.8125rem;
    }

    .series-note mat-icon {
      font-size: 18px; width: 18px; height: 18px;
    }

    .section-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #64748b;
      margin-bottom: 8px;
    }

    .reschedule-fields {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .reschedule-fields mat-form-field { flex: 1 1 150px; min-width: 0; }
    .time-field { flex: 0 1 120px; }

    .full-width { width: 100%; }

    .resolve-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .spacer { flex: 1 1 auto; }

    .resolve-actions mat-icon {
      font-size: 18px; width: 18px; height: 18px;
      margin-right: 4px; vertical-align: middle;
    }

    @media (max-width: 599px) {
      .resolve-actions button { flex: 1 1 100%; }
      .spacer { display: none; }
    }
  `],
})
export class ConflictResolveFormComponent implements OnChanges {
  @Input() appointment!: ConflictedAppointment;
  @Input() origin: ConflictOrigin = 'dashboard';
  @Input() busy = false;

  /** Vedi ConflictBannerComponent.canMove: dipende dalla vista chiamante. */
  @Input() canMove = true;
  @Input() moveTooltip = 'Cerca uno slot libero e spostalo lì';

  @Output() submitResolution = new EventEmitter<ConflictResolveSubmit>();
  @Output() move = new EventEmitter<void>();

  /** Alias per il template: l'enum non è raggiungibile da lì. */
  readonly Actions = ConflictResolutionAction;

  newDate: Date | null = null;
  newStartTime = '';
  newEndTime = '';
  notes = '';

  ngOnChanges(changes: SimpleChanges): void {
    // SOLO al cambio di appuntamento. `busy` è un @Input e cambia a ogni
    // invio: senza questa guardia, premere "Riprogramma" azzerava i campi
    // appena compilati — e se la mutation falliva, l'utente ritrovava il
    // form vuoto con l'errore a schermo.
    if (!changes['appointment']) return;
    if (!this.appointment) return;
    const raw = this.appointment.appointmentDate;
    const d = raw instanceof Date ? new Date(raw) : new Date(raw);
    this.newDate = isNaN(d.getTime()) ? null : d;
    this.newStartTime = this.hhmm(this.appointment.startTime);
    this.newEndTime = this.hhmm(this.appointment.endTime);
  }

  get reasonLabel(): string {
    return conflictReasonLabel(this.appointment?.conflictReason);
  }

  get reasonDescription(): string {
    return conflictReasonDescription(this.appointment?.conflictReason);
  }

  get canReschedule(): boolean {
    return !!this.newDate && !!this.newStartTime && !!this.newEndTime;
  }

  emit(action: ConflictResolutionAction): void {
    const payload: ConflictResolveSubmit = {
      action,
      notes: this.notes.trim() || undefined,
    };
    if (action === ConflictResolutionAction.Reschedule) {
      payload.newDate = this.toDateString(this.newDate);
      payload.newStartTime = this.newStartTime;
      payload.newEndTime = this.newEndTime;
    }
    this.submitResolution.emit(payload);
  }

  /** Orari dal backend come 'HH:MM:SS': in UI servono 'HH:MM'. */
  hhmm(time: string | null | undefined): string {
    return (time ?? '').slice(0, 5);
  }

  formatDate(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('it-IT', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  /**
   * Data locale in 'YYYY-MM-DD'. NON via toISOString(): quello converte in
   * UTC e per i fusi a est della UTC restituisce il giorno prima — l'errore
   * che aveva già colpito le colonne `date` altrove nel calendario.
   */
  private toDateString(d: Date | null): string {
    if (!d) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}

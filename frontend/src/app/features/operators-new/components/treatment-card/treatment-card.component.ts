/**
 * Treatment Card Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare dettagli appuntamento selezionato
 * - Form per completamento trattamento (dolore, note, prezzo)
 * - Emettere eventi per azioni (start, complete, cancel)
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AvailabilityAppointment, BookingStatus } from '../../../../graphql/generated/types';
import { Patient } from '../../../../models/patient.model';

// Interfaccia per i dati di completamento trattamento
export interface TreatmentCompletionData {
  painAssessment: {
    painBefore?: number;  // Scala VAS 0-10
    painAfter?: number;   // Scala VAS 0-10
  };
  rescheduling: {
    suggestInDays?: number;
    suggestDateRangeStart?: string;
    suggestDateRangeEnd?: string;
    secretaryNotes?: string;
  };
  pricing: {
    price?: number;
  };
  notes: {
    operatorNotes?: string;
    patientNotes?: string;
  };
}

export type ReschedulingType = 'days' | 'range' | 'none';

@Component({
  selector: 'app-treatment-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    MatRadioModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  template: `
    <mat-card class="treatment-card" [class.no-appointment]="!appointment">
      @if (loading) {
        <div class="loading-overlay">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      }

      @if (!appointment) {
        <!-- Empty state -->
        <div class="empty-state">
          <mat-icon class="empty-icon">medical_services</mat-icon>
          <h3>Nessun appuntamento selezionato</h3>
          <p>Seleziona un appuntamento dalla lista per visualizzare i dettagli</p>
        </div>
      } @else {
        <!-- Header -->
        <mat-card-header class="card-header">
          <div class="header-content">
            <div class="time-info">
              <mat-icon>schedule</mat-icon>
              <span class="time">{{ formatTime(appointment.startTime) }} - {{ formatTime(appointment.endTime) }}</span>
              <span class="duration">({{ formatDuration() }})</span>
            </div>

            <div class="status-chip" [class]="getStatusClass()">
              <mat-icon>{{ getStatusIcon() }}</mat-icon>
              <span>{{ getStatusLabel() }}</span>
            </div>
          </div>
        </mat-card-header>

        <!-- Content -->
        <mat-card-content class="card-content">
          <!-- Patient info -->
          <div class="patient-info">
            <div class="patient-avatar">
              <mat-icon>person</mat-icon>
            </div>
            <div class="patient-details">
              <h3 class="patient-name">{{ getClientName() }}</h3>
              @if (getClientPhone()) {
                <div class="contact-row">
                  <mat-icon>phone</mat-icon>
                  <a [href]="'tel:' + getClientPhone()">{{ getClientPhone() }}</a>
                </div>
              }
              @if (getClientEmail()) {
                <div class="contact-row">
                  <mat-icon>email</mat-icon>
                  <a [href]="'mailto:' + getClientEmail()">{{ getClientEmail() }}</a>
                </div>
              }
            </div>
          </div>

          <!-- Completion form (expandable) -->
          @if (isInProgress()) {
            <mat-expansion-panel
              class="completion-panel"
              [expanded]="completionFormExpanded"
              (opened)="completionFormExpanded = true"
              (closed)="completionFormExpanded = false">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>assignment_turned_in</mat-icon>
                  Completa Trattamento
                </mat-panel-title>
              </mat-expansion-panel-header>

              <div class="completion-form">
                <!-- Pain assessment -->
                <div class="form-section">
                  <h4>Valutazione Dolore (VAS)</h4>
                  <div class="pain-sliders">
                    <div class="slider-group">
                      <label>Prima: {{ completionData.painAssessment.painBefore ?? '-' }}/10</label>
                      <mat-slider min="0" max="10" step="1" discrete>
                        <input matSliderThumb [(ngModel)]="completionData.painAssessment.painBefore">
                      </mat-slider>
                    </div>
                    <div class="slider-group">
                      <label>Dopo: {{ completionData.painAssessment.painAfter ?? '-' }}/10</label>
                      <mat-slider min="0" max="10" step="1" discrete>
                        <input matSliderThumb [(ngModel)]="completionData.painAssessment.painAfter">
                      </mat-slider>
                    </div>
                  </div>
                </div>

                <!-- Rescheduling -->
                <div class="form-section">
                  <h4>Riprogrammazione</h4>
                  <mat-radio-group [(ngModel)]="reschedulingType" class="reschedule-options">
                    <mat-radio-button value="none">Nessuna</mat-radio-button>
                    <mat-radio-button value="days">Fra N giorni</mat-radio-button>
                    <mat-radio-button value="range">Intervallo date</mat-radio-button>
                  </mat-radio-group>

                  @if (reschedulingType === 'days') {
                    <mat-form-field appearance="outline" class="days-input">
                      <mat-label>Giorni</mat-label>
                      <input matInput type="number" min="1" [(ngModel)]="completionData.rescheduling.suggestInDays">
                    </mat-form-field>
                  }

                  @if (reschedulingType === 'range') {
                    <div class="date-range-inputs">
                      <mat-form-field appearance="outline">
                        <mat-label>Da</mat-label>
                        <input matInput type="date" [(ngModel)]="completionData.rescheduling.suggestDateRangeStart">
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>A</mat-label>
                        <input matInput type="date" [(ngModel)]="completionData.rescheduling.suggestDateRangeEnd">
                      </mat-form-field>
                    </div>
                  }

                  @if (reschedulingType !== 'none') {
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Note per segreteria</mat-label>
                      <textarea matInput rows="2" [(ngModel)]="completionData.rescheduling.secretaryNotes"></textarea>
                    </mat-form-field>
                  }
                </div>

                <!-- Pricing -->
                <div class="form-section">
                  <h4>Tariffa</h4>
                  <mat-form-field appearance="outline" class="price-input">
                    <mat-label>Prezzo (€)</mat-label>
                    <input matInput type="number" min="0" step="0.01" [(ngModel)]="completionData.pricing.price">
                    <mat-icon matPrefix>euro</mat-icon>
                  </mat-form-field>
                </div>

                <!-- Notes -->
                <div class="form-section">
                  <h4>Note</h4>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Note operatore</mat-label>
                    <textarea matInput rows="2" [(ngModel)]="completionData.notes.operatorNotes"></textarea>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Info paziente</mat-label>
                    <textarea matInput rows="2" [(ngModel)]="completionData.notes.patientNotes"></textarea>
                  </mat-form-field>
                </div>
              </div>
            </mat-expansion-panel>
          }
        </mat-card-content>

        <!-- Actions -->
        <mat-card-actions class="card-actions">
          @if (canStartTreatment()) {
            <button mat-raised-button color="primary" (click)="onStartTreatment()">
              <mat-icon>play_arrow</mat-icon>
              Inizia Trattamento
            </button>
          }

          @if (canCompleteTreatment()) {
            <button mat-raised-button color="accent" (click)="onCompleteTreatment()">
              <mat-icon>check</mat-icon>
              Completa
            </button>
          }

          <button mat-button (click)="onViewPatientFolder()" matTooltip="Vedi cartella paziente">
            <mat-icon>folder_open</mat-icon>
            Cartella
          </button>

          @if (!isCancelled()) {
            <button mat-button color="warn" (click)="onCancelAppointment()" matTooltip="Annulla appuntamento">
              <mat-icon>cancel</mat-icon>
              Annulla
            </button>
          }
        </mat-card-actions>
      }
    </mat-card>
  `,
  styles: [`
    .treatment-card {
      position: relative;
      border-radius: 16px;
      overflow: hidden;

      &.no-appointment {
        min-height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;

      .empty-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #cbd5e1;
        margin-bottom: 16px;
      }

      h3 {
        margin: 0 0 8px;
        color: #64748b;
        font-weight: 500;
      }

      p {
        margin: 0;
        color: #94a3b8;
        font-size: 0.875rem;
      }
    }

    .card-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 16px 20px;
      color: white;
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      width: 100%;
    }

    .time-info {
      display: flex;
      align-items: center;
      gap: 8px;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .time {
        font-weight: 600;
        font-size: 1.125rem;
        font-family: 'SF Mono', 'Roboto Mono', monospace;
      }

      .duration {
        font-size: 0.875rem;
        opacity: 0.8;
      }
    }

    .status-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      &.status-scheduled {
        background: rgba(255, 255, 255, 0.2);
        color: white;
      }

      &.status-confirmed {
        background: #dcfce7;
        color: #166534;
      }

      &.status-attended {
        background: #fef3c7;
        color: #92400e;
      }

      &.status-cancelled {
        background: #fee2e2;
        color: #dc2626;
      }
    }

    .card-content {
      padding: 20px;
    }

    .patient-info {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 20px;
    }

    .patient-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: white;
      }
    }

    .patient-details {
      flex: 1;

      .patient-name {
        margin: 0 0 8px;
        font-size: 1.25rem;
        font-weight: 600;
        color: #1e293b;
      }

      .contact-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 4px;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #64748b;
        }

        a {
          color: #667eea;
          text-decoration: none;
          font-size: 0.875rem;

          &:hover {
            text-decoration: underline;
          }
        }
      }
    }

    .completion-panel {
      margin-top: 16px;
      border-radius: 12px;
      background: #f8fafc;

      ::ng-deep {
        .mat-expansion-panel-header-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #667eea;
          font-weight: 500;
        }
      }
    }

    .completion-form {
      padding: 16px 0;
    }

    .form-section {
      margin-bottom: 24px;

      &:last-child {
        margin-bottom: 0;
      }

      h4 {
        margin: 0 0 12px;
        font-size: 0.875rem;
        font-weight: 600;
        color: #334155;
      }
    }

    .pain-sliders {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }

    .slider-group {
      flex: 1;
      min-width: 150px;

      label {
        display: block;
        margin-bottom: 8px;
        font-size: 0.8125rem;
        color: #64748b;
      }

      mat-slider {
        width: 100%;
      }
    }

    .reschedule-options {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .days-input {
      width: 120px;
    }

    .date-range-inputs {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 12px;

      mat-form-field {
        flex: 1;
        min-width: 140px;
      }
    }

    .price-input {
      width: 160px;
    }

    .full-width {
      width: 100%;
    }

    .card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 16px 20px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    /* Responsive */
    @media (max-width: 599px) {
      .header-content {
        flex-direction: column;
        align-items: flex-start;
      }

      .patient-info {
        flex-direction: column;
        align-items: center;
        text-align: center;
      }

      .patient-details .contact-row {
        justify-content: center;
      }

      .pain-sliders {
        flex-direction: column;
      }

      .card-actions {
        flex-direction: column;

        button {
          width: 100%;
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreatmentCardComponent {
  @Input() appointment: AvailabilityAppointment | null = null;
  @Input() patient: Patient | null = null;
  @Input() loading = false;

  @Output() startTreatment = new EventEmitter<void>();
  @Output() completeTreatment = new EventEmitter<TreatmentCompletionData>();
  @Output() viewPatientFolder = new EventEmitter<void>();
  @Output() cancelAppointment = new EventEmitter<void>();

  // Stato form completamento
  completionFormExpanded = false;
  reschedulingType: ReschedulingType = 'none';

  completionData: TreatmentCompletionData = {
    painAssessment: {},
    rescheduling: {},
    pricing: {},
    notes: {}
  };

  onStartTreatment(): void {
    this.startTreatment.emit();
  }

  onCompleteTreatment(): void {
    this.completeTreatment.emit(this.completionData);
    this.resetCompletionForm();
  }

  resetCompletionForm(): void {
    this.completionData = {
      painAssessment: {},
      rescheduling: {},
      pricing: {},
      notes: {}
    };
    this.reschedulingType = 'none';
    this.completionFormExpanded = false;
  }

  onViewPatientFolder(): void {
    this.viewPatientFolder.emit();
  }

  onCancelAppointment(): void {
    this.cancelAppointment.emit();
  }

  getClientName(): string {
    if (this.patient) {
      return `${this.patient.nome} ${this.patient.cognome}`;
    }
    if (this.appointment) {
      return this.appointment.clientName || 'Cliente';
    }
    return 'Cliente';
  }

  getClientPhone(): string {
    if (this.patient) {
      return this.patient.cellulare || this.patient.telefono || '';
    }
    if (this.appointment) {
      return this.appointment.clientPhone || '';
    }
    return '';
  }

  getClientEmail(): string {
    if (this.patient) {
      return this.patient.email || '';
    }
    if (this.appointment) {
      return this.appointment.clientEmail || '';
    }
    return '';
  }

  formatTime(time: string | undefined | null): string {
    return time?.substring(0, 5) || '';
  }

  formatDuration(): string {
    if (!this.appointment?.startTime || !this.appointment?.endTime) return '';

    const [startH, startM] = this.appointment.startTime.split(':').map(Number);
    const [endH, endM] = this.appointment.endTime.split(':').map(Number);
    const duration = (endH * 60 + endM) - (startH * 60 + startM);

    if (duration >= 60) {
      const hours = Math.floor(duration / 60);
      const mins = duration % 60;
      return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    }
    return `${duration} min`;
  }

  getStatusClass(): string {
    if (!this.appointment) return 'status-scheduled';

    switch (this.appointment.bookingStatus) {
      case BookingStatus.Scheduled: return 'status-scheduled';
      case BookingStatus.Confirmed: return 'status-confirmed';
      case BookingStatus.NoShow: return 'status-attended';
      case BookingStatus.Cancelled: return 'status-cancelled';
      default: return 'status-scheduled';
    }
  }

  getStatusIcon(): string {
    if (!this.appointment) return 'event';

    switch (this.appointment.bookingStatus) {
      case BookingStatus.Scheduled: return 'event';
      case BookingStatus.Confirmed: return 'check_circle';
      case BookingStatus.NoShow: return 'person_off';
      case BookingStatus.Cancelled: return 'cancel';
      default: return 'event';
    }
  }

  getStatusLabel(): string {
    if (!this.appointment) return 'Programmato';

    switch (this.appointment.bookingStatus) {
      case BookingStatus.Scheduled: return 'Programmato';
      case BookingStatus.Confirmed: return 'Confermato';
      case BookingStatus.NoShow: return 'Non presentato';
      case BookingStatus.Cancelled: return 'Annullato';
      default: return 'Programmato';
    }
  }

  canStartTreatment(): boolean {
    if (!this.appointment) return false;
    return this.appointment.bookingStatus === BookingStatus.Scheduled ||
           this.appointment.bookingStatus === BookingStatus.Confirmed;
  }

  canCompleteTreatment(): boolean {
    // Per ora usiamo NoShow come "in progress" dato che non c'è uno stato "attended" nell'enum
    return this.appointment?.bookingStatus === BookingStatus.NoShow;
  }

  isInProgress(): boolean {
    return this.appointment?.bookingStatus === BookingStatus.NoShow;
  }

  isCancelled(): boolean {
    return this.appointment?.bookingStatus === BookingStatus.Cancelled;
  }
}

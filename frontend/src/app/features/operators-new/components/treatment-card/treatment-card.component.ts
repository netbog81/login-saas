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
import { Treatment, TreatmentStatus, getTreatmentStatusLabel } from '../../../../models/treatment.model';

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
          <!-- Patient info - SOLO se NON è non retribuito -->
          @if (!isNonRetribuito()) {
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

              <!-- Dettagli appuntamento -->
              @if (hasServices() || hasInstruments() || hasNotes()) {
                <div class="appointment-details">
                  @if (hasServices()) {
                    <div class="detail-row services">
                      <mat-icon class="detail-icon">medical_services</mat-icon>
                      <div class="detail-content">
                        <span class="detail-label">Servizi</span>
                        <span class="detail-value">{{ getServicesNames() }}</span>
                      </div>
                    </div>
                  }
                  @if (hasInstruments()) {
                    <div class="detail-row instruments">
                      <mat-icon class="detail-icon">fitness_center</mat-icon>
                      <div class="detail-content">
                        <span class="detail-label">Strumenti</span>
                        <span class="detail-value">{{ getInstrumentsNames() }}</span>
                      </div>
                    </div>
                  }
                  @if (hasNotes()) {
                    <div class="detail-row notes">
                      <mat-icon class="detail-icon">notes</mat-icon>
                      <div class="detail-content">
                        <span class="detail-label">Note</span>
                        <span class="detail-value">{{ getAppointmentNotes() }}</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }

          <!-- Non Retribuito Info - SOLO se è non retribuito -->
          @if (isNonRetribuito()) {
            <div class="non-retribuito-info">
              <div class="non-retribuito-badge">
                <mat-icon>free_cancellation</mat-icon>
                <span>Non retribuito</span>
              </div>
              <div class="event-details">
                <mat-icon class="event-icon">event_note</mat-icon>
                <h3 class="event-title">{{ appointment?.clientName }}</h3>
              </div>
            </div>
          }

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
          <!-- Se NON retribuito: solo pulsante Elimina -->
          @if (isNonRetribuito()) {
            <button mat-raised-button color="warn" (click)="onDeleteNonRetribuito()" matTooltip="Elimina appuntamento">
              <mat-icon>delete</mat-icon>
              Elimina
            </button>
          } @else {
            <!-- Trattamento in corso -->
            @if (hasTreatmentInProgress()) {
              <div class="treatment-in-progress-badge">
                <mat-icon>hourglass_empty</mat-icon>
                <span>Trattamento in corso</span>
              </div>

              <div class="action-buttons-row">
                <button mat-raised-button (click)="onEditTreatment()" matTooltip="Modifica dati trattamento">
                  <mat-icon>edit</mat-icon>
                  Modifica
                </button>

                <div class="spacer"></div>

                <button mat-button color="warn" (click)="onCancelTreatment()" matTooltip="Annulla trattamento in corso">
                  <mat-icon>close</mat-icon>
                  Annulla
                </button>

                <button mat-raised-button color="accent" (click)="onFinishTreatment()" matTooltip="Completa il trattamento">
                  <mat-icon>check_circle</mat-icon>
                  Completa Trattamento
                </button>
              </div>
            }

            <!-- Trattamento completato da operatore (in attesa segreteria) -->
            @if (isTreatmentOperatorCompleted()) {
              <div class="treatment-completed-badge">
                <mat-icon>pending</mat-icon>
                <span>{{ getTreatmentStatusLabel() }}</span>
              </div>
            }

            <!-- Trattamento chiuso -->
            @if (isTreatmentClosed()) {
              <div class="treatment-closed-badge">
                <mat-icon>task_alt</mat-icon>
                <span>{{ getTreatmentStatusLabel() }}</span>
              </div>
            }

            <!-- Nessun trattamento in corso: mostra solo pulsante Inizia -->
            @if (!hasTreatmentInProgress() && !isTreatmentOperatorCompleted() && !isTreatmentClosed()) {
              @if (canStartTreatment()) {
                <button mat-raised-button color="primary" (click)="onStartTreatment()">
                  <mat-icon>play_arrow</mat-icon>
                  Inizia Trattamento
                </button>
              }
            }

            <button mat-button (click)="onViewPatientFolder()" matTooltip="Vedi cartella paziente">
              <mat-icon>folder_open</mat-icon>
              Cartella
            </button>

            <!-- NOTA: Pulsante "Annulla appuntamento" rimosso temporaneamente.
                 Richiede implementazione sistema notifiche per segreteria.
                 Vedere piano: Section 11 in cosmic-wishing-fairy.md -->
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
      min-width: 0;

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

    .appointment-details {
      flex: 1;
      min-width: 200px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-left: 16px;
      border-left: 2px solid #e2e8f0;

      .detail-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;

        .detail-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #64748b;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .detail-content {
          display: flex;
          flex-direction: column;
          min-width: 0;

          .detail-label {
            font-size: 11px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .detail-value {
            font-size: 13px;
            color: #334155;
            word-break: break-word;
          }
        }

        &.services .detail-icon { color: #667eea; }
        &.instruments .detail-icon { color: #10b981; }
        &.notes .detail-icon { color: #f59e0b; }
      }
    }

    /* Non Retribuito Info Styles */
    .non-retribuito-info {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 20px;

      .non-retribuito-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #fef3c7;
        color: #92400e;
        padding: 6px 14px;
        border-radius: 16px;
        font-weight: 500;
        font-size: 0.8125rem;
        width: fit-content;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #d97706;
        }
      }

      .event-details {
        display: flex;
        align-items: center;
        gap: 12px;

        .event-icon {
          color: #6b7280;
          font-size: 32px;
          width: 32px;
          height: 32px;
        }

        .event-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0;
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

    .action-buttons-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }

    .spacer {
      flex: 1;
    }

    .treatment-in-progress-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-radius: 8px;
      color: #92400e;
      font-weight: 500;
      font-size: 0.875rem;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #d97706;
      }
    }

    .treatment-completed-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
      border-radius: 8px;
      color: #1e40af;
      font-weight: 500;
      font-size: 0.875rem;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #3b82f6;
      }
    }

    .treatment-closed-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
      border-radius: 8px;
      color: #166534;
      font-weight: 500;
      font-size: 0.875rem;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #16a34a;
      }
    }

    /* Responsive */
    @media (max-width: 767px) {
      .patient-info {
        flex-wrap: wrap;
      }

      .appointment-details {
        width: 100%;
        border-left: none;
        border-top: 1px solid #e2e8f0;
        padding-left: 0;
        padding-top: 12px;
        margin-top: 8px;
      }
    }

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

      .appointment-details {
        align-items: center;
        text-align: center;

        .detail-row {
          flex-direction: column;
          align-items: center;
        }
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
  @Input() currentTreatment: Treatment | null = null;  // Trattamento in corso
  @Input() loading = false;

  @Output() startTreatment = new EventEmitter<void>();
  @Output() completeTreatment = new EventEmitter<TreatmentCompletionData>();
  @Output() editTreatment = new EventEmitter<Treatment>();  // Modifica trattamento in corso
  @Output() finishTreatment = new EventEmitter<Treatment>(); // Completa trattamento (chiude)
  @Output() cancelTreatment = new EventEmitter<Treatment>(); // Annulla trattamento in corso
  @Output() viewPatientFolder = new EventEmitter<void>();
  // NOTA: cancelAppointment rimosso - richiede sistema notifiche (vedere Section 11 piano)
  @Output() deleteNonRetribuito = new EventEmitter<AvailabilityAppointment>(); // Elimina appuntamento non retribuito

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

  // NOTA: onCancelAppointment() rimosso - richiede sistema notifiche (vedere Section 11 piano)

  onEditTreatment(): void {
    if (this.currentTreatment) {
      this.editTreatment.emit(this.currentTreatment);
    }
  }

  onFinishTreatment(): void {
    if (this.currentTreatment) {
      this.finishTreatment.emit(this.currentTreatment);
    }
  }

  onCancelTreatment(): void {
    if (this.currentTreatment) {
      this.cancelTreatment.emit(this.currentTreatment);
    }
  }

  /**
   * Emette evento per eliminare appuntamento non retribuito
   * Layer 1: Presentational - delega al parent
   */
  onDeleteNonRetribuito(): void {
    if (this.appointment) {
      this.deleteNonRetribuito.emit(this.appointment);
    }
  }

  /**
   * Helper per appuntamenti non retribuiti
   * Layer 1: UI logic only
   */
  isNonRetribuito(): boolean {
    return this.appointment?.nonRetribuito === true;
  }

  // Metodi per stato trattamento (case-insensitive per compatibilità con GraphQL)
  hasTreatmentInProgress(): boolean {
    return this.currentTreatment !== null &&
           this.currentTreatment.status?.toLowerCase() === 'in_progress';
  }

  isTreatmentOperatorCompleted(): boolean {
    return this.currentTreatment !== null &&
           this.currentTreatment.status?.toLowerCase() === 'operator_completed';
  }

  isTreatmentClosed(): boolean {
    return this.currentTreatment !== null &&
           this.currentTreatment.status?.toLowerCase() === 'closed';
  }

  getTreatmentStatusLabel(): string {
    if (!this.currentTreatment) return '';
    return getTreatmentStatusLabel(this.currentTreatment.status);
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

  // === Appointment Details Helpers ===

  hasServices(): boolean {
    // DEBUG: Verificare se appointmentServices arriva dal backend
    console.log('[TreatmentCard] appointment:', this.appointment);
    console.log('[TreatmentCard] appointmentServices:', this.appointment?.appointmentServices);
    return !!(this.appointment?.appointmentServices?.length);
  }

  getServicesNames(): string {
    if (!this.appointment?.appointmentServices?.length) return '';
    return this.appointment.appointmentServices
      .map(as => as.service?.name || 'Servizio')
      .join(', ');
  }

  hasInstruments(): boolean {
    return !!(this.appointment?.instruments?.length);
  }

  getInstrumentsNames(): string {
    if (!this.appointment?.instruments?.length) return '';
    return this.appointment.instruments
      .map(i => i.instrument?.name || 'Strumento')
      .join(', ');
  }

  hasNotes(): boolean {
    return !!(this.appointment?.notes || this.appointment?.operatorNotes);
  }

  getAppointmentNotes(): string {
    const parts: string[] = [];
    if (this.appointment?.notes) {
      parts.push(this.appointment.notes);
    }
    if (this.appointment?.operatorNotes) {
      parts.push(`[Op: ${this.appointment.operatorNotes}]`);
    }
    return parts.join(' | ');
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

    const status = this.appointment.bookingStatus?.toUpperCase();
    switch (status) {
      case BookingStatus.Scheduled: return 'status-scheduled';
      case BookingStatus.Confirmed: return 'status-confirmed';
      case BookingStatus.Attended: return 'status-attended';
      case BookingStatus.NoShow: return 'status-noshow';
      case BookingStatus.Cancelled: return 'status-cancelled';
      default: return 'status-scheduled';
    }
  }

  getStatusIcon(): string {
    if (!this.appointment) return 'event';

    const status = this.appointment.bookingStatus?.toUpperCase();
    switch (status) {
      case BookingStatus.Scheduled: return 'event';
      case BookingStatus.Confirmed: return 'check_circle';
      case BookingStatus.Attended: return 'check_circle';
      case BookingStatus.NoShow: return 'person_off';
      case BookingStatus.Cancelled: return 'cancel';
      default: return 'event';
    }
  }

  getStatusLabel(): string {
    if (!this.appointment) return 'Programmato';

    const status = this.appointment.bookingStatus?.toUpperCase();
    switch (status) {
      case BookingStatus.Scheduled: return 'Programmato';
      case BookingStatus.Confirmed: return 'Confermato';
      case BookingStatus.Attended: return 'Presentato';
      case BookingStatus.NoShow: return 'Non presentato';
      case BookingStatus.Cancelled: return 'Annullato';
      default: return 'Programmato';
    }
  }

  canStartTreatment(): boolean {
    if (!this.appointment) return false;
    const status = this.appointment.bookingStatus?.toUpperCase();
    return status === BookingStatus.Scheduled ||
           status === BookingStatus.Confirmed ||
           status === BookingStatus.Attended;
  }

  isInProgress(): boolean {
    // Non esiste un vero stato "in progress" nel backend
    // Restituisce false perché gli appuntamenti passano direttamente da SCHEDULED/CONFIRMED a ATTENDED
    return false;
  }

  isCompleted(): boolean {
    const status = this.appointment?.bookingStatus?.toUpperCase();
    return status === BookingStatus.Attended;
  }

  isNoShow(): boolean {
    const status = this.appointment?.bookingStatus?.toUpperCase();
    return status === BookingStatus.NoShow;
  }

  isCancelled(): boolean {
    const status = this.appointment?.bookingStatus?.toUpperCase();
    return status === BookingStatus.Cancelled;
  }
}

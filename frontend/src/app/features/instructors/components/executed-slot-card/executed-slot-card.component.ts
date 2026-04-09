/**
 * Executed Slot Card Component
 * Layer 1: Dumb Component
 *
 * Responsabilita':
 * - Mostra una card per uno slot eseguito (passato)
 * - Lista pazienti dello slot con stato presenza e stato trattamento
 * - Per ogni paziente: pulsanti "Visualizza/Modifica" e "Riapri Trattamento"
 *   (riapri visibile solo se lo stato e' OPERATOR_COMPLETED)
 * - Pulsante header "Apri tutti i trattamenti dello slot"
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ExecutedSlotGroup, ExecutedPatientEntry } from '../../models/instructor-workspace.model';
import { Treatment, TreatmentStatus } from '../../../../models/treatment.model';

@Component({
  selector: 'app-executed-slot-card',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="slot-card">
      <!-- Header slot -->
      <div class="slot-header" [style.borderLeftColor]="slot.gymRoom.color || '#0d9488'">
        <div class="slot-meta">
          <mat-icon class="meta-icon">schedule</mat-icon>
          <span class="slot-time">{{ slot.startTime }} - {{ slot.endTime }}</span>
          <mat-icon class="meta-icon room-icon">fitness_center</mat-icon>
          <span class="slot-room">{{ slot.gymRoom.name }}</span>
          <span class="slot-count">
            {{ slot.patients.length }}/{{ slot.gymRoom.maxCapacity }} pazienti
          </span>
        </div>
        <button mat-stroked-button color="primary"
                class="open-all-btn"
                (click)="openSlot.emit(slot)"
                matTooltip="Apri il dialog con tutti i pazienti dello slot">
          <mat-icon>edit_note</mat-icon>
          <span class="btn-label">Apri trattamenti slot</span>
        </button>
      </div>

      <!-- Lista pazienti -->
      <div class="patients-list">
        @for (p of slot.patients; track p.appointment.id) {
          <div class="patient-row"
               [class.no-show]="!p.isAttended"
               [class.no-treatment]="p.isAttended && !p.treatment">
            <div class="patient-info">
              <div class="patient-name-row">
                <mat-icon class="patient-icon">person</mat-icon>
                <span class="patient-name">{{ p.patientName }}</span>
              </div>
              <div class="patient-badges">
                <!-- Booking status badge -->
                @if (p.isAttended) {
                  <span class="badge badge-attended">Presentato</span>
                } @else {
                  <span class="badge badge-no-show">Non presentato</span>
                }

                <!-- Treatment status badge -->
                @if (p.treatment) {
                  <span class="badge"
                        [class.badge-in-progress]="getStatus(p.treatment) === 'in_progress'"
                        [class.badge-completed]="getStatus(p.treatment) === 'operator_completed'"
                        [class.badge-closed]="getStatus(p.treatment) === 'closed'">
                    {{ getStatusLabel(p.treatment) }}
                  </span>
                } @else if (p.isAttended) {
                  <span class="badge badge-missing">Nessun trattamento</span>
                }
              </div>
            </div>

            <div class="patient-actions">
              <button mat-stroked-button
                      class="action-btn"
                      (click)="openPatient.emit(p)"
                      matTooltip="Visualizza o modifica il trattamento">
                <mat-icon>visibility</mat-icon>
                <span class="btn-label">Visualizza / Modifica</span>
              </button>

              @if (p.treatment && getStatus(p.treatment) === 'operator_completed') {
                <button mat-raised-button color="accent"
                        class="action-btn reopen-btn"
                        (click)="reopenPatient.emit(p)"
                        matTooltip="Riporta il trattamento allo stato 'In corso'">
                  <mat-icon>undo</mat-icon>
                  <span class="btn-label">Riapri trattamento</span>
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .slot-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      margin-bottom: 16px;
      overflow: hidden;
    }

    .slot-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      border-left: 4px solid #0d9488;
      flex-wrap: wrap;
      gap: 12px;
    }

    .slot-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .meta-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #64748b;
    }

    .room-icon {
      margin-left: 8px;
    }

    .slot-time {
      font-weight: 600;
      color: #334155;
      font-size: 0.95rem;
    }

    .slot-room {
      font-weight: 500;
      color: #15803d;
    }

    .slot-count {
      font-size: 0.8rem;
      color: #64748b;
      background: #e2e8f0;
      padding: 2px 8px;
      border-radius: 10px;
      margin-left: 8px;
    }

    .patients-list {
      display: flex;
      flex-direction: column;
    }

    .patient-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      gap: 12px;
      flex-wrap: wrap;
    }

    .patient-row:last-child {
      border-bottom: none;
    }

    .patient-row.no-show {
      background: #fef9f9;
    }

    .patient-row.no-treatment {
      background: #fffdf5;
    }

    .patient-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 200px;
    }

    .patient-name-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .patient-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #64748b;
    }

    .patient-name {
      font-weight: 600;
      color: #1e293b;
      font-size: 0.95rem;
    }

    .patient-badges {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-left: 24px;
    }

    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.72rem;
      font-weight: 500;
    }

    .badge-attended { background: #dcfce7; color: #15803d; }
    .badge-no-show { background: #fee2e2; color: #dc2626; }
    .badge-in-progress { background: #dbeafe; color: #1d4ed8; }
    .badge-completed { background: #fef3c7; color: #b45309; }
    .badge-closed { background: #d1fae5; color: #047857; }
    .badge-missing { background: #f1f5f9; color: #64748b; }

    .patient-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .action-btn {
      font-size: 0.8rem;
    }

    .reopen-btn {
      font-weight: 600;
    }

    .open-all-btn {
      font-size: 0.85rem;
    }

    @media (max-width: 599px) {
      .slot-header {
        flex-direction: column;
        align-items: stretch;
      }

      .open-all-btn {
        width: 100%;
      }

      .patient-row {
        flex-direction: column;
        align-items: stretch;
      }

      .patient-actions {
        justify-content: stretch;
      }

      .action-btn {
        flex: 1;
      }

      .btn-label {
        font-size: 0.75rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExecutedSlotCardComponent {
  @Input({ required: true }) slot!: ExecutedSlotGroup;

  @Output() openSlot = new EventEmitter<ExecutedSlotGroup>();
  @Output() openPatient = new EventEmitter<ExecutedPatientEntry>();
  @Output() reopenPatient = new EventEmitter<ExecutedPatientEntry>();

  getStatus(t: Treatment): TreatmentStatus {
    return (t.status?.toString().toLowerCase() as TreatmentStatus) || 'in_progress';
  }

  getStatusLabel(t: Treatment): string {
    const s = this.getStatus(t);
    switch (s) {
      case 'in_progress':
        return 'In corso';
      case 'operator_completed':
        return 'Completato';
      case 'closed':
        return 'Chiuso';
      default:
        return s;
    }
  }
}

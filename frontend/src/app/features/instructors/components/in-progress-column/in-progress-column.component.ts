/**
 * In Progress Column Component
 * Layer 1: Dumb Component
 *
 * Responsabilità:
 * - Visualizzare una colonna per un singolo paziente nella vista "In Corso"
 * - Mostrare stato ATTENDED / Non presentato
 * - Dropdown percorso terapeutico (auto-selezionato se uno solo)
 * - Bottoni: Inizia Trattamento, Segna non presentato, Apri Trattamento
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';

import { AvailabilityAppointment, BookingStatus } from '../../../../graphql/generated/types';
import { TherapeuticPath } from '../../../../models/therapeutic-path.model';
import { Treatment } from '../../../../models/treatment.model';

@Component({
  selector: 'app-in-progress-column',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
  ],
  template: `
    <div class="column-card" [class.not-attended]="!isAttended">
      <!-- Header paziente -->
      <div class="column-header" [class.attended]="isAttended" [class.no-show]="!isAttended">
        <div class="patient-name">{{ appointment.clientName }}</div>
        <div class="patient-status">
          @if (isAttended) {
            <span class="status-chip attended">Presentato</span>
          } @else {
            <span class="status-chip no-show">Non presentato</span>
          }
        </div>
      </div>

      <!-- Contenuto colonna -->
      <div class="column-body">
        @if (isAttended) {
          <!-- Selezione percorso terapeutico -->
          @if (!existingTreatment) {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Percorso Terapeutico</mat-label>
              <mat-select [(ngModel)]="selectedPathId">
                @for (path of activePaths; track path.id) {
                  <mat-option [value]="path.id">
                    {{ path.name }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <!-- Bottone Inizia Trattamento -->
            <button mat-raised-button color="primary" class="full-width"
                    [disabled]="!selectedPathId"
                    (click)="onStartTreatment()">
              <mat-icon>play_arrow</mat-icon>
              Inizia Trattamento
            </button>
          } @else {
            <!-- Trattamento esistente -->
            <div class="treatment-info">
              <mat-icon>assignment</mat-icon>
              <span>Trattamento {{ getTreatmentStatusLabel() }}</span>
            </div>
            <button mat-raised-button color="accent" class="full-width"
                    (click)="onOpenTreatment()">
              <mat-icon>edit</mat-icon>
              Apri Trattamento
            </button>
          }

          <!-- Bottone segna non presentato -->
          <button mat-stroked-button color="warn" class="full-width mark-btn"
                  (click)="onMarkNoShow()">
            <mat-icon>person_off</mat-icon>
            Segna non presentato
          </button>
        } @else {
          <!-- Paziente non presentato -->
          <div class="no-show-message">
            <mat-icon>person_off</mat-icon>
            <p>Paziente non presentato</p>
          </div>
          <button mat-raised-button color="primary" class="full-width"
                  (click)="onMarkAttended()">
            <mat-icon>person_add</mat-icon>
            Ripristina come presentato
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .column-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      min-width: 220px;
      max-width: 300px;
      flex: 1;
    }

    .column-card.not-attended {
      opacity: 0.7;
      background: #f9fafb;
    }

    .column-header {
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
    }

    .column-header.attended {
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
    }

    .column-header.no-show {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
    }

    .patient-name {
      font-weight: 600;
      font-size: 0.95rem;
      color: #1e293b;
    }

    .patient-status {
      margin-top: 4px;
    }

    .status-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.7rem;
      font-weight: 500;
    }

    .status-chip.attended {
      background: #dcfce7;
      color: #15803d;
    }

    .status-chip.no-show {
      background: #fee2e2;
      color: #dc2626;
    }

    .column-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .full-width {
      width: 100%;
    }

    .treatment-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #e0e7ff;
      border-radius: 6px;
      color: #4338ca;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .mark-btn {
      margin-top: 4px;
    }

    .no-show-message {
      text-align: center;
      padding: 16px;
      color: #94a3b8;

      mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
      }

      p {
        margin: 8px 0 0;
        font-size: 0.85rem;
      }
    }

    @media (max-width: 599px) {
      .column-card {
        min-width: 180px;
        max-width: 100%;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InProgressColumnComponent implements OnInit {
  @Input({ required: true }) appointment!: AvailabilityAppointment;
  @Input() activePaths: TherapeuticPath[] = [];
  @Input() existingTreatment: Treatment | null = null;
  @Input() isAttended = true;

  @Output() startTreatment = new EventEmitter<{ appointmentId: string; pathId: string }>();
  @Output() openTreatment = new EventEmitter<Treatment>();
  @Output() markNoShow = new EventEmitter<string>();
  @Output() markAttended = new EventEmitter<string>();

  selectedPathId: string | null = null;

  ngOnInit(): void {
    // Auto-seleziona se un solo percorso attivo
    if (this.activePaths.length === 1) {
      this.selectedPathId = this.activePaths[0].id;
    }
  }

  onStartTreatment(): void {
    if (this.selectedPathId) {
      this.startTreatment.emit({
        appointmentId: this.appointment.id,
        pathId: this.selectedPathId,
      });
    }
  }

  onOpenTreatment(): void {
    if (this.existingTreatment) {
      this.openTreatment.emit(this.existingTreatment);
    }
  }

  onMarkNoShow(): void {
    this.markNoShow.emit(this.appointment.id);
  }

  onMarkAttended(): void {
    this.markAttended.emit(this.appointment.id);
  }

  getTreatmentStatusLabel(): string {
    switch (this.existingTreatment?.status?.toLowerCase()) {
      case 'in_progress': return 'in corso';
      case 'operator_completed': return 'completato';
      case 'closed': return 'chiuso';
      default: return '';
    }
  }
}

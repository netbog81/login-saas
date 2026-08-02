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
            @if (activePaths.length > 0) {
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
              <!-- Nessun percorso terapeutico attivo -->
              <div class="no-path-warning">
                <mat-icon>warning</mat-icon>
                <span>Nessun percorso terapeutico attivo</span>
                <button mat-stroked-button color="primary" class="full-width"
                        (click)="onOpenPatientFolder()">
                  <mat-icon>folder_shared</mat-icon>
                  Apri Scheda Paziente
                </button>
              </div>
            }
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

          <!-- Ritardo: l'istruttore è chi vede davvero entrare il paziente,
               e col cambio automatico di stato l'appuntamento risulta già
               "presentato" all'orario previsto. -->
          @if (registeredLateMinutes !== null) {
            <div class="late-registered">
              <mat-icon>schedule</mat-icon>
              <span>Arrivato con {{ registeredLateMinutes }} min di ritardo</span>
            </div>
          } @else {
            <button mat-stroked-button class="full-width mark-btn late-btn"
                    (click)="onMarkLateArrival()">
              <mat-icon>schedule</mat-icon>
              Arrivato in ritardo
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

    /* Ritardo: informativo, distinto dal rosso del non presentato */
    .late-btn {
      color: #1565c0;
    }

    .late-registered {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      padding: 6px 8px;
      background: #e3f2fd;
      border-radius: 4px;
      color: #0d47a1;
      font-size: 12.5px;
    }

    .late-registered mat-icon {
      font-size: 17px;
      width: 17px;
      height: 17px;
    }

    .no-path-warning {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      text-align: center;
      color: #92400e;
      font-size: 0.8rem;
      font-weight: 500;

      mat-icon {
        color: #f59e0b;
        font-size: 24px;
        width: 24px;
        height: 24px;
      }

      button {
        margin-top: 4px;
      }
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
  @Output() markLateArrival = new EventEmitter<{ appointmentId: string; lateMinutes: number }>();
  @Output() openPatientFolder = new EventEmitter<string>();

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

  /** Minuti di ritardo già registrati sull'appuntamento. */
  get registeredLateMinutes(): number | null {
    return (this.appointment as any)?.lateMinutes ?? null;
  }

  onMarkLateArrival(): void {
    const suggested = this.minutesSinceStart();
    const answer = prompt(
      'Con quanti minuti di ritardo è arrivato il paziente?',
      String(suggested),
    );
    if (answer === null) return;

    const lateMinutes = Number(answer);
    if (!Number.isFinite(lateMinutes) || lateMinutes < 0) return;

    this.markLateArrival.emit({
      appointmentId: this.appointment.id,
      lateMinutes,
    });
  }

  /** Minuti trascorsi dall'orario di inizio: proposta di default. */
  private minutesSinceStart(): number {
    const start = new Date(`${this.appointment.appointmentDate}T${this.appointment.startTime}`);
    if (Number.isNaN(start.getTime())) return 0;
    return Math.max(0, Math.round((Date.now() - start.getTime()) / 60000));
  }

  onOpenPatientFolder(): void {
    const patientId = (this.appointment as any).patientId?.toString();
    if (patientId) {
      this.openPatientFolder.emit(patientId);
    }
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

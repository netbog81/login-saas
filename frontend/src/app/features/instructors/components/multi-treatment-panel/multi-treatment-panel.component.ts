/**
 * Multi Treatment Panel Component
 * Layer 1: Dumb Component
 *
 * Responsabilità:
 * - Singola colonna nel dialog multi-trattamento
 * - Form reattivo con campi: percorso, servizi, dolore, note, prezzo
 * - Header con nome paziente
 * - Bottone "Completa Trattamento" per singolo paziente
 * - Se paziente non presentato: mostra solo info stato + ripristino
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';

import { TherapeuticPath } from '../../../../models/therapeutic-path.model';
import { Treatment, CompleteTreatmentInput } from '../../../../models/treatment.model';
import { Service } from '../../../../graphql/generated/types';
import { TreatmentColumnState } from '../../models/instructor-workspace.model';

export interface PanelSaveResult {
  appointmentId: string;
  treatmentId: string;
  therapeuticPathId?: string;
  clinicalNotes?: string;
  secretaryNotes?: string;
  patientNotes?: string;
  price?: number;
  scontoFE?: boolean;
  painBefore?: number;
  painAfter?: number;
}

export interface PanelCompleteResult {
  treatmentId: string;
  formData: PanelSaveResult;
}

@Component({
  selector: 'app-multi-treatment-panel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  template: `
    <div class="panel" [class.not-attended]="!columnState.isAttended" [class.completed]="columnState.isCompleted">
      <!-- Header -->
      <div class="panel-header"
           [class.attended]="columnState.isAttended"
           [class.no-show]="!columnState.isAttended"
           [class.done]="columnState.isCompleted">
        <div class="patient-name">{{ columnState.patientName }}</div>
        <div class="patient-status">
          @if (columnState.isCompleted) {
            <span class="status-chip completed">Completato</span>
          } @else if (columnState.isAttended) {
            <span class="status-chip attended">Presentato</span>
          } @else {
            <span class="status-chip no-show">Non presentato</span>
          }
        </div>
      </div>

      <!-- Contenuto per paziente NON presentato -->
      @if (!columnState.isAttended) {
        <div class="panel-body no-show-body">
          <div class="no-show-message">
            <mat-icon>person_off</mat-icon>
            <p>Paziente non presentato</p>
          </div>
          <!-- Solo se l'impostazione «Permetti agli operatori di segnare i
               no show» e' attiva: altrimenti la correzione la fa la segreteria. -->
          @if (canMarkAttendance) {
            <button mat-raised-button color="primary" class="full-width"
                    (click)="markAttended.emit(columnState.appointment.id)">
              <mat-icon>person_add</mat-icon>
              Ripristina come presentato
            </button>
          }
        </div>
      }

      <!-- Avviso percorso terapeutico mancante -->
      @if (columnState.isAttended && columnState.activePaths.length === 0 && columnState.patientId) {
        <div class="no-path-warning">
          <mat-icon>warning</mat-icon>
          <span>Nessun percorso terapeutico attivo</span>
          <button mat-stroked-button color="primary" class="full-width"
                  (click)="openPatientFolder.emit(columnState.patientId)">
            <mat-icon>folder_shared</mat-icon>
            Apri Scheda Paziente
          </button>
        </div>
      }

      <!-- Contenuto per paziente presentato con trattamento -->
      @if (columnState.isAttended && columnState.treatment) {
        <div class="panel-body">
          @if (columnState.isCompleted) {
            <div class="completed-message">
              <mat-icon>check_circle</mat-icon>
              <span>Trattamento completato</span>
            </div>
          } @else {
            <form [formGroup]="form" class="treatment-form">
              <!-- Percorso Terapeutico -->
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Percorso Terapeutico</mat-label>
                <mat-select formControlName="therapeuticPathId">
                  @for (path of columnState.activePaths; track path.id) {
                    <mat-option [value]="path.id">{{ path.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <!-- Valutazione Dolore -->
              <div class="pain-section">
                <label class="section-label">Dolore Prima (VAS)</label>
                <mat-slider min="0" max="10" step="1" discrete>
                  <input matSliderThumb formControlName="painBefore">
                </mat-slider>
                <label class="section-label">Dolore Dopo (VAS)</label>
                <mat-slider min="0" max="10" step="1" discrete>
                  <input matSliderThumb formControlName="painAfter">
                </mat-slider>
              </div>

              <!-- Note Cliniche -->
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Note Cliniche</mat-label>
                <textarea matInput formControlName="clinicalNotes" rows="2"></textarea>
              </mat-form-field>

              <!-- Note Paziente -->
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Note Paziente</mat-label>
                <textarea matInput formControlName="patientNotes" rows="2"></textarea>
              </mat-form-field>

              <!-- Note Segreteria -->
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Note Segreteria</mat-label>
                <textarea matInput formControlName="secretaryNotes" rows="2"></textarea>
              </mat-form-field>

            </form>

            <mat-divider></mat-divider>

            <!-- Azioni -->
            <div class="panel-actions">
              <button mat-stroked-button class="full-width" (click)="onSave()"
                      [disabled]="isSaving">
                <mat-icon>save</mat-icon>
                Salva
              </button>
              <button mat-raised-button color="accent" class="full-width"
                      (click)="onComplete()"
                      [disabled]="isSaving">
                @if (isSaving) {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  <mat-icon>check_circle</mat-icon>
                }
                Completa Trattamento
              </button>
            </div>
          }
        </div>
      }

      <!-- Paziente presentato MA senza trattamento - permetti creazione retroattiva -->
      @if (columnState.isAttended && !columnState.treatment) {
        <div class="panel-body">
          <div class="no-treatment-message">
            <mat-icon>info</mat-icon>
            <p>Trattamento non ancora creato</p>
          </div>

          @if (columnState.activePaths.length > 0) {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Percorso Terapeutico</mat-label>
              <mat-select [(value)]="selectedPathIdForCreate">
                @for (path of columnState.activePaths; track path.id) {
                  <mat-option [value]="path.id">{{ path.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <button mat-raised-button color="primary" class="full-width"
                    [disabled]="!selectedPathIdForCreate || isSaving"
                    (click)="onCreateTreatment()">
              @if (isSaving) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                <mat-icon>play_arrow</mat-icon>
              }
              Crea Trattamento
            </button>
          } @else if (columnState.patientId) {
            <div class="no-path-warning">
              <mat-icon>warning</mat-icon>
              <span>Nessun percorso terapeutico attivo</span>
              <button mat-stroked-button color="primary" class="full-width"
                      (click)="openPatientFolder.emit(columnState.patientId)">
                <mat-icon>folder_shared</mat-icon>
                Apri Scheda Paziente
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .panel {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      min-width: 260px;
      max-width: 340px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .panel.not-attended {
      opacity: 0.7;
      background: #f9fafb;
    }

    .panel.completed {
      opacity: 0.85;
    }

    .panel-header {
      padding: 10px 14px;
      border-bottom: 1px solid #e2e8f0;
    }

    .panel-header.attended {
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
    }

    .panel-header.no-show {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
    }

    .panel-header.done {
      background: #e0e7ff;
      border-left: 4px solid #6366f1;
    }

    .patient-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: #1e293b;
    }

    .patient-status {
      margin-top: 2px;
    }

    .status-chip {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 10px;
      font-size: 0.7rem;
      font-weight: 500;
    }

    .status-chip.attended { background: #dcfce7; color: #15803d; }
    .status-chip.no-show { background: #fee2e2; color: #dc2626; }
    .status-chip.completed { background: #e0e7ff; color: #4338ca; }

    .panel-body {
      padding: 12px 14px;
      flex: 1;
      overflow-y: auto;
    }

    .no-show-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 24px 14px;
    }

    .no-path-warning {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #fffbeb;
      border-bottom: 1px solid #fde68a;
      text-align: center;
      color: #92400e;
      font-size: 0.8rem;
      font-weight: 500;

      mat-icon {
        color: #f59e0b;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      button {
        margin-top: 4px;
        font-size: 0.75rem;
      }
    }

    .no-show-message, .no-treatment-message {
      text-align: center;
      color: #94a3b8;
      padding: 16px 0;

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

    .completed-message {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: center;
      padding: 24px 0;
      color: #4338ca;
      font-weight: 500;

      mat-icon {
        color: #22c55e;
      }
    }

    .treatment-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .full-width {
      width: 100%;
    }

    .section-label {
      display: block;
      font-size: 0.75rem;
      color: #64748b;
      margin-bottom: 2px;
    }

    .pain-section {
      margin-bottom: 8px;
    }

    .panel-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 12px;
    }

    @media (max-width: 599px) {
      .panel {
        min-width: 220px;
        max-width: 100%;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiTreatmentPanelComponent implements OnInit {
  @Input({ required: true }) columnState!: TreatmentColumnState;
  @Input() isSaving = false;

  @Output() save = new EventEmitter<PanelSaveResult>();
  @Output() completeTreatment = new EventEmitter<PanelCompleteResult>();
  /** Vedi `InProgressColumnComponent.canMarkAttendance`. */
  @Input() canMarkAttendance = false;

  @Output() markAttended = new EventEmitter<string>();
  @Output() markNoShow = new EventEmitter<string>();
  @Output() openPatientFolder = new EventEmitter<string>();
  @Output() createTreatment = new EventEmitter<{ appointmentId: string; pathId: string }>();

  form!: FormGroup;
  selectedPathIdForCreate: string | null = null;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Auto-seleziona percorso se uno solo (per creazione retroattiva)
    if (!this.columnState.treatment && this.columnState.activePaths.length === 1) {
      this.selectedPathIdForCreate = this.columnState.activePaths[0].id;
    }

    const t = this.columnState.treatment;
    this.form = this.fb.group({
      therapeuticPathId: [t?.therapeuticPathId || ''],
      painBefore: [t?.painBefore ?? 0],
      painAfter: [t?.painAfter ?? 0],
      clinicalNotes: [t?.clinicalNotes || ''],
      secretaryNotes: [t?.secretaryNotes || ''],
      patientNotes: [t?.patientNotes || ''],
      price: [t?.price ?? 0],
      scontoFE: [t?.scontoFE ?? false],
    });
  }

  onSave(): void {
    const formVal = this.form.value;
    if (!formVal.therapeuticPathId) {
      alert('Selezionare un percorso terapeutico prima di salvare');
      return;
    }
    this.save.emit({
      appointmentId: this.columnState.appointment.id,
      treatmentId: this.columnState.treatment!.id,
      therapeuticPathId: formVal.therapeuticPathId,
      clinicalNotes: formVal.clinicalNotes,
      secretaryNotes: formVal.secretaryNotes,
      patientNotes: formVal.patientNotes,
      price: formVal.price,
      scontoFE: formVal.scontoFE,
      painBefore: formVal.painBefore,
      painAfter: formVal.painAfter,
    });
  }

  onComplete(): void {
    const formVal = this.form.value;
    if (!formVal.therapeuticPathId) {
      alert('Selezionare un percorso terapeutico prima di completare il trattamento');
      return;
    }
    const formData: PanelSaveResult = {
      appointmentId: this.columnState.appointment.id,
      treatmentId: this.columnState.treatment!.id,
      therapeuticPathId: formVal.therapeuticPathId,
      clinicalNotes: formVal.clinicalNotes,
      secretaryNotes: formVal.secretaryNotes,
      patientNotes: formVal.patientNotes,
      price: formVal.price,
      scontoFE: formVal.scontoFE,
      painBefore: formVal.painBefore,
      painAfter: formVal.painAfter,
    };
    this.completeTreatment.emit({
      treatmentId: this.columnState.treatment!.id,
      formData,
    });
  }

  onCreateTreatment(): void {
    if (this.selectedPathIdForCreate) {
      this.createTreatment.emit({
        appointmentId: this.columnState.appointment.id,
        pathId: this.selectedPathIdForCreate,
      });
    }
  }
}

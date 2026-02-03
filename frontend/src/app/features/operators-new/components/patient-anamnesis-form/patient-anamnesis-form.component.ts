/**
 * Patient Anamnesis Form Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Form per inserimento/modifica anamnesi paziente
 * - Campi: patologie pregresse, interventi chirurgici, traumi,
 *          terapia farmacologica, allergie, storia familiare, note
 * - Emette eventi save/cancel
 *
 * NOTA: Questo form è per la nuova anamnesi paziente semplice,
 * NON per la valutazione del percorso terapeutico (EvaluationForm)
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatChipInputEvent } from '@angular/material/chips';

import { PatientAnamnesis, createEmptyPatientAnamnesis } from '../../models/patient-anamnesis.model';

@Component({
  selector: 'app-patient-anamnesis-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDividerModule
  ],
  template: `
    <form [formGroup]="form" class="patient-anamnesis-form">
      <div class="form-header">
        <mat-icon>medical_information</mat-icon>
        <h3>{{ isEditMode ? 'Modifica Anamnesi' : 'Nuova Anamnesi' }}</h3>
      </div>

      <div class="form-content">
        <!-- Patologie pregresse -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Patologie Pregresse</mat-label>
          <textarea matInput
                    formControlName="patologiePregresse"
                    placeholder="Descrivi le patologie pregresse del paziente..."
                    rows="3"></textarea>
          <mat-icon matPrefix>healing</mat-icon>
          <mat-hint>Es: Diabete tipo 2, ipertensione arteriosa...</mat-hint>
        </mat-form-field>

        <!-- Interventi chirurgici -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Interventi Chirurgici</mat-label>
          <textarea matInput
                    formControlName="interventiChirurgici"
                    placeholder="Descrivi gli interventi chirurgici pregressi..."
                    rows="3"></textarea>
          <mat-icon matPrefix>local_hospital</mat-icon>
          <mat-hint>Es: Appendicectomia 2010, protesi anca dx 2018...</mat-hint>
        </mat-form-field>

        <!-- Traumi -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Traumi</mat-label>
          <textarea matInput
                    formControlName="traumi"
                    placeholder="Descrivi traumi rilevanti..."
                    rows="3"></textarea>
          <mat-icon matPrefix>personal_injury</mat-icon>
          <mat-hint>Es: Frattura femore sx 2015, distorsione caviglia dx...</mat-hint>
        </mat-form-field>

        <mat-divider></mat-divider>

        <!-- Terapia farmacologica (chips) -->
        <div class="chips-section">
          <label class="chips-label">
            <mat-icon>medication</mat-icon>
            Terapia Farmacologica
          </label>
          <mat-form-field appearance="outline" class="full-width">
            <mat-chip-grid #farmaciGrid>
              @for (farmaco of terapiaFarmacologica; track farmaco; let i = $index) {
                <mat-chip-row (removed)="removeFarmaco(i)">
                  {{ farmaco }}
                  <button matChipRemove>
                    <mat-icon>cancel</mat-icon>
                  </button>
                </mat-chip-row>
              }
            </mat-chip-grid>
            <input matInput
                   placeholder="Aggiungi farmaco..."
                   [matChipInputFor]="farmaciGrid"
                   [matChipInputSeparatorKeyCodes]="separatorKeyCodes"
                   (matChipInputTokenEnd)="addFarmaco($event)">
            <mat-hint>Premi INVIO o virgola per aggiungere</mat-hint>
          </mat-form-field>
        </div>

        <mat-divider></mat-divider>

        <!-- Allergie (campo importante con warning style) -->
        <mat-form-field appearance="outline" class="full-width warning-field">
          <mat-label>Allergie</mat-label>
          <textarea matInput
                    formControlName="allergie"
                    placeholder="Descrivi allergie note..."
                    rows="2"></textarea>
          <mat-icon matPrefix color="warn">warning</mat-icon>
          <mat-hint>Farmaci, alimenti, lattice, metalli, altre sostanze...</mat-hint>
        </mat-form-field>

        <!-- Storia familiare -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Storia Familiare</mat-label>
          <textarea matInput
                    formControlName="storiaFamiliare"
                    placeholder="Descrivi anamnesi familiare rilevante..."
                    rows="3"></textarea>
          <mat-icon matPrefix>family_restroom</mat-icon>
          <mat-hint>Es: Padre diabetico, madre ipertesa, familiarità oncologica...</mat-hint>
        </mat-form-field>

        <mat-divider></mat-divider>

        <!-- Note -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Note</mat-label>
          <textarea matInput
                    formControlName="note"
                    placeholder="Altre note rilevanti..."
                    rows="3"></textarea>
          <mat-icon matPrefix>notes</mat-icon>
        </mat-form-field>
      </div>

      <!-- Actions -->
      <div class="form-actions">
        <button mat-button type="button" (click)="onCancel()" [disabled]="saving">
          Annulla
        </button>
        <button mat-flat-button
                color="primary"
                type="submit"
                (click)="onSave()"
                [disabled]="saving || !form.valid">
          @if (saving) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            <mat-icon>save</mat-icon>
            Salva
          }
        </button>
      </div>
    </form>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .patient-anamnesis-form {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: white;
    }

    .form-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 12px 12px 0 0;

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }
    }

    .form-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 0;  /* Permette shrink in flex container */

      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 3px;
      }

      &::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;

        &:hover {
          background: #94a3b8;
        }
      }
    }

    .full-width {
      width: 100%;
    }

    mat-form-field {
      ::ng-deep {
        .mat-mdc-form-field-icon-prefix {
          padding-right: 8px;
          color: #64748b;
          border: none;
        }
      }
    }

    .warning-field {
      ::ng-deep {
        .mat-mdc-form-field-icon-prefix {
          color: #f59e0b !important;
        }

        .mdc-notched-outline__leading,
        .mdc-notched-outline__notch,
        .mdc-notched-outline__trailing {
          border-color: #fcd34d !important;
        }
      }
    }

    mat-divider {
      margin: 8px 0;
    }

    .chips-section {
      margin-bottom: 8px;
    }

    .chips-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #334155;
      margin-bottom: 8px;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #667eea;
      }
    }

    mat-chip-row {
      background: #eef2ff !important;
      color: #4338ca !important;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      border-radius: 0 0 12px 12px;
      flex-shrink: 0;  /* Non si comprime mai */

      button {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    /* Responsive */
    @media (max-width: 599px) {
      .form-content {
        padding: 16px;
      }

      .form-actions {
        padding: 12px 16px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientAnamnesisFormComponent implements OnInit, OnChanges {
  @Input() anamnesis: PatientAnamnesis | null = null;
  @Input() patientId: number = 0;
  @Input() saving = false;

  @Output() save = new EventEmitter<Partial<PatientAnamnesis>>();
  @Output() cancel = new EventEmitter<void>();

  form!: FormGroup;
  terapiaFarmacologica: string[] = [];
  readonly separatorKeyCodes = [ENTER, COMMA] as const;

  get isEditMode(): boolean {
    return !!this.anamnesis?.id;
  }

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['anamnesis'] && this.form) {
      this.populateForm();
    }
  }

  private initForm(): void {
    this.form = this.fb.group({
      patologiePregresse: [''],
      interventiChirurgici: [''],
      traumi: [''],
      allergie: [''],
      storiaFamiliare: [''],
      note: ['']
    });
    this.populateForm();
  }

  private populateForm(): void {
    if (this.anamnesis) {
      this.form.patchValue({
        patologiePregresse: this.anamnesis.patologiePregresse || '',
        interventiChirurgici: this.anamnesis.interventiChirurgici || '',
        traumi: this.anamnesis.traumi || '',
        allergie: this.anamnesis.allergie || '',
        storiaFamiliare: this.anamnesis.storiaFamiliare || '',
        note: this.anamnesis.note || ''
      });
      this.terapiaFarmacologica = [...(this.anamnesis.terapiaFarmacologica || [])];
    } else {
      this.form.reset();
      this.terapiaFarmacologica = [];
    }
  }

  addFarmaco(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (value && !this.terapiaFarmacologica.includes(value)) {
      this.terapiaFarmacologica.push(value);
      this.cdr.markForCheck();
    }
    event.chipInput!.clear();
  }

  removeFarmaco(index: number): void {
    this.terapiaFarmacologica.splice(index, 1);
    this.cdr.markForCheck();
  }

  onSave(): void {
    if (this.form.valid) {
      const formValue = this.form.value;
      const data: Partial<PatientAnamnesis> = {
        patologiePregresse: formValue.patologiePregresse || null,
        interventiChirurgici: formValue.interventiChirurgici || null,
        traumi: formValue.traumi || null,
        terapiaFarmacologica: this.terapiaFarmacologica,
        allergie: formValue.allergie || null,
        storiaFamiliare: formValue.storiaFamiliare || null,
        note: formValue.note || null
      };

      if (this.anamnesis?.id) {
        data.id = this.anamnesis.id;
      }

      this.save.emit(data);
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}

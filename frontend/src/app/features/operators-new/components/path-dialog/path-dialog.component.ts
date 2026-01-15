/**
 * Path Dialog Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare form per creazione/modifica percorso terapeutico
 * - Gestire validazione form con Reactive Forms
 * - Emettere eventi save/cancel
 * - NON gestisce logica business, NON chiama services
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';

import { Operator } from '../../../../graphql/generated/types';
import {
  PathDialogData,
  PathDialogFormResult,
  PATH_STATUS_OPTIONS,
  PathStatusOption
} from '../../models/path-dialog.model';

@Component({
  selector: 'app-path-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule
  ],
  template: `
    <div class="dialog-overlay"
         (mousedown)="onOverlayMouseDown($event)"
         (click)="onOverlayClick($event)">
      <div class="dialog-container" (click)="$event.stopPropagation()" (mousedown)="$event.stopPropagation()">
        <!-- Header -->
        <div class="dialog-header">
          <h2>{{ isEditMode ? 'Modifica Percorso' : 'Nuovo Percorso Terapeutico' }}</h2>
          <button mat-icon-button (click)="onCancel()" [disabled]="saving">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <!-- Content -->
        <div class="dialog-content">
          <form [formGroup]="form">
            <!-- Operatore Responsabile -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Operatore Responsabile *</mat-label>
              <mat-select formControlName="primaryOperatorId">
                @for (operator of operators; track operator.id) {
                  <mat-option [value]="operator.id">
                    {{ operator.name }} {{ operator.surname }}
                  </mat-option>
                }
              </mat-select>
              @if (loadingOperators) {
                <mat-hint>Caricamento operatori...</mat-hint>
              }
              @if (form.get('primaryOperatorId')?.hasError('required') && form.get('primaryOperatorId')?.touched) {
                <mat-error>Campo obbligatorio</mat-error>
              }
            </mat-form-field>

            <!-- Nome Percorso -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nome Percorso *</mat-label>
              <input matInput formControlName="name" placeholder="Es: Cervicalgia, Lombalgia cronica...">
              @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
                <mat-error>Campo obbligatorio</mat-error>
              }
            </mat-form-field>

            <!-- Diagnosi -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Diagnosi</mat-label>
              <textarea matInput formControlName="diagnosis" rows="2"
                placeholder="Descrizione della diagnosi..."></textarea>
            </mat-form-field>

            <!-- Codice ICD -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Codice ICD</mat-label>
              <input matInput formControlName="icdCode" placeholder="Es: M54.2">
            </mat-form-field>

            <!-- Sezione Prescrizione Esterna -->
            <div class="section-divider">
              <mat-divider></mat-divider>
              <span class="section-title">Prescrizione Esterna (opzionale)</span>
            </div>

            <div class="form-row">
              <!-- Medico Prescrittore -->
              <mat-form-field appearance="outline" class="half-width">
                <mat-label>Medico Prescrittore</mat-label>
                <input matInput formControlName="externalDoctorName" placeholder="Nome del medico">
              </mat-form-field>

              <!-- Riferimento Prescrizione -->
              <mat-form-field appearance="outline" class="half-width">
                <mat-label>Riferimento Prescrizione</mat-label>
                <input matInput formControlName="externalPrescriptionRef" placeholder="N. prescrizione">
              </mat-form-field>
            </div>

            <!-- Status (solo in edit mode) -->
            @if (isEditMode) {
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Stato Percorso</mat-label>
                <mat-select formControlName="status">
                  @for (option of statusOptions; track option.value) {
                    <mat-option [value]="option.value">{{ option.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }

            <!-- Note -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Note</mat-label>
              <textarea matInput formControlName="notes" rows="3"
                placeholder="Note aggiuntive sul percorso..."></textarea>
            </mat-form-field>
          </form>
        </div>

        <!-- Footer -->
        <div class="dialog-footer">
          <button mat-stroked-button (click)="onCancel()" [disabled]="saving">
            Annulla
          </button>
          <button mat-flat-button color="primary"
            (click)="onSubmit()"
            [disabled]="form.invalid || saving || loadingOperators">
            @if (saving) {
              <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
              <span>Salvataggio...</span>
            } @else {
              <mat-icon>{{ isEditMode ? 'save' : 'add' }}</mat-icon>
              <span>{{ isEditMode ? 'Salva Modifiche' : 'Crea Percorso' }}</span>
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .dialog-container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
      width: 100%;
      max-width: 560px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px 16px 0 0;

      h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: white;
      }

      button {
        color: white;
      }
    }

    .dialog-content {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }

    .full-width {
      width: 100%;
      margin-bottom: 8px;
    }

    .half-width {
      width: calc(50% - 8px);
    }

    .form-row {
      display: flex;
      gap: 16px;
      margin-bottom: 8px;
    }

    .section-divider {
      position: relative;
      margin: 16px 0 24px;
      text-align: center;

      mat-divider {
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
      }

      .section-title {
        position: relative;
        background: white;
        padding: 0 12px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 0 0 16px 16px;

      button {
        min-width: 140px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
    }

    .button-spinner {
      display: inline-block;
    }

    /* Fix per mat-form-field outline */
    ::ng-deep {
      .mat-mdc-form-field-subscript-wrapper {
        margin-bottom: 8px;
      }

      /* Fix linea verticale nel notched outline */
      .mdc-notched-outline__notch {
        border-left: none !important;
        border-right: none !important;
      }
    }

    /* Responsive */
    @media (max-width: 599px) {
      .dialog-container {
        max-width: calc(100% - 32px);
        max-height: calc(100vh - 32px);
        margin: 16px;
      }

      .form-row {
        flex-direction: column;
        gap: 0;
      }

      .half-width {
        width: 100%;
      }

      .dialog-footer {
        flex-direction: column-reverse;

        button {
          width: 100%;
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PathDialogComponent implements OnInit, OnChanges {
  @Input() data!: PathDialogData;
  @Input() operators: Operator[] = [];
  @Input() loadingOperators = false;
  @Input() saving = false;

  @Output() save = new EventEmitter<PathDialogFormResult>();
  @Output() cancel = new EventEmitter<void>();

  form!: FormGroup;
  statusOptions: PathStatusOption[] = PATH_STATUS_OPTIONS;

  // Overlay click tracking (per evitare chiusura durante click-and-drag)
  overlayMouseDownTarget: EventTarget | null = null;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && !changes['data'].firstChange) {
      this.initForm();
    }
  }

  get isEditMode(): boolean {
    return this.data?.mode === 'edit';
  }

  private initForm(): void {
    const path = this.data?.path;

    this.form = this.fb.group({
      primaryOperatorId: [
        path?.primaryOperatorId || this.data?.currentOperatorId || '',
        Validators.required
      ],
      name: [path?.name || '', Validators.required],
      diagnosis: [path?.diagnosis || ''],
      icdCode: [path?.icdCode || ''],
      externalDoctorName: [(path as any)?.externalDoctorName || ''],
      externalPrescriptionRef: [(path as any)?.externalPrescriptionRef || ''],
      notes: [path?.notes || ''],
      status: [path?.status || 'active']
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.value;
    const result: PathDialogFormResult = {
      primaryOperatorId: formValue.primaryOperatorId,
      name: formValue.name.trim(),
      diagnosis: formValue.diagnosis?.trim() || undefined,
      icdCode: formValue.icdCode?.trim() || undefined,
      externalDoctorName: formValue.externalDoctorName?.trim() || undefined,
      externalPrescriptionRef: formValue.externalPrescriptionRef?.trim() || undefined,
      notes: formValue.notes?.trim() || undefined
    };

    // Includi status solo in edit mode
    if (this.isEditMode) {
      result.status = formValue.status;
    }

    this.save.emit(result);
  }

  onCancel(): void {
    if (!this.saving) {
      this.cancel.emit();
    }
  }

  onOverlayMouseDown(event: MouseEvent): void {
    this.overlayMouseDownTarget = event.target;
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.overlayMouseDownTarget === event.currentTarget &&
        event.target === event.currentTarget) {
      this.onCancel();
    }
    this.overlayMouseDownTarget = null;
  }
}

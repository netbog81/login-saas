/**
 * Evaluation Form Container
 * Layer 2: Smart Component - Gestione Form Valutazione
 *
 * Responsabilità:
 * - Gestione stato del form
 * - Prepara dati paziente per auto-fill
 * - Gestisce salvataggio (GraphQL)
 * - Apre come dialog da patient-folder
 *
 * NOTA: Rinominato da anamnesis-form.container.ts
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';

// Angular Material
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// Components - usa ancora il vecchio nome per ora (TODO: rinominare)
import { AnamnesisFormComponent } from '../components/anamnesis-form/anamnesis-form.component';

// Models
import { EvaluationComplete } from '../models/evaluation.model';
import { Patient } from '../../../models/patient.model';
import { TherapeuticPath } from '../../../models/therapeutic-path.model';

// Services
import { PatientEvaluationService } from '../../../services/patient-evaluation.service';

export interface EvaluationFormDialogData {
  mode: 'create' | 'edit';
  patient: Patient;
  path: TherapeuticPath;
  evaluation?: EvaluationComplete | null;
}

@Component({
  selector: 'app-evaluation-form-container',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    AnamnesisFormComponent
  ],
  template: `
    <div class="evaluation-form-dialog">
      <!-- Header -->
      <div class="dialog-header">
        <div class="header-title">
          <mat-icon>{{ mode === 'create' ? 'add_circle' : 'edit' }}</mat-icon>
          <h2>{{ mode === 'create' ? 'Compila Valutazione' : 'Modifica Valutazione' }}</h2>
        </div>
        <div class="header-info">
          <span class="patient-name">{{ patient?.nome }} {{ patient?.cognome }}</span>
          <span class="path-name">{{ path?.name }}</span>
        </div>
        <button mat-icon-button (click)="onClose()" [disabled]="saving">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Content -->
      <div class="dialog-content">
        <app-anamnesis-form
          #evaluationForm
          [anamnesis]="evaluation"
          [patient]="patient"
          [pathId]="path?.id || ''"
          (save)="onSave($event)"
          (cancel)="onClose()">
        </app-anamnesis-form>
      </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <button mat-button (click)="onClose()" [disabled]="saving">
          Annulla
        </button>
        <button
          mat-flat-button
          color="primary"
          (click)="onSaveClick()"
          [disabled]="saving">
          @if (saving) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            <mat-icon>save</mat-icon>
            {{ mode === 'create' ? 'Salva Valutazione' : 'Salva Modifiche' }}
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .evaluation-form-dialog {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 90vh;
      width: 100%;
      max-width: 900px;
      background: white;
      border-radius: 16px;
      overflow: hidden;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;

      .header-title {
        display: flex;
        align-items: center;
        gap: 8px;

        mat-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
        }

        h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }
      }

      .header-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;

        .patient-name {
          font-weight: 500;
          font-size: 0.9375rem;
        }

        .path-name {
          font-size: 0.8125rem;
          opacity: 0.9;
        }
      }

      button {
        color: white;

        &:disabled {
          opacity: 0.5;
        }
      }
    }

    .dialog-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;

      button {
        display: flex;
        align-items: center;
        gap: 8px;

        mat-spinner {
          margin-right: 4px;
        }
      }
    }

    /* Responsive */
    @media (max-width: 767px) {
      .evaluation-form-dialog {
        max-height: 100vh;
        max-width: 100%;
        border-radius: 0;
      }

      .dialog-header {
        padding: 12px 16px;

        .header-title h2 {
          font-size: 1rem;
        }

        .header-info {
          display: none;
        }
      }

      .dialog-content {
        padding: 16px;
      }

      .dialog-footer {
        padding: 12px 16px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EvaluationFormContainer {
  @ViewChild('evaluationForm') evaluationFormRef!: AnamnesisFormComponent;

  @Input() mode: 'create' | 'edit' = 'create';
  @Input() patient: Patient | null = null;
  @Input() path: TherapeuticPath | null = null;
  @Input() evaluation: EvaluationComplete | null = null;
  @Input() operatorId: string = '';

  @Output() saved = new EventEmitter<EvaluationComplete>();
  @Output() close = new EventEmitter<void>();

  saving = false;

  constructor(
    private snackBar: MatSnackBar,
    private evaluationService: PatientEvaluationService,
    private cdr: ChangeDetectorRef
  ) {}

  onSaveClick(): void {
    if (this.evaluationFormRef) {
      const formValue = this.evaluationFormRef.getFormValue();
      this.onSave(formValue);
    }
  }

  onSave(evaluation: EvaluationComplete): void {
    if (!this.path?.id) {
      this.snackBar.open('Errore: Percorso terapeutico non selezionato', 'OK', { duration: 3000 });
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    // Prepara info paziente per il mapping response
    const patientInfo = this.patient ? {
      nome: this.patient.nome || '',
      cognome: this.patient.cognome || '',
      eta: this.patient.dataNascita ? this.calculateAge(this.patient.dataNascita) : null,
      sesso: this.patient.genere || null
    } : undefined;

    // Converti valutazione frontend in input backend
    const input = this.evaluationService.mapFrontendToInput(evaluation);

    // Sovrascrivi operatorId e pathId per la creazione
    input.operatorId = this.operatorId;
    input.therapeuticPathId = this.path.id;

    if (this.mode === 'create') {
      // Crea nuova valutazione
      this.evaluationService.createEvaluation(input, patientInfo)
        .subscribe({
          next: (savedEvaluation) => {
            this.saving = false;
            this.saved.emit(savedEvaluation);
            this.snackBar.open('Valutazione salvata con successo', 'OK', { duration: 3000 });
            this.close.emit();
            this.cdr.markForCheck();
          },
          error: (err) => {
            console.error('[EvaluationFormContainer] Error creating evaluation:', err);
            this.saving = false;
            this.snackBar.open('Errore durante il salvataggio della valutazione', 'OK', { duration: 3000 });
            this.cdr.markForCheck();
          }
        });
    } else {
      // Aggiorna valutazione esistente
      if (!this.evaluation?.id) {
        this.snackBar.open('Errore: Valutazione non trovata', 'OK', { duration: 3000 });
        this.saving = false;
        this.cdr.markForCheck();
        return;
      }

      // Rimuovi campi non aggiornabili dall'input
      const { therapeuticPathId, operatorId, ...updateInput } = input;

      this.evaluationService.updateEvaluation(this.evaluation.id, updateInput, patientInfo)
        .subscribe({
          next: (updatedEvaluation) => {
            this.saving = false;
            this.saved.emit(updatedEvaluation);
            this.snackBar.open('Valutazione aggiornata con successo', 'OK', { duration: 3000 });
            this.close.emit();
            this.cdr.markForCheck();
          },
          error: (err) => {
            console.error('[EvaluationFormContainer] Error updating evaluation:', err);
            this.saving = false;
            this.snackBar.open('Errore durante l\'aggiornamento della valutazione', 'OK', { duration: 3000 });
            this.cdr.markForCheck();
          }
        });
    }
  }

  /**
   * Calcola l'età dalla data di nascita
   */
  private calculateAge(birthDate: string | Date): number {
    const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  onClose(): void {
    if (this.saving) return;
    this.close.emit();
  }
}

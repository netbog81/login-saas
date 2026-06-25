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
  HostListener,
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

// Angular CDK — drag del dialog
import { DragDropModule } from '@angular/cdk/drag-drop';

// Components - usa ancora il vecchio nome per ora (TODO: rinominare)
import { AnamnesisFormComponent } from '../components/anamnesis-form/anamnesis-form.component';

// RxJS
import { Observable, of, throwError } from 'rxjs';
import { switchMap, finalize } from 'rxjs/operators';

// Models
import { EvaluationComplete } from '../models/evaluation.model';
import { PatientAnamnesis } from '../models/patient-anamnesis.model';
import { Patient } from '../../../models/patient.model';
import { TherapeuticPath } from '../../../models/therapeutic-path.model';
import { UpdatePatientAnamnesisInput } from '../models/patient-anamnesis.model';

// Services
import {
  PatientEvaluationService,
  CreateEvaluationInput,
} from '../../../services/patient-evaluation.service';
import {
  TherapeuticPathService,
  CreateTherapeuticPathInput,
  UpdateTherapeuticPathInput,
} from '../../../services/therapeutic-path.service';
import { SimplePatientAnamnesisService } from '../../../services/simple-patient-anamnesis.service';

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
    DragDropModule,
    AnamnesisFormComponent
  ],
  template: `
    <div class="evaluation-form-dialog" cdkDrag cdkDragBoundary=".dialog-overlay">
      <!-- Header (handle per il drag) -->
      <div class="dialog-header" cdkDragHandle>
        <div class="header-title">
          <mat-icon class="drag-indicator">drag_indicator</mat-icon>
          <mat-icon>{{ mode === 'create' ? 'add_circle' : 'edit' }}</mat-icon>
          <h2>{{ mode === 'create' ? 'Nuova Valutazione' : 'Modifica Valutazione' }}</h2>
        </div>
        <div class="header-info">
          <span class="patient-name">{{ patient?.nome }} {{ patient?.cognome }}</span>
          @if (mode === 'edit' && path?.name) {
            <span class="path-name">{{ path?.name }}</span>
          }
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
          [patientAnamnesis]="patientAnamnesis"
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

    /* Quando si trascina, il dialog resta sopra tutto e segue il cursore */
    .evaluation-form-dialog.cdk-drag-dragging {
      cursor: grabbing;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      cursor: move;        /* indica che la barra è trascinabile */
      user-select: none;

      .drag-indicator {
        opacity: 0.6;
        cursor: grab;
      }

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
  /** In edit è il percorso esistente; in create è null (lo crea il modulo). */
  @Input() path: TherapeuticPath | null = null;
  @Input() evaluation: EvaluationComplete | null = null;
  /** Anamnesi remota esistente del paziente (per pre-compilare il form). */
  @Input() patientAnamnesis: PatientAnamnesis | null = null;
  @Input() operatorId: string = '';

  @Output() saved = new EventEmitter<EvaluationComplete>();
  /** Emesso quando il percorso viene creato o aggiornato dal modulo unificato. */
  @Output() pathSaved = new EventEmitter<TherapeuticPath>();
  /** Emesso quando l'anamnesi remota viene salvata. */
  @Output() anamnesisSaved = new EventEmitter<PatientAnamnesis>();
  @Output() close = new EventEmitter<void>();

  saving = false;

  constructor(
    private snackBar: MatSnackBar,
    private evaluationService: PatientEvaluationService,
    private pathService: TherapeuticPathService,
    private anamnesisService: SimplePatientAnamnesisService,
    private cdr: ChangeDetectorRef
  ) {}

  onSaveClick(): void {
    if (!this.evaluationFormRef) return;
    if (!this.evaluationFormRef.isValid()) {
      this.evaluationFormRef.form.markAllAsTouched();
      this.snackBar.open('Compila i campi obbligatori (es. nome percorso)', 'OK', { duration: 3000 });
      return;
    }
    this.onSave(this.evaluationFormRef.getFormValue());
  }

  /**
   * Salvataggio del modulo unificato. Orchestra in sequenza:
   *  1. percorso terapeutico (create o update, dai campi pathInfo)
   *  2. valutazione (create o update, sul percorso del passo 1)
   *  3. anamnesi remota del paziente (upsert, dai campi remoteHistory)
   * Ogni passo dipende dal precedente per l'id del percorso.
   */
  onSave(evaluation: EvaluationComplete): void {
    if (!this.patient?.id) {
      this.snackBar.open('Errore: paziente non selezionato', 'OK', { duration: 3000 });
      return;
    }
    if (!evaluation.pathInfo?.nome?.trim()) {
      this.snackBar.open('Il nome del percorso è obbligatorio', 'OK', { duration: 3000 });
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    const patientInfo = {
      nome: this.patient.nome || '',
      cognome: this.patient.cognome || '',
      eta: this.patient.dataNascita ? this.calculateAge(this.patient.dataNascita) : null,
      sesso: this.patient.genere || null,
    };

    // STEP 1 → percorso. Ritorna il TherapeuticPath salvato.
    this.savePath$(evaluation)
      .pipe(
        // STEP 2 → valutazione sul percorso ottenuto
        switchMap((savedPath) => {
          this.pathSaved.emit(savedPath);

          const input = this.evaluationService.mapFrontendToInput(evaluation);
          input.operatorId = this.operatorId;
          input.therapeuticPathId = savedPath.id;

          const eval$ = this.mode === 'edit' && this.evaluation?.id
            ? this.updateEvaluation$(this.evaluation.id, input, patientInfo)
            : this.evaluationService.createEvaluation(input, patientInfo);

          return eval$.pipe(
            // STEP 3 → upsert anamnesi remota (non blocca se vuota)
            switchMap((savedEvaluation) =>
              this.saveRemoteAnamnesis$(evaluation).pipe(
                switchMap((savedAnamnesis) => {
                  if (savedAnamnesis) this.anamnesisSaved.emit(savedAnamnesis);
                  return of(savedEvaluation);
                })
              )
            )
          );
        }),
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (savedEvaluation) => {
          this.saved.emit(savedEvaluation);
          this.snackBar.open(
            this.mode === 'create' ? 'Valutazione creata con successo' : 'Valutazione aggiornata con successo',
            'OK',
            { duration: 3000 }
          );
          this.close.emit();
        },
        error: (err) => {
          console.error('[EvaluationFormContainer] Error saving unified evaluation:', err);
          this.snackBar.open('Errore durante il salvataggio', 'OK', { duration: 4000 });
        },
      });
  }

  /**
   * Crea o aggiorna il percorso terapeutico dai campi pathInfo del form.
   * Criterio: se è stato passato un percorso esistente (`this.path`), la
   * valutazione vi è agganciata e il percorso viene solo aggiornato — mai
   * crearne uno nuovo. Si crea un nuovo percorso solo dal flusso "Nuova
   * Valutazione" dell'header, dove `this.path` è null.
   */
  private savePath$(evaluation: EvaluationComplete): Observable<TherapeuticPath> {
    const pathInfo = evaluation.pathInfo;

    if (this.path?.id) {
      const input: UpdateTherapeuticPathInput = {
        name: pathInfo.nome,
        diagnosis: pathInfo.diagnosi ?? undefined,
        notes: pathInfo.note ?? undefined,
      };
      return this.pathService.updatePath(this.path.id, input);
    }

    if (!this.operatorId) {
      return throwError(() => new Error('Operatore non determinato per la creazione del percorso'));
    }
    const input: CreateTherapeuticPathInput = {
      patientId: this.patient!.id,
      primaryOperatorId: this.operatorId,
      name: pathInfo.nome,
      diagnosis: pathInfo.diagnosi ?? undefined,
      notes: pathInfo.note ?? undefined,
    };
    return this.pathService.createPath(input);
  }

  private updateEvaluation$(
    id: string,
    input: CreateEvaluationInput,
    patientInfo: { nome: string; cognome: string; eta: number | null; sesso: string | null }
  ): Observable<EvaluationComplete> {
    const { therapeuticPathId, operatorId, ...updateInput } = input;
    return this.evaluationService.updateEvaluation(id, updateInput, patientInfo);
  }

  /**
   * Upsert dell'anamnesi remota del paziente dai campi remoteHistory.
   * Ritorna null (senza chiamare il backend) se la sezione è interamente vuota.
   */
  private saveRemoteAnamnesis$(evaluation: EvaluationComplete): Observable<PatientAnamnesis | null> {
    const r = evaluation.remoteHistory;
    const isEmpty =
      !r.patologiePregresse &&
      !r.interventiChirurgici &&
      !r.traumi &&
      (!r.terapiaFarmacologica || r.terapiaFarmacologica.length === 0) &&
      !r.note;
    if (isEmpty) {
      return of(null);
    }

    const input: UpdatePatientAnamnesisInput = {
      operatorId: this.operatorId || undefined,
      patologiePregresse: r.patologiePregresse ?? undefined,
      interventiChirurgici: r.interventiChirurgici ?? undefined,
      traumi: r.traumi ?? undefined,
      terapiaFarmacologica: r.terapiaFarmacologica,
      note: r.note ?? undefined,
    };
    return this.anamnesisService.upsertAnamnesis(this.patient!.id, input);
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

  /** ESC chiude il dialog come il tasto Annulla (se non si sta salvando). */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.onClose();
  }
}

/**
 * Anamnesis Form Container
 * Layer 2: Smart Component - Gestione Form Anamnesi
 *
 * Responsabilità:
 * - Gestione stato del form
 * - Prepara dati paziente per auto-fill
 * - Gestisce salvataggio (mock per ora, poi GraphQL)
 * - Apre come dialog da patient-folder
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

// Components
import { AnamnesisFormComponent } from '../components/anamnesis-form/anamnesis-form.component';

// Models
import { AnamnesisComplete } from '../models/anamnesis.model';
import { Patient } from '../../../models/patient.model';
import { TherapeuticPath } from '../../../models/therapeutic-path.model';

export interface AnamnesisFormDialogData {
  mode: 'create' | 'edit';
  patient: Patient;
  path: TherapeuticPath;
  anamnesis?: AnamnesisComplete | null;
}

@Component({
  selector: 'app-anamnesis-form-container',
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
    <div class="anamnesis-form-dialog">
      <!-- Header -->
      <div class="dialog-header">
        <div class="header-title">
          <mat-icon>{{ mode === 'create' ? 'add_circle' : 'edit' }}</mat-icon>
          <h2>{{ mode === 'create' ? 'Compila Anamnesi' : 'Modifica Anamnesi' }}</h2>
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
          #anamnesisForm
          [anamnesis]="anamnesis"
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
            {{ mode === 'create' ? 'Salva Anamnesi' : 'Salva Modifiche' }}
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .anamnesis-form-dialog {
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
      .anamnesis-form-dialog {
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
export class AnamnesisFormContainer {
  @ViewChild('anamnesisForm') anamnesisFormRef!: AnamnesisFormComponent;

  @Input() mode: 'create' | 'edit' = 'create';
  @Input() patient: Patient | null = null;
  @Input() path: TherapeuticPath | null = null;
  @Input() anamnesis: AnamnesisComplete | null = null;

  @Output() saved = new EventEmitter<AnamnesisComplete>();
  @Output() close = new EventEmitter<void>();

  saving = false;

  constructor(
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  onSaveClick(): void {
    if (this.anamnesisFormRef) {
      const formValue = this.anamnesisFormRef.getFormValue();
      this.onSave(formValue);
    }
  }

  onSave(anamnesis: AnamnesisComplete): void {
    this.saving = true;
    this.cdr.markForCheck();

    // MOCK: Simula salvataggio
    // In futuro qui ci sarà la chiamata al service GraphQL
    setTimeout(() => {
      console.log('[AnamnesisFormContainer] Saving anamnesis:', anamnesis);

      // Simula risposta positiva
      this.saving = false;
      this.saved.emit(anamnesis);

      this.snackBar.open(
        this.mode === 'create'
          ? 'Anamnesi salvata con successo'
          : 'Anamnesi aggiornata con successo',
        'OK',
        { duration: 3000 }
      );

      this.close.emit();
      this.cdr.markForCheck();
    }, 500);
  }

  onClose(): void {
    if (this.saving) return;
    this.close.emit();
  }
}

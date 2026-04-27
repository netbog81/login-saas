/**
 * Patient Folder Dialog Component
 * Layer 1: Dumb Component (Wrapper Dialog)
 *
 * Responsabilità:
 * - Wrappare PatientFolderContainer in un Material Dialog
 * - Fornire header con titolo e pulsante chiusura
 * - Gestire dimensioni responsive del dialog
 */

import {
  Component,
  Inject,
  ChangeDetectionStrategy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogModule,
  MAT_DIALOG_DATA,
  MatDialogRef
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { Patient } from '../../../../models/patient.model';
import { Treatment } from '../../../../models/treatment.model';
import { PatientFolderContainer } from '../../containers/patient-folder.container';
import { EditTreatmentDialogContainerComponent } from '../../containers/edit-treatment-dialog.container';

export interface PatientFolderDialogData {
  patient: Patient;
  operatorId: string | undefined;
}

@Component({
  selector: 'app-patient-folder-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    PatientFolderContainer,
    EditTreatmentDialogContainerComponent,
  ],
  template: `
    <div class="dialog-container">
      <!-- Header -->
      <div class="dialog-header">
        <h2>
          <mat-icon>folder_shared</mat-icon>
          <span>Cartella Paziente: {{ data.patient.nome }} {{ data.patient.cognome }}</span>
        </h2>
        <button mat-icon-button (click)="onClose()" aria-label="Chiudi">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Content -->
      <mat-dialog-content class="dialog-content">
        <app-patient-folder-container
          #patientFolder
          [patient]="data.patient"
          [currentOperatorId]="data.operatorId"
          (viewPatientDetails)="onViewPatientDetails($event)"
          (editTreatment)="onEditTreatment($event)">
        </app-patient-folder-container>
      </mat-dialog-content>

      <!-- Edit Treatment Dialog (sovrapposto al Patient Folder) -->
      <app-edit-treatment-dialog-container
        #editTreatmentDialog
        [patientId]="data.patient.id"
        (treatmentUpdated)="onTreatmentUpdated($event)"
        (cancel)="onEditTreatmentCancelled()">
      </app-edit-treatment-dialog-container>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      flex-shrink: 0;

      h2 {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      button {
        color: white;

        &:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      }
    }

    .dialog-content {
      flex: 1;
      padding: 0 !important;
      max-height: none !important;
      overflow: hidden;

      app-patient-folder-container {
        display: block;
        height: 100%;
      }
    }

    /* Responsive */
    @media (max-width: 599px) {
      .dialog-header {
        padding: 12px 16px;

        h2 {
          font-size: 1rem;
          gap: 8px;

          mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
          }
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientFolderDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: PatientFolderDialogData,
    private dialogRef: MatDialogRef<PatientFolderDialogComponent>
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }

  onViewPatientDetails(patient: Patient): void {
    // Futuro: navigare a dettagli paziente completi
    console.log('[PatientFolderDialog] View patient details:', patient.id);
  }

  @ViewChild('editTreatmentDialog')
  editTreatmentDialog?: EditTreatmentDialogContainerComponent;

  @ViewChild('patientFolder')
  patientFolder?: PatientFolderContainer;

  onEditTreatment(treatment: Treatment): void {
    console.log('[PatientFolderDialog] Edit treatment:', treatment.id);
    this.editTreatmentDialog?.open(treatment);
  }

  onTreatmentUpdated(treatment: Treatment): void {
    console.log('[PatientFolderDialog] Treatment updated:', treatment.id);
    // Forza il refresh della lista trattamenti nel container sottostante:
    // Apollo non rifa la fetch automaticamente perché update/complete/reopen
    // ritornano il singolo Treatment ma la lista paziente è una query
    // separata. Senza questa chiamata la card del trattamento mostra lo
    // stato vecchio fino al cambio percorso o alla riapertura del dialog.
    this.patientFolder?.reloadTreatments();
  }

  onEditTreatmentCancelled(): void {
    console.log('[PatientFolderDialog] Edit treatment cancelled');
  }
}

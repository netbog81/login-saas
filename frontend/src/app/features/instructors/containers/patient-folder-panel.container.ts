/**
 * Patient Folder Panel Container — Workspace Istruttori
 * Layer 2: Smart Component (wrapper pannello)
 *
 * Responsabilità:
 * - Wrappare la scheda paziente completa (`PatientFolderContainer`) in un
 *   riquadro NON modale, trascinabile, ridimensionabile e comprimibile.
 * - Header con maniglia di trascinamento, titolo (nome paziente), pulsanti
 *   comprimi/espandi e chiudi.
 * - Gestire il dialog di modifica trattamento sovrapposto, come fa il
 *   `PatientFolderDialogComponent` (versione modale full-screen).
 *
 * Perché un container dedicato e non il dialog esistente:
 * il chrome draggable/minimizable segue il pattern collaudato di
 * `AppuntamentiDialogContainer` (Calendario V3) — cdkDrag sulla title-bar +
 * toggle `.minimized` sul pane dell'overlay. Il *contenuto* della scheda è
 * riusato integralmente (`PatientFolderContainer`), senza duplicazione.
 *
 * Non-modale: aperto con `hasBackdrop: false`; le regole globali
 * `.cdk-overlay-container { pointer-events: none }` /
 * `.cdk-overlay-pane { pointer-events: auto }` (styles.scss) lasciano
 * l'istruttore libero di interagire con la lista appuntamenti sottostante.
 */

import {
  Component,
  Inject,
  ChangeDetectionStrategy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule, CdkDrag } from '@angular/cdk/drag-drop';

import { Patient, getPatientDisplayName } from '../../../models/patient.model';
import { Treatment } from '../../../models/treatment.model';
import { PatientFolderContainer } from '../../operators-new/containers/patient-folder.container';
import { EditTreatmentDialogContainerComponent } from '../../operators-new/containers/edit-treatment-dialog.container';

export interface PatientFolderPanelData {
  patient: Patient;
  operatorId: string | undefined;
}

/** panelClass del pane overlay — vedi styles.scss (.patient-folder-panel-pane). */
export const PATIENT_FOLDER_PANEL_CLASS = 'patient-folder-panel-pane';

@Component({
  selector: 'app-patient-folder-panel-container',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    DragDropModule,
    PatientFolderContainer,
    EditTreatmentDialogContainerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel-root" [class.minimized]="minimized">
      <!-- Title bar trascinabile (cdkDrag sull'intera barra).
           La zona pulsanti a destra blocca il drag via stopPropagation. -->
      <div class="panel-title-bar"
           cdkDrag
           #titleDrag="cdkDrag"
           [cdkDragRootElement]="'.' + panelClass"
           cdkDragBoundary=".cdk-overlay-container"
           (dblclick)="toggleMinimized()">
        <div class="title-left">
          <mat-icon>drag_indicator</mat-icon>
          <mat-icon class="folder-ic">folder_shared</mat-icon>
          <span class="title-text">{{ patientName }}</span>
        </div>

        <div class="title-actions"
             (mousedown)="$event.stopPropagation()"
             (dblclick)="$event.stopPropagation()">
          <button mat-icon-button
                  (click)="toggleMinimized()"
                  [matTooltip]="minimized ? 'Espandi' : 'Comprimi'"
                  [attr.aria-label]="minimized ? 'Espandi' : 'Comprimi'">
            <mat-icon>{{ minimized ? 'expand_more' : 'expand_less' }}</mat-icon>
          </button>
          <button mat-icon-button
                  (click)="close()"
                  matTooltip="Chiudi" aria-label="Chiudi">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Corpo: nascosto quando compresso -->
      @if (!minimized) {
        <div class="panel-body">
          <app-patient-folder-container
            #patientFolder
            [patient]="data.patient"
            [currentOperatorId]="data.operatorId"
            (editTreatment)="onEditTreatment($event)">
          </app-patient-folder-container>
        </div>
      }
    </div>

    <!-- Dialog di modifica trattamento, sovrapposto (come nel folder dialog) -->
    <app-edit-treatment-dialog-container
      #editTreatmentDialog
      [patientId]="data.patient.id"
      (treatmentUpdated)="onTreatmentUpdated($event)">
    </app-edit-treatment-dialog-container>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .panel-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 400px;
      min-width: 360px;
    }
    /* Compresso: solo la barra visibile. */
    .panel-root.minimized {
      height: auto;
      min-height: 0;
    }

    .panel-title-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      cursor: move;
      border-radius: 4px 4px 0 0;
      flex: 0 0 auto;
      user-select: none;
    }

    .title-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .folder-ic { flex-shrink: 0; }

    .title-text {
      font-weight: 600;
      font-size: 0.95rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .title-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 0 0 auto;
      cursor: default;
    }

    .title-actions button { color: white; }

    .panel-body {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      background: white;

      app-patient-folder-container {
        display: block;
        height: 100%;
      }
    }

    @media (max-width: 599px) {
      .panel-title-bar { padding: 6px 10px; }
      .title-text { font-size: 0.85rem; }
    }
  `],
})
export class PatientFolderPanelContainer {
  readonly dialogRef = inject(MatDialogRef<PatientFolderPanelContainer>);
  readonly panelClass = PATIENT_FOLDER_PANEL_CLASS;

  minimized = false;

  @ViewChild('titleDrag') titleDrag?: CdkDrag;
  @ViewChild('patientFolder') patientFolder?: PatientFolderContainer;
  @ViewChild('editTreatmentDialog') editTreatmentDialog?: EditTreatmentDialogContainerComponent;

  constructor(@Inject(MAT_DIALOG_DATA) public data: PatientFolderPanelData) {}

  get patientName(): string {
    return getPatientDisplayName(this.data.patient);
  }

  /**
   * Comprime/espande il riquadro alla sola barra header. Agisce anche sul
   * pane dell'overlay per annullarne i vincoli di altezza minima (definiti
   * in .patient-folder-panel-pane). Al ripristino riporta la barra dentro
   * la viewport se il trascinamento l'aveva spinta oltre il bordo.
   */
  toggleMinimized(): void {
    this.minimized = !this.minimized;
    if (this.minimized) {
      this.dialogRef.addPanelClass('minimized');
    } else {
      this.dialogRef.removePanelClass('minimized');
      setTimeout(() => this.ensureTitleBarVisible(), 0);
    }
  }

  private ensureTitleBarVisible(): void {
    const pane = document.querySelector<HTMLElement>('.' + this.panelClass);
    if (!pane || !this.titleDrag) return;

    const rect = pane.getBoundingClientRect();
    const margin = 8;
    const overflowTop = margin - rect.top;
    const overflowLeft = margin - rect.left;
    if (overflowTop <= 0 && overflowLeft <= 0) return;

    const pos = this.titleDrag.getFreeDragPosition();
    this.titleDrag.setFreeDragPosition({
      x: pos.x + Math.max(0, overflowLeft),
      y: pos.y + Math.max(0, overflowTop),
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  onEditTreatment(treatment: Treatment): void {
    this.editTreatmentDialog?.open(treatment);
  }

  onTreatmentUpdated(_treatment: Treatment): void {
    // La lista trattamenti è una query separata: forziamo il refresh come
    // fa PatientFolderDialogComponent, altrimenti la card mostra lo stato
    // vecchio fino al cambio percorso.
    this.patientFolder?.reloadTreatments();
  }
}

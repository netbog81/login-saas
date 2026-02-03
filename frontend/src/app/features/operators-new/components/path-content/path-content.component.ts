/**
 * Path Content Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare header del percorso selezionato
 * - Gestire tabs (Trattamenti, Anamnesi, Documenti)
 * - Usare Angular Material mat-tab-group
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import {
  TherapeuticPath,
  Anamnesis,
  PathDocument,
  getPathStatusLabel,
  getPathStatusColor,
  formatPathProgress
} from '../../../../models/therapeutic-path.model';
import { Treatment } from '../../../../models/treatment.model';
import { AnamnesisComplete } from '../../models/anamnesis.model';

import { TreatmentsTabComponent } from '../treatments-tab/treatments-tab.component';
import { EvaluationTabComponent } from '../evaluation-tab/evaluation-tab.component';
import { ObjectivesTabComponent } from '../objectives-tab/objectives-tab.component';
import { DocumentsTabComponent } from '../documents-tab/documents-tab.component';
import { PatientAnamnesisTabComponent } from '../patient-anamnesis-tab/patient-anamnesis-tab.component';
import {
  ObjectiveWithProgress,
  TestWithEvaluations,
  ObjectiveProgressChangeEvent,
  TestEvaluationAddedEvent,
  TestEvaluationEditedEvent,
  TestResetEvent,
  TestDeleteEvent
} from '../../models/objectives-tracking.model';
import { PatientAnamnesis } from '../../models/patient-anamnesis.model';

export type PathContentTab = 'patient-anamnesis' | 'treatments' | 'anamnesis' | 'obiettivi' | 'documents';

@Component({
  selector: 'app-path-content',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatBadgeModule,
    TreatmentsTabComponent,
    EvaluationTabComponent,
    ObjectivesTabComponent,
    DocumentsTabComponent,
    PatientAnamnesisTabComponent
  ],
  template: `
    <div class="path-content" [class.no-path]="!path">
      @if (!path) {
        <div class="empty-state">
          <mat-icon>folder_off</mat-icon>
          <h3>Nessun percorso selezionato</h3>
          <p>Seleziona un percorso dalla sidebar per visualizzare i dettagli</p>
        </div>
      } @else {
        <!-- Path header -->
        <header class="path-header">
          <div class="path-info">
            <div class="path-title-row">
              <h2>{{ path.name }}</h2>
              <span class="status-badge" [style.background-color]="getStatusColor(path.status)">
                {{ getStatusLabel(path.status) }}
              </span>
            </div>
            <div class="path-meta">
              @if (path.primaryOperatorName) {
                <span class="operator">
                  <mat-icon>person</mat-icon>
                  {{ path.primaryOperatorName }}
                </span>
              }
              @if (path.diagnosis) {
                <span class="diagnosis">
                  <mat-icon>medical_information</mat-icon>
                  {{ path.diagnosis }}
                </span>
              }
              @if (path.plannedSessions) {
                <span class="progress">
                  <mat-icon>event_repeat</mat-icon>
                  {{ getProgress() }}
                </span>
              }
            </div>
          </div>
          <div class="path-actions">
            <button mat-icon-button matTooltip="Modifica percorso" (click)="onEditPath()">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button matTooltip="Elimina percorso" color="warn" (click)="onDeletePath()">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </header>

        <!-- Tabs -->
        <mat-tab-group
          class="content-tabs"
          [selectedIndex]="getTabIndex()"
          (selectedIndexChange)="onTabIndexChange($event)"
          animationDuration="200ms">

          <!-- Tab 0: Anamnesi Paziente (sempre visibile) -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>medical_information</mat-icon>
              <span>Anamnesi</span>
              @if (patientAnamnesis) {
                <mat-icon class="tab-indicator">check_circle</mat-icon>
              }
            </ng-template>
            <div class="tab-content">
              <app-patient-anamnesis-tab
                [anamnesis]="patientAnamnesis"
                [loading]="loadingPatientAnamnesis"
                (edit)="onEditPatientAnamnesis()"
                (delete)="onDeletePatientAnamnesis()"
                (expand)="onExpandPatientAnamnesis()">
              </app-patient-anamnesis-tab>
            </div>
          </mat-tab>

          <!-- Tab 1: Trattamenti -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>medical_services</mat-icon>
              <span>Trattamenti</span>
              @if (treatments.length > 0) {
                <span class="tab-badge">{{ treatments.length }}</span>
              }
            </ng-template>
            <div class="tab-content">
              <app-treatments-tab
                [treatments]="treatments"
                [loading]="loadingTreatments"
                [selectedTreatmentId]="selectedTreatmentId"
                (treatmentSelect)="onTreatmentSelect($event)"
                (treatmentDoubleClick)="onTreatmentDoubleClick($event)"
                (treatmentEdit)="onTreatmentEdit($event)"
                (expand)="onExpandTreatments()">
              </app-treatments-tab>
            </div>
          </mat-tab>

          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>assignment</mat-icon>
              <span>Valutazione</span>
              @if (anamnesis) {
                <mat-icon class="tab-indicator">check_circle</mat-icon>
              }
            </ng-template>
            <div class="tab-content">
              <app-evaluation-tab
                [anamnesis]="anamnesis"
                [anamnesisComplete]="anamnesisComplete"
                [loading]="loadingAnamnesis"
                (edit)="onEditEvaluation()"
                (delete)="onDeleteEvaluation()"
                (expand)="onExpandEvaluation()">
              </app-evaluation-tab>
            </div>
          </mat-tab>

          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>track_changes</mat-icon>
              <span>Obiettivi</span>
              @if (hasObjectivesOrTests()) {
                <mat-icon class="tab-indicator">check_circle</mat-icon>
              }
            </ng-template>
            <div class="tab-content">
              <app-objectives-tab
                [anamnesisComplete]="anamnesisComplete"
                [objectivesWithProgress]="objectivesWithProgress"
                [testsWithEvaluations]="testsWithEvaluations"
                [readonly]="false"
                (objectiveProgressChanged)="onObjectiveProgressChanged($event)"
                (testEvaluationAdded)="onTestEvaluationAdded($event)"
                (testEvaluationEdited)="onTestEvaluationEdited($event)"
                (testReset)="onTestReset($event)"
                (testDeleted)="onTestDeleted($event)"
                (openTestHistory)="onOpenTestHistory($event)"
                (expand)="onExpandObjectives()">
              </app-objectives-tab>
            </div>
          </mat-tab>

          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>folder</mat-icon>
              <span>Documenti</span>
              @if (documents.length > 0) {
                <span class="tab-badge">{{ documents.length }}</span>
              }
            </ng-template>
            <div class="tab-content">
              <app-documents-tab
                [documents]="documents"
                [loading]="loadingDocuments"
                (documentOpen)="onDocumentOpen($event)"
                (documentUpload)="onDocumentUpload()"
                (documentDownload)="onDocumentDownload($event)"
                (documentDelete)="onDocumentDelete($event)">
              </app-documents-tab>
            </div>
          </mat-tab>
        </mat-tab-group>
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .path-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;  // Critico per propagare il constraint di scroll ai figli

      &.no-path {
        justify-content: center;
        align-items: center;
      }
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: #64748b;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #cbd5e1;
        margin-bottom: 16px;
      }

      h3 {
        margin: 0 0 8px;
        font-weight: 500;
        color: #64748b;
      }

      p {
        margin: 0;
        font-size: 0.875rem;
        color: #94a3b8;
      }
    }

    .path-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 20px;
      background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
      flex-shrink: 0;  // Impedisce che l'header si restringa
      border-radius: 12px;
      margin-bottom: 16px;
    }

    .path-info {
      flex: 1;
      min-width: 0;
    }

    .path-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;

      h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #1e293b;
      }

      .status-badge {
        font-size: 0.6875rem;
        font-weight: 600;
        color: white;
        padding: 4px 10px;
        border-radius: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }

    .path-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;

      > span {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8125rem;
        color: #64748b;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #94a3b8;
        }
      }
    }

    .content-tabs {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;  // Critico per scroll

      ::ng-deep {
        .mat-mdc-tab-header {
          border-bottom: 1px solid #e2e8f0;
          flex-shrink: 0;
        }

        .mat-mdc-tab-labels {
          gap: 8px;
        }

        .mdc-tab {
          min-width: auto;
          padding: 0 16px;
        }

        .mat-mdc-tab-body-wrapper {
          flex: 1;
          min-height: 0;  // Critico per scroll
        }

        .mat-mdc-tab-body {
          height: 100%;
        }

        .mat-mdc-tab-body-content {
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;  // Critico per propagare il constraint al figlio
        }
      }
    }

    mat-tab-label {
      mat-icon {
        margin-right: 8px;
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .tab-badge {
      margin-left: 8px;
      background: #667eea;
      color: white;
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 10px;
      min-width: 20px;
      text-align: center;
    }

    .tab-indicator {
      margin-left: 6px;
      font-size: 14px !important;
      width: 14px !important;
      height: 14px !important;
      color: #22c55e;
    }

    .tab-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;  // Critico per scroll
      padding: 16px 0;
      overflow: hidden;  // Lo scroll deve essere sul figlio (.treatments-list), non qui
    }

    /* Responsive */
    @media (max-width: 767px) {
      .path-header {
        flex-direction: column;
        gap: 12px;
        padding: 16px;
      }

      .path-title-row {
        flex-wrap: wrap;
      }

      .path-meta {
        flex-direction: column;
        gap: 8px;
      }

      .content-tabs ::ng-deep {
        .mdc-tab {
          padding: 0 12px;
        }

        .mat-mdc-tab-label-content span {
          display: none;
        }

        .tab-badge, .tab-indicator {
          display: none;
        }
      }

      .tab-content {
        padding: 12px 0;
      }
    }

    @media (max-width: 599px) {
      .path-header {
        padding: 12px;

        .path-title-row h2 {
          font-size: 1rem;
        }

        .status-badge {
          font-size: 0.625rem;
          padding: 3px 8px;
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PathContentComponent {
  @Input() path: TherapeuticPath | null = null;
  @Input() activeTab: PathContentTab = 'treatments';
  @Input() treatments: Treatment[] = [];
  @Input() anamnesis: Anamnesis | null = null;
  @Input() anamnesisComplete: AnamnesisComplete | null = null;
  @Input() documents: PathDocument[] = [];
  @Input() selectedTreatmentId: string | null = null;
  @Input() loadingTreatments = false;
  @Input() loadingAnamnesis = false;
  @Input() loadingDocuments = false;
  // Obiettivi tab inputs
  @Input() objectivesWithProgress: ObjectiveWithProgress[] = [];
  @Input() testsWithEvaluations: TestWithEvaluations[] = [];
  // Patient anamnesis inputs
  @Input() patientAnamnesis: PatientAnamnesis | null = null;
  @Input() loadingPatientAnamnesis = false;

  @Output() tabChange = new EventEmitter<PathContentTab>();
  @Output() editPath = new EventEmitter<void>();
  @Output() treatmentSelect = new EventEmitter<Treatment>();
  @Output() treatmentDoubleClick = new EventEmitter<Treatment>();
  @Output() treatmentEdit = new EventEmitter<Treatment>();
  @Output() editEvaluation = new EventEmitter<void>();
  @Output() deleteEvaluation = new EventEmitter<void>();
  @Output() expandEvaluation = new EventEmitter<void>();
  @Output() documentOpen = new EventEmitter<PathDocument>();
  @Output() documentUpload = new EventEmitter<void>();
  @Output() documentDownload = new EventEmitter<PathDocument>();
  @Output() documentDelete = new EventEmitter<PathDocument>();
  @Output() deletePath = new EventEmitter<void>();
  // Obiettivi tab outputs
  @Output() objectiveProgressChanged = new EventEmitter<ObjectiveProgressChangeEvent>();
  @Output() testEvaluationAdded = new EventEmitter<TestEvaluationAddedEvent>();
  @Output() testEvaluationEdited = new EventEmitter<TestEvaluationEditedEvent>();
  @Output() testReset = new EventEmitter<TestResetEvent>();
  @Output() testDeleted = new EventEmitter<TestDeleteEvent>();
  @Output() openTestHistory = new EventEmitter<TestWithEvaluations>();
  @Output() expandObjectives = new EventEmitter<void>();
  @Output() expandTreatments = new EventEmitter<void>();
  // Patient anamnesis outputs
  @Output() editPatientAnamnesis = new EventEmitter<void>();
  @Output() deletePatientAnamnesis = new EventEmitter<void>();
  @Output() expandPatientAnamnesis = new EventEmitter<void>();

  private readonly tabIndexMap: PathContentTab[] = ['patient-anamnesis', 'treatments', 'anamnesis', 'obiettivi', 'documents'];

  getTabIndex(): number {
    return this.tabIndexMap.indexOf(this.activeTab);
  }

  onTabIndexChange(index: number): void {
    this.tabChange.emit(this.tabIndexMap[index]);
  }

  onEditPath(): void {
    this.editPath.emit();
  }

  onDeletePath(): void {
    this.deletePath.emit();
  }

  onTreatmentSelect(treatment: Treatment): void {
    this.treatmentSelect.emit(treatment);
  }

  onTreatmentDoubleClick(treatment: Treatment): void {
    this.treatmentDoubleClick.emit(treatment);
  }

  onTreatmentEdit(treatment: Treatment): void {
    this.treatmentEdit.emit(treatment);
  }

  onEditEvaluation(): void {
    this.editEvaluation.emit();
  }

  onDeleteEvaluation(): void {
    this.deleteEvaluation.emit();
  }

  onExpandEvaluation(): void {
    this.expandEvaluation.emit();
  }

  onDocumentOpen(doc: PathDocument): void {
    this.documentOpen.emit(doc);
  }

  onDocumentUpload(): void {
    this.documentUpload.emit();
  }

  onDocumentDownload(doc: PathDocument): void {
    this.documentDownload.emit(doc);
  }

  onDocumentDelete(doc: PathDocument): void {
    this.documentDelete.emit(doc);
  }

  getStatusLabel(status: string): string {
    return getPathStatusLabel(status as any);
  }

  getStatusColor(status: string): string {
    return getPathStatusColor(status as any);
  }

  getProgress(): string {
    if (!this.path) return '';
    return formatPathProgress(this.path);
  }

  // === Obiettivi tab methods ===

  hasObjectivesOrTests(): boolean {
    return this.objectivesWithProgress.length > 0 || this.testsWithEvaluations.length > 0;
  }

  onObjectiveProgressChanged(event: ObjectiveProgressChangeEvent): void {
    this.objectiveProgressChanged.emit(event);
  }

  onTestEvaluationAdded(event: TestEvaluationAddedEvent): void {
    this.testEvaluationAdded.emit(event);
  }

  onTestEvaluationEdited(event: TestEvaluationEditedEvent): void {
    this.testEvaluationEdited.emit(event);
  }

  onTestReset(event: TestResetEvent): void {
    this.testReset.emit(event);
  }

  onTestDeleted(event: TestDeleteEvent): void {
    this.testDeleted.emit(event);
  }

  onOpenTestHistory(test: TestWithEvaluations): void {
    this.openTestHistory.emit(test);
  }

  onExpandObjectives(): void {
    this.expandObjectives.emit();
  }

  onExpandTreatments(): void {
    this.expandTreatments.emit();
  }

  // === Patient Anamnesis tab methods ===

  onEditPatientAnamnesis(): void {
    this.editPatientAnamnesis.emit();
  }

  onDeletePatientAnamnesis(): void {
    this.deletePatientAnamnesis.emit();
  }

  onExpandPatientAnamnesis(): void {
    this.expandPatientAnamnesis.emit();
  }
}

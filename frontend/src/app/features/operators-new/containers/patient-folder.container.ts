/**
 * Patient Folder Container
 * Layer 2: Smart Component - Gestione Cartella Paziente
 *
 * Responsabilità:
 * - Gestione stato cartella paziente
 * - Caricamento percorsi terapeutici
 * - Coordinamento tra header, sidebar percorsi e contenuto tabs
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';

import { Patient } from '../../../models/patient.model';
import { TherapeuticPath, Anamnesis } from '../../../models/therapeutic-path.model';
import { Treatment } from '../../../models/treatment.model';
import { PatientDocument } from '../../patient-documents/models/patient-document.model';
import {
  PathOption,
  TreatmentOption,
} from '../../patient-documents/components/patient-documents-tab/patient-documents-tab.component';
import { PatientDocumentsService } from '../../patient-documents/services/patient-documents.service';
import { PendingFeService } from '../services/pending-fe.service';
import {
  PendingFeDialogContainer,
  PendingFeDialogData,
  PendingFeDialogResult,
} from './pending-fe-dialog.container';
import { PatientDocumentsTransferService } from '../../patient-documents/services/patient-documents-transfer.service';
import { PatientDocumentsUploadDialogContainer } from '../../patient-documents/containers/patient-documents-upload-dialog.container';
import { TherapeuticPathService } from '../../../services/therapeutic-path.service';
import { TreatmentService } from '../../../services/treatment.service';
import { PatientEvaluationService } from '../../../services/patient-evaluation.service';
import { ObjectivesTrackingService } from '../../../services/objectives-tracking.service';
import { SimplePatientAnamnesisService } from '../../../services/simple-patient-anamnesis.service';

import { PatientHeaderComponent } from '../components/patient-header/patient-header.component';
import { PathContentComponent, PathContentTab } from '../components/path-content/path-content.component';
import { PathDialogContainer } from './path-dialog.container';
import { TreatmentDetailDialogContainerComponent } from './treatment-detail-dialog.container';
import { EvaluationFormContainer } from './evaluation-form.container';
import { EvaluationDialogContainer } from './evaluation-dialog.container';
import { ObjectivesDialogContainer } from './objectives-dialog.container';
import { TreatmentsDialogContainer } from './treatments-dialog.container';
import { PatientAnamnesisDialogContainer } from './patient-anamnesis-dialog.container';
import { TestHistoryDialogContainer } from './test-history-dialog.container';
import { PatientAnamnesisFormContainer } from './patient-anamnesis-form.container';
import { ConfirmResetDialogComponent } from '../components/confirm-reset-dialog/confirm-reset-dialog.component';
import { EvaluationComplete, Obiettivo, TestSpecifico, TestEvaluationHistoryEntry, createEmptyEvaluation } from '../models/evaluation.model';
import { PatientAnamnesis } from '../models/patient-anamnesis.model';
import {
  PatientFolderUIState,
  PatientFolderTab,
  createInitialPatientFolderUIState
} from '../models/patient-folder-state.model';
import {
  PathDialogData,
  createEditPathDialogData
} from '../models/path-dialog.model';
import {
  ObjectiveType,
  ObjectiveWithProgress,
  TestWithEvaluations,
  ObjectiveProgressChangeEvent,
  TestEvaluationAddedEvent,
  TestEvaluationEditedEvent,
  TestResetEvent,
  TestDeleteEvent
} from '../models/objectives-tracking.model';

@Component({
  selector: 'app-patient-folder-container',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    PatientHeaderComponent,
    PathContentComponent,
    PathDialogContainer,
    TreatmentDetailDialogContainerComponent,
    EvaluationFormContainer,
    EvaluationDialogContainer,
    ObjectivesDialogContainer,
    TreatmentsDialogContainer,
    PatientAnamnesisDialogContainer,
    TestHistoryDialogContainer,
    PatientAnamnesisFormContainer,
    ConfirmResetDialogComponent,
    PatientDocumentsUploadDialogContainer
  ],
  template: `
    <div class="patient-folder" [class.no-patient]="!patient">
      <!-- Header paziente -->
      <app-patient-header
        [patient]="patient"
        [pathsCount]="paths.length"
        [activePathsCount]="getActivePathsCount()"
        [totalTreatmentsCount]="getTotalTreatmentsCount()"
        [anamnesisExists]="!!patientAnamnesis"
        [documentsCount]="patientDocuments.length"
        [feAlertCount]="pendingFeCount"
        [feAlertTotalAmount]="pendingFeTotalAmount"
        (viewDetails)="onViewPatientDetails()"
        (createPath)="onCreatePath()"
        (viewAnamnesis)="onExpandPatientAnamnesis()"
        (viewDocuments)="onViewDocumentsTab()"
        (viewFeAlert)="onOpenPendingFeDialog()">
      </app-patient-header>

      @if (patient) {
        <!-- Main content con sidebar e tabs -->
        <div class="folder-content">
          <!-- Sidebar percorsi (placeholder per ora) -->
          <aside class="paths-sidebar" [class.collapsed]="uiState.sidebarCollapsed">
            <div class="sidebar-header">
              @if (!uiState.sidebarCollapsed) {
                <h3>Percorsi Terapeutici</h3>
                <span class="count">{{ paths.length }}</span>
              }
              <button class="collapse-btn" (click)="toggleSidebar()">
                {{ uiState.sidebarCollapsed ? '→' : '←' }}
              </button>
            </div>

            @if (!uiState.sidebarCollapsed) {
              <div class="sidebar-content">
                @if (uiState.loadingPaths) {
                  <div class="loading">Caricamento...</div>
                } @else if (paths.length === 0) {
                  <div class="empty">Nessun percorso terapeutico</div>
                } @else {
                  <div class="paths-list">
                    @for (path of paths; track path.id) {
                      <div
                        class="path-item"
                        [class.selected]="path.id === uiState.selectedPathId"
                        [class.active]="path.status?.toLowerCase() === 'active'"
                        [class.completed]="path.status?.toLowerCase() === 'completed'"
                        (click)="onPathSelect(path)">
                        <div class="path-icon">
                          <span class="status-dot"></span>
                        </div>
                        <div class="path-info">
                          <span class="path-name">{{ path.name }}</span>
                          <span class="path-doctor">{{ path.primaryOperatorName || 'Operatore' }}</span>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </aside>

          <!-- Area principale con tabs -->
          <main class="main-content">
            <app-path-content
              [path]="selectedPath"
              [activeTab]="uiState.activeTab"
              [treatments]="filteredTreatments"
              [anamnesis]="selectedPath?.anamnesis || null"
              [anamnesisComplete]="currentEvaluation"
              [documents]="patientDocuments"
              [documentPathOptions]="documentPathOptions"
              [documentTreatmentOptions]="documentTreatmentOptions"
              [selectedTreatmentId]="uiState.selectedTreatmentId"
              [loadingTreatments]="uiState.loadingTreatments"
              [loadingAnamnesis]="uiState.loadingAnamnesis"
              [loadingDocuments]="uiState.loadingDocuments"
              [objectivesWithProgress]="objectivesWithProgress"
              [testsWithEvaluations]="testsWithEvaluations"
              [patientAnamnesis]="patientAnamnesis"
              [loadingPatientAnamnesis]="loadingPatientAnamnesis"
              (tabChange)="onTabChange($event)"
              (editPath)="onEditPath()"
              (deletePath)="onDeletePath()"
              (treatmentSelect)="onTreatmentSelect($event)"
              (treatmentDoubleClick)="onTreatmentDoubleClick($event)"
              (treatmentEdit)="onTreatmentEdit($event)"
              (editEvaluation)="onEditEvaluation()"
              (deleteEvaluation)="onDeleteEvaluation()"
              (expandEvaluation)="onExpandEvaluation()"
              (documentOpen)="onDocumentOpen($event)"
              (documentUpload)="onDocumentUpload()"
              (documentDownload)="onDocumentDownload($event)"
              (documentDelete)="onDocumentDelete($event)"
              (objectiveProgressChanged)="onObjectiveProgressChanged($event)"
              (testEvaluationAdded)="onTestEvaluationAdded($event)"
              (testEvaluationEdited)="onTestEvaluationEdited($event)"
              (testReset)="onTestResetRequested($event)"
              (testDeleted)="onTestDeleted($event)"
              (openTestHistory)="onOpenTestHistory($event)"
              (expandObjectives)="onExpandObjectives()"
              (expandTreatments)="onExpandTreatments()"
              (editPatientAnamnesis)="onEditPatientAnamnesis()"
              (deletePatientAnamnesis)="onDeletePatientAnamnesis()"
              (expandPatientAnamnesis)="onExpandPatientAnamnesis()">
            </app-path-content>
          </main>
        </div>
      }
    </div>

    <!-- Path Dialog -->
    @if (showPathDialog && pathDialogData) {
      <app-path-dialog-container
        [data]="pathDialogData"
        (pathCreated)="onPathCreated($event)"
        (pathUpdated)="onPathUpdated($event)"
        (close)="closePathDialog()">
      </app-path-dialog-container>
    }

    <!-- Upload documenti scheda paziente (multi-file, drag & drop) -->
    @if (showDocumentUploadDialog && patient) {
      <app-patient-documents-upload-dialog-container
        [subjectId]="patient.id"
        [paths]="documentPathOptions"
        [treatments]="documentTreatmentOptions"
        [defaultPathId]="selectedPath?.id || null"
        (uploaded)="loadPatientDocuments()"
        (closed)="showDocumentUploadDialog = false">
      </app-patient-documents-upload-dialog-container>
    }

    <!-- Treatment Detail Dialog Container -->
    <app-treatment-detail-dialog-container
      #treatmentDetailDialog
      (close)="onTreatmentDetailClose()"
      (editTreatment)="onTreatmentEdit($event)"
      (treatmentUpdated)="onTreatmentPaymentUpdated($event)">
    </app-treatment-detail-dialog-container>

    <!-- Evaluation Form Dialog (modulo unificato: percorso + valutazione + anamnesi remota) -->
    @if (showEvaluationForm) {
      <div class="dialog-overlay">
        <app-evaluation-form-container
          [mode]="evaluationFormMode"
          [patient]="patient"
          [path]="evaluationCreatesNewPath ? null : selectedPath"
          [evaluation]="currentEvaluation"
          [patientAnamnesis]="patientAnamnesis"
          [operatorId]="currentOperatorId || ''"
          (saved)="onEvaluationSaved($event)"
          (pathSaved)="onPathSavedFromEvaluation($event)"
          (anamnesisSaved)="onPatientAnamnesisSaved($event)"
          (close)="closeEvaluationForm()">
        </app-evaluation-form-container>
      </div>
    }

    <!-- Evaluation Expand Dialog -->
    <app-evaluation-dialog-container
      #evaluationDialog
      [patient]="patient"
      [path]="selectedPath"
      [evaluationComplete]="currentEvaluation"
      [patientAnamnesis]="patientAnamnesis"
      (edit)="onEditEvaluation()"
      (delete)="onDeleteEvaluation()"
      (close)="onEvaluationDialogClose()">
    </app-evaluation-dialog-container>

    <!-- Objectives Expand Dialog -->
    <app-objectives-dialog-container
      #objectivesDialog
      [patient]="patient"
      [path]="selectedPath"
      [anamnesisComplete]="currentEvaluation"
      [objectivesWithProgress]="objectivesWithProgress"
      [testsWithEvaluations]="testsWithEvaluations"
      (objectiveProgressChanged)="onObjectiveProgressChanged($event)"
      (testEvaluationAdded)="onTestEvaluationAdded($event)"
      (testEvaluationEdited)="onTestEvaluationEdited($event)"
      (testReset)="onTestResetRequested($event)"
      (testDeleted)="onTestDeleted($event)"
      (openTestHistory)="onOpenTestHistory($event)"
      (close)="onObjectivesDialogClose()">
    </app-objectives-dialog-container>

    <!-- Treatments Expand Dialog -->
    <app-treatments-dialog-container
      #treatmentsDialog
      [patient]="patient"
      [path]="selectedPath"
      [treatments]="filteredTreatments"
      [loading]="uiState.loadingTreatments"
      [selectedTreatmentId]="uiState.selectedTreatmentId"
      (treatmentSelect)="onTreatmentSelect($event)"
      (treatmentDoubleClick)="onTreatmentDoubleClick($event)"
      (treatmentEdit)="onTreatmentEdit($event)"
      (close)="onTreatmentsDialogClose()">
    </app-treatments-dialog-container>

    <!-- Patient Anamnesis Expand Dialog -->
    <app-patient-anamnesis-dialog-container
      #patientAnamnesisDialog
      [patient]="patient"
      [anamnesis]="patientAnamnesis"
      [loading]="loadingPatientAnamnesis"
      (edit)="onEditPatientAnamnesis()"
      (delete)="onDeletePatientAnamnesis()"
      (close)="onPatientAnamnesisDialogClose()">
    </app-patient-anamnesis-dialog-container>

    <!-- Test History Dialog -->
    <app-test-history-dialog-container
      [test]="selectedTestForHistory"
      [isVisible]="showTestHistoryDialog"
      (closed)="onTestHistoryClosed()"
      (entryUpdated)="onTestEntryUpdated()">
    </app-test-history-dialog-container>

    <!-- Confirm Reset Dialog -->
    @if (showConfirmResetDialog && selectedTestForReset) {
      <app-confirm-reset-dialog
        [testName]="selectedTestForReset.nome"
        [evaluationsCount]="selectedTestForReset.evaluationHistory?.length || 0"
        (confirm)="onConfirmReset()"
        (cancel)="onCancelReset()">
      </app-confirm-reset-dialog>
    }

    <!-- Patient Anamnesis Form Dialog -->
    @if (showPatientAnamnesisForm && patient) {
      <div class="dialog-overlay">
        <app-patient-anamnesis-form-container
          [anamnesis]="patientAnamnesis"
          [patientId]="patient.id"
          [operatorId]="currentOperatorId || null"
          (saved)="onPatientAnamnesisSaved($event)"
          (close)="closePatientAnamnesisForm()">
        </app-patient-anamnesis-form-container>
      </div>
    }

  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      height: 100%;
    }

    .patient-folder {
      display: flex;
      flex-direction: column;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      height: 100%;
      min-height: 0;  // Permette contrazione, scrollbar interna sui trattamenti

      &.no-patient {
        min-height: 150px;
      }
    }

    .folder-content {
      display: flex;
      flex: 1;
      min-height: 0;
    }

    // Sidebar
    .paths-sidebar {
      width: 280px;
      flex-shrink: 0;
      background: #f8fafc;
      border-right: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);

      &.collapsed {
        width: 56px;
      }
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
      background: white;

      h3 {
        margin: 0;
        font-size: 0.8125rem;
        font-weight: 600;
        color: #334155;
        flex: 1;
      }

      .count {
        background: #667eea;
        color: white;
        font-size: 0.6875rem;
        padding: 2px 6px;
        border-radius: 8px;
      }

      .collapse-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px 8px;
        color: #64748b;
        font-size: 0.875rem;
        border-radius: 4px;

        &:hover {
          background: #e2e8f0;
        }
      }
    }

    .sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .loading, .empty {
      text-align: center;
      padding: 24px 16px;
      color: #64748b;
      font-size: 0.8125rem;
    }

    .paths-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .path-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: #e2e8f0;
      }

      &.selected {
        background: #eef2ff;
        border-left: 3px solid #667eea;
      }

      .path-icon {
        flex-shrink: 0;

        .status-dot {
          display: block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #94a3b8;
        }
      }

      &.active .status-dot {
        background: #22c55e;
      }

      &.completed .status-dot {
        background: #3b82f6;
      }

      .path-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;

        .path-name {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #1e293b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .path-doctor {
          font-size: 0.75rem;
          color: #64748b;
        }
      }
    }

    // Main content
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;     // Critico per scroll
      overflow: hidden;   // Critico per scroll
      padding: 16px 20px;
    }

    /* Responsive */
    @media (max-width: 767px) {
      .folder-content {
        flex-direction: column;
      }

      .paths-sidebar {
        width: 100%;
        flex-shrink: 0;
        max-height: 160px;
        border-right: none;
        border-bottom: 1px solid #e2e8f0;

        &.collapsed {
          width: 100%;
          max-height: 48px;
        }
      }

      .sidebar-content {
        .paths-list {
          flex-direction: row;
          overflow-x: auto;
          padding-bottom: 8px;

          .path-item {
            min-width: 160px;
            flex-shrink: 0;
          }
        }
      }

      .main-content {
        flex: 1;
        min-height: 250px;
        padding: 12px 16px;
      }
    }

    @media (max-width: 599px) {
      .main-content {
        padding: 10px 12px;
      }

      .paths-sidebar {
        max-height: 140px;
      }

      :host {
        height: auto;  // Permette al componente di fluire naturalmente in mobile
        overflow: visible;
      }

      .patient-folder {
        overflow: visible;  // Permette al contenuto di crescere in mobile
      }
    }

    /* Dialog overlay */
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
      padding: 24px;
    }

    /* Dialog content wrapper - Material Design elevation */
    .dialog-overlay > * {
      background: white;
      border-radius: 12px;
      max-width: 600px;
      max-height: 90vh;
      width: 100%;
      overflow: auto;
      box-shadow: 0 11px 15px -7px rgba(0,0,0,.2),
                  0 24px 38px 3px rgba(0,0,0,.14),
                  0 9px 46px 8px rgba(0,0,0,.12);
    }

    @media (max-width: 599px) {
      .dialog-overlay {
        padding: 16px;
      }
      .dialog-overlay > * {
        max-height: 95vh;
        max-width: 100%;
        border-radius: 8px;
      }
    }

    /* Anamnesis Check Dialog */
    .anamnesis-check-dialog {
      background: white;
      border-radius: 12px;
      max-width: 450px;
      width: 100%;
      box-shadow: 0 11px 15px -7px rgba(0,0,0,.2),
                  0 24px 38px 3px rgba(0,0,0,.14),
                  0 9px 46px 8px rgba(0,0,0,.12);
      overflow: hidden;
    }

    .anamnesis-check-dialog .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      color: white;

      &.warning {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      }

      &.info {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      }

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      h3 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
      }
    }

    .anamnesis-check-dialog .dialog-content {
      padding: 20px;

      p {
        margin: 0 0 8px;
        color: #374151;
        font-size: 0.9375rem;
        line-height: 1.5;
      }

      .subtitle {
        color: #6b7280;
        font-weight: 500;
      }
    }

    .anamnesis-check-dialog .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 20px;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientFolderContainer implements OnChanges, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() patient: Patient | null = null;
  @Input() currentOperatorId?: string;

  @Output() viewPatientDetails = new EventEmitter<Patient>();
  @Output() pathCreated = new EventEmitter<TherapeuticPath>();
  @Output() pathUpdated = new EventEmitter<TherapeuticPath>();
  @Output() pathDeleted = new EventEmitter<string>();
  @Output() editTreatment = new EventEmitter<Treatment>();

  @ViewChild('treatmentDetailDialog') treatmentDetailDialog!: TreatmentDetailDialogContainerComponent;
  @ViewChild('evaluationDialog') evaluationDialog!: EvaluationDialogContainer;
  @ViewChild('objectivesDialog') objectivesDialog!: ObjectivesDialogContainer;
  @ViewChild('treatmentsDialog') treatmentsDialog!: TreatmentsDialogContainer;
  @ViewChild('patientAnamnesisDialog') patientAnamnesisDialog!: PatientAnamnesisDialogContainer;

  // State
  uiState: PatientFolderUIState = createInitialPatientFolderUIState();
  paths: TherapeuticPath[] = [];
  selectedPath: TherapeuticPath | null = null;
  treatments: Treatment[] = [];

  // Dialog state
  showPathDialog = false;
  pathDialogData: PathDialogData | null = null;

  // Evaluation state
  showEvaluationForm = false;
  evaluationFormMode: 'create' | 'edit' = 'create';
  currentEvaluation: EvaluationComplete | null = null;
  /**
   * True solo per "Nuova Valutazione" dall'header (crea anche un nuovo
   * percorso). False quando la valutazione si crea/modifica DENTRO un percorso
   * esistente: in quel caso va agganciata a `selectedPath`, non se ne crea uno
   * nuovo.
   */
  evaluationCreatesNewPath = false;

  // Objectives tracking state
  objectivesWithProgress: ObjectiveWithProgress[] = [];
  testsWithEvaluations: TestWithEvaluations[] = [];

  // Test History Dialog state
  showTestHistoryDialog = false;
  selectedTestForHistory: TestWithEvaluations | null = null;

  // Confirm Reset Dialog state
  showConfirmResetDialog = false;
  selectedTestForReset: TestWithEvaluations | null = null;

  // Patient Anamnesis state (anamnesi remota legata al paziente)
  patientAnamnesis: PatientAnamnesis | null = null;
  loadingPatientAnamnesis = false;
  showPatientAnamnesisForm = false;

  // Documenti scheda paziente (tutti i livelli: generali/percorso/trattamento)
  patientDocuments: PatientDocument[] = [];
  showDocumentUploadDialog = false;

  // Allarme sconto FE non incassati (fisioterapia + palestra). Il conteggio
  // accende il riquadro rosso "FE" nell'header; il riquadro apre l'elenco.
  pendingFeCount = 0;
  pendingFeTotalAmount = 0;

  constructor(
    private pathService: TherapeuticPathService,
    private treatmentService: TreatmentService,
    private evaluationService: PatientEvaluationService,
    private objectivesTrackingService: ObjectivesTrackingService,
    private patientAnamnesisService: SimplePatientAnamnesisService,
    private documentsService: PatientDocumentsService,
    private documentsTransfer: PatientDocumentsTransferService,
    private pendingFeService: PendingFeService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patient'] && this.patient) {
      // Reset immediato dello stato quando cambia il paziente
      // per evitare di mostrare dati del paziente precedente
      this.selectedPath = null;
      this.paths = [];
      this.treatments = [];
      this.patientAnamnesis = null;
      this.patientDocuments = [];
      this.pendingFeCount = 0;
      this.pendingFeTotalAmount = 0;
      this.uiState = { ...this.uiState, selectedPathId: null, selectedTreatmentId: null };
      this.cdr.markForCheck();

      // Poi carica i nuovi dati
      this.loadPaths();
      this.loadTreatments();
      this.loadPatientAnamnesis();
      this.loadPatientDocuments();
      this.loadPendingFe();
    } else if (changes['patient'] && !this.patient) {
      this.paths = [];
      this.selectedPath = null;
      this.treatments = [];
      this.patientAnamnesis = null;
      this.patientDocuments = [];
      this.pendingFeCount = 0;
      this.pendingFeTotalAmount = 0;
      this.uiState = createInitialPatientFolderUIState();
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Data loading
  private loadPaths(): void {
    if (!this.patient?.id) return;

    this.uiState = { ...this.uiState, loadingPaths: true };
    this.cdr.markForCheck();

    this.pathService.getPathsByPatient(this.patient.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (paths) => {
          // Apollo già esegue dentro NgZone, non serve wrapping aggiuntivo
          this.paths = paths || [];
          this.uiState = { ...this.uiState, loadingPaths: false };

          // Auto-select first active path
          const activePath = this.paths.find(p => p.status?.toLowerCase() === 'active');
          if (activePath) {
            this.selectPath(activePath);
          } else if (this.paths.length > 0) {
            this.selectPath(this.paths[0]);
          }

          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error loading paths:', err);
          this.uiState = {
            ...this.uiState,
            loadingPaths: false,
            error: 'Errore nel caricamento dei percorsi'
          };
          this.cdr.markForCheck();
        }
      });
  }

  private loadTreatments(): void {
    if (!this.patient?.id) return;

    this.uiState = { ...this.uiState, loadingTreatments: true };
    this.cdr.markForCheck();

    console.log('[PatientFolderContainer] loadTreatments called for patient:', this.patient.id);

    this.treatmentService.getTreatmentsByPatient(this.patient.id)
      .pipe(
        tap({
          next: (data) => console.log('[PatientFolderContainer] treatments received:', data),
          error: (err) => console.log('[PatientFolderContainer] treatments error in tap:', err),
          complete: () => console.log('[PatientFolderContainer] treatments observable completed')
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (treatments) => {
          console.log('[PatientFolderContainer] treatments in subscribe next:', treatments);
          // Apollo già esegue dentro NgZone, non serve wrapping aggiuntivo
          this.treatments = treatments || [];
          this.uiState = { ...this.uiState, loadingTreatments: false };
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error loading treatments:', err);
          this.treatments = [];
          this.uiState = { ...this.uiState, loadingTreatments: false };
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Carica gli sconto FE non incassati del paziente: alimenta il badge rosso
   * "FE" dell'header. Errori silenziosi (badge spento): l'allarme è
   * informativo, non deve rompere la cartella.
   */
  private loadPendingFe(): void {
    if (!this.patient?.id) return;

    this.pendingFeService.getForPatient(this.patient.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (collections) => {
          this.pendingFeCount = collections.count;
          this.pendingFeTotalAmount = collections.totalAmount;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error loading pending FE:', err);
          this.pendingFeCount = 0;
          this.pendingFeTotalAmount = 0;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Riquadro "FE": elenco degli sconto FE scoperti con l'azione "Incassa".
   * Alla chiusura il dialog restituisce quanti ne restano, così il badge si
   * spegne senza un giro extra in rete; ricarichiamo comunque i trattamenti
   * perché l'incasso ne cambia lo stato.
   */
  onOpenPendingFeDialog(): void {
    if (!this.patient) return;

    const ref = this.dialog.open<
      PendingFeDialogContainer,
      PendingFeDialogData,
      PendingFeDialogResult
    >(PendingFeDialogContainer, {
      width: '860px',
      maxWidth: '95vw',
      data: {
        patientId: this.patient.id,
        patientName: `${this.patient.nome ?? ''} ${this.patient.cognome ?? ''}`.trim(),
      },
    });

    ref.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (result && result.remainingCount !== this.pendingFeCount) {
          this.loadTreatments();
        }
        this.loadPendingFe();
      });
  }

  /**
   * Carica l'anamnesi del paziente (nuova entità legata al paziente, non al percorso)
   */
  private loadPatientAnamnesis(): void {
    if (!this.patient?.id) return;

    this.loadingPatientAnamnesis = true;
    this.cdr.markForCheck();

    this.patientAnamnesisService.getAnamnesisByPatient(this.patient.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (anamnesis) => {
          this.patientAnamnesis = anamnesis;
          this.loadingPatientAnamnesis = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error loading patient anamnesis:', err);
          this.patientAnamnesis = null;
          this.loadingPatientAnamnesis = false;
          this.cdr.markForCheck();
        }
      });
  }

  // Event handlers
  onPathSelect(path: TherapeuticPath): void {
    this.selectPath(path);
  }

  onTabChange(tab: PatientFolderTab): void {
    this.uiState = { ...this.uiState, activeTab: tab };
    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.uiState = {
      ...this.uiState,
      sidebarCollapsed: !this.uiState.sidebarCollapsed
    };
    this.cdr.markForCheck();
  }

  onViewPatientDetails(): void {
    if (this.patient) {
      this.viewPatientDetails.emit(this.patient);
    }
  }

  /**
   * "Nuova Valutazione": apre direttamente il modulo unificato in modalità
   * create-with-path. Il modulo crea in un colpo solo percorso + valutazione
   * + anamnesi remota, senza i passaggi-guardia ("manca l'anamnesi", "manca il
   * percorso") che rendevano il flusso ripetitivo. L'eventuale anamnesi remota
   * già esistente viene pre-compilata dentro al form.
   */
  onCreatePath(): void {
    if (!this.patient) return;
    this.currentEvaluation = null;
    this.evaluationFormMode = 'create';
    this.evaluationCreatesNewPath = true; // header → crea anche il percorso
    this.showEvaluationForm = true;
    this.cdr.markForCheck();
  }

  onEditPath(): void {
    if (!this.patient || !this.selectedPath) return;

    this.pathDialogData = createEditPathDialogData(
      this.selectedPath,
      this.patient.id,
      this.currentOperatorId
    );
    this.showPathDialog = true;
    this.cdr.markForCheck();
  }

  // Dialog handlers
  onPathCreated(newPath: TherapeuticPath): void {
    // Aggiungi il nuovo percorso alla lista
    this.paths = [newPath, ...this.paths];
    // Seleziona il nuovo percorso
    this.selectPath(newPath);
    // Emetti evento al parent
    this.pathCreated.emit(newPath);
    this.cdr.markForCheck();
  }

  onPathUpdated(updatedPath: TherapeuticPath): void {
    // Aggiorna il percorso nella lista
    this.paths = this.paths.map(p =>
      p.id === updatedPath.id ? updatedPath : p
    );
    // Aggiorna selectedPath se è quello modificato
    if (this.selectedPath?.id === updatedPath.id) {
      this.selectedPath = updatedPath;
    }
    // Emetti evento al parent
    this.pathUpdated.emit(updatedPath);
    this.cdr.markForCheck();
  }

  /**
   * Il modulo unificato di valutazione ha creato o aggiornato il percorso.
   * Riallinea la lista percorsi (insert se nuovo, replace se esistente).
   */
  onPathSavedFromEvaluation(path: TherapeuticPath): void {
    const exists = this.paths.some(p => p.id === path.id);
    if (exists) {
      this.onPathUpdated(path);
    } else {
      this.onPathCreated(path);
    }
  }

  closePathDialog(): void {
    this.showPathDialog = false;
    this.pathDialogData = null;
    this.cdr.markForCheck();
  }

  onDeletePath(): void {
    if (!this.selectedPath) return;

    const pathName = this.selectedPath.name;
    const confirmed = confirm(`Eliminare il percorso "${pathName}"?\n\nQuesta azione non può essere annullata.`);
    if (!confirmed) return;

    const pathIdToDelete = this.selectedPath.id;

    this.pathService.deletePath(pathIdToDelete)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Apollo già esegue dentro NgZone, non serve wrapping aggiuntivo
          // Rimuovi il percorso dalla lista
          this.paths = this.paths.filter(p => p.id !== pathIdToDelete);

          // Seleziona un altro percorso (il primo attivo o il primo disponibile)
          const activePath = this.paths.find(p => p.status?.toLowerCase() === 'active');
          if (activePath) {
            this.selectPath(activePath);
          } else if (this.paths.length > 0) {
            this.selectPath(this.paths[0]);
          } else {
            this.selectedPath = null;
            this.uiState = { ...this.uiState, selectedPathId: null };
          }

          // Emetti evento al parent
          this.pathDeleted.emit(pathIdToDelete);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error deleting path:', err);
          alert('Errore durante l\'eliminazione del percorso. Riprova.');
          this.cdr.markForCheck();
        }
      });
  }

  onTreatmentSelect(treatment: Treatment): void {
    this.uiState = { ...this.uiState, selectedTreatmentId: treatment.id };
    this.cdr.markForCheck();
  }

  onTreatmentDoubleClick(treatment: Treatment): void {
    console.log('[PatientFolderContainer] Treatment double click:', treatment.id);
    this.uiState = { ...this.uiState, selectedTreatmentId: treatment.id };
    // Apre il dialog container per vedi dettagli
    if (this.treatmentDetailDialog) {
      this.treatmentDetailDialog.open(treatment);
    }
    this.cdr.markForCheck();
  }

  onTreatmentEdit(treatment: Treatment): void {
    console.log('[PatientFolderContainer] Edit treatment:', treatment.id);
    this.editTreatment.emit(treatment);
  }

  onTreatmentDetailClose(): void {
    console.log('[PatientFolderContainer] Treatment detail dialog closed');
  }

  /**
   * Pagamento registrato/annullato dalla scheda Pagamento del dettaglio:
   * aggiorna la riga corrispondente nella lista trattamenti in memoria.
   */
  onTreatmentPaymentUpdated(updated: Treatment): void {
    this.treatments = this.treatments.map(t =>
      t.id === updated.id ? { ...t, ...updated } : t
    );
    // L'incasso (o il suo annullo) su un trattamento sconto FE cambia il
    // numero di scoperti: riallinea il badge rosso "FE".
    this.loadPendingFe();
    this.cdr.markForCheck();
  }

  onEditEvaluation(): void {
    console.log('[PatientFolderContainer] Edit evaluation');
    // Questo flusso parte SEMPRE da dentro un percorso esistente (tab
    // valutazione del percorso selezionato): la valutazione va agganciata a
    // quel percorso, mai crearne uno nuovo.
    this.evaluationCreatesNewPath = false;
    this.evaluationFormMode = this.currentEvaluation ? 'edit' : 'create';

    // I dati del percorso (nome/diagnosi/note) non arrivano dalla valutazione:
    // li ricaviamo dal percorso selezionato così il "nome percorso"
    // (obbligatorio) è già compilato — sia in modifica sia quando si ricrea una
    // valutazione cancellata dentro lo stesso percorso.
    if (this.selectedPath) {
      const pathInfo = {
        nome: this.selectedPath.name || '',
        diagnosi: this.selectedPath.diagnosis ?? null,
        note: this.selectedPath.notes ?? null,
      };
      this.currentEvaluation = this.currentEvaluation
        ? { ...this.currentEvaluation, pathInfo }
        : { ...createEmptyEvaluation(this.selectedPath.id), pathInfo } as EvaluationComplete;
    }

    this.showEvaluationForm = true;
    this.cdr.markForCheck();
  }

  onDeleteEvaluation(): void {
    if (!this.currentEvaluation) return;

    const confirmed = confirm('Eliminare l\'anamnesi?\n\nQuesta azione non può essere annullata.');
    if (!confirmed) return;

    const anamnesisId = this.currentEvaluation.id;

    this.evaluationService.deleteEvaluation(anamnesisId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          if (success) {
            this.currentEvaluation = null;
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error deleting anamnesis:', err);
          alert('Errore durante l\'eliminazione dell\'anamnesi. Riprova.');
          this.cdr.markForCheck();
        }
      });
  }

  onExpandEvaluation(): void {
    console.log('[PatientFolderContainer] Expand anamnesis');
    if (this.evaluationDialog) {
      this.evaluationDialog.open();
    }
  }

  onEvaluationSaved(evaluation: EvaluationComplete): void {
    console.log('[PatientFolderContainer] Evaluation saved:', evaluation);
    // Aggiorna valutazione locale (già salvata dal form container)
    this.currentEvaluation = evaluation;
    this.showEvaluationForm = false;
    this.cdr.markForCheck();
  }

  closeEvaluationForm(): void {
    this.showEvaluationForm = false;
    this.cdr.markForCheck();
  }

  onEvaluationDialogClose(): void {
    console.log('[PatientFolderContainer] Anamnesis dialog closed');
  }

  onExpandObjectives(): void {
    console.log('[PatientFolderContainer] Expand objectives');
    if (this.objectivesDialog) {
      this.objectivesDialog.open();
    }
  }

  onObjectivesDialogClose(): void {
    console.log('[PatientFolderContainer] Objectives dialog closed');
  }

  onExpandTreatments(): void {
    console.log('[PatientFolderContainer] Expand treatments');
    if (this.treatmentsDialog) {
      this.treatmentsDialog.open();
    }
  }

  onTreatmentsDialogClose(): void {
    console.log('[PatientFolderContainer] Treatments dialog closed');
  }

  onExpandPatientAnamnesis(): void {
    console.log('[PatientFolderContainer] Expand patient anamnesis');
    if (this.patientAnamnesisDialog) {
      this.patientAnamnesisDialog.open();
    }
  }

  onPatientAnamnesisDialogClose(): void {
    console.log('[PatientFolderContainer] Patient anamnesis dialog closed');
  }

  // === Objectives Tracking Handlers ===

  onObjectiveProgressChanged(event: ObjectiveProgressChangeEvent): void {
    console.log('[PatientFolderContainer] Objective progress changed:', event);

    if (!this.selectedPath || !this.currentOperatorId) {
      console.error('[PatientFolderContainer] Missing path or operator for progress update');
      return;
    }

    // Aggiornamento ottimistico locale
    this.objectivesWithProgress = this.objectivesWithProgress.map(obj => {
      if (obj.id === event.objectiveId) {
        return {
          ...obj,
          progressLevel: event.newLevel,
          raggiunto: event.newLevel === 5,
          dataRaggiungimento: event.newLevel === 5 ? new Date() : obj.dataRaggiungimento
        };
      }
      return obj;
    });
    this.cdr.markForCheck();

    // Chiamata al backend
    this.objectivesTrackingService.updateObjectiveProgress(
      event.objectiveId,
      this.selectedPath.id,
      this.currentOperatorId,
      event.newLevel,
      event.note
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          console.log('[PatientFolderContainer] Objective progress updated:', result);
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error updating objective progress:', err);
          // Rollback: ricarica i dati
          if (this.currentEvaluation) {
            this.populateObjectivesAndTests(this.currentEvaluation);
            this.cdr.markForCheck();
          }
        }
      });
  }

  onTestEvaluationAdded(event: TestEvaluationAddedEvent): void {
    console.log('[PatientFolderContainer] Test evaluation added:', event);

    if (!this.selectedPath || !this.currentOperatorId) {
      console.error('[PatientFolderContainer] Missing path or operator for test evaluation');
      return;
    }

    // Aggiornamento ottimistico locale
    this.testsWithEvaluations = this.testsWithEvaluations.map(test => {
      if (test.id === event.testId) {
        const newEntry = {
          id: `temp-${Date.now()}`,
          evaluationLevel: event.level,
          note: event.note,
          treatmentsSinceLast: 0,
          operatorName: 'Operatore',
          createdAt: new Date()
        };
        return {
          ...test,
          currentLevel: event.level,
          evaluationHistory: [newEntry, ...(test.evaluationHistory || [])]
        };
      }
      return test;
    });
    this.cdr.markForCheck();

    // Chiamata al backend
    this.objectivesTrackingService.addTestEvaluation(
      event.testId,
      this.selectedPath.id,
      this.currentOperatorId,
      event.level,
      event.note
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          console.log('[PatientFolderContainer] Test evaluation added:', result);
          // Ricarica i dati per ottenere gli ID reali dal backend
          if (this.selectedPath) {
            this.loadAnamnesis(this.selectedPath.id);
          }
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error adding test evaluation:', err);
          // Rollback: ricarica i dati
          if (this.currentEvaluation) {
            this.populateObjectivesAndTests(this.currentEvaluation);
            this.cdr.markForCheck();
          }
        }
      });
  }

  onTestEvaluationEdited(event: TestEvaluationEditedEvent): void {
    console.log('[PatientFolderContainer] Test evaluation edited:', event);

    if (!this.currentOperatorId) {
      console.error('[PatientFolderContainer] Missing operator for test edit');
      return;
    }

    // Aggiornamento ottimistico locale - aggiorna sia currentLevel che evaluationHistory[0]
    this.testsWithEvaluations = this.testsWithEvaluations.map(test => {
      if (test.id === event.testId) {
        // Aggiorna anche la prima entry dello storico (la più recente)
        const updatedHistory = test.evaluationHistory && test.evaluationHistory.length > 0
          ? [
              { ...test.evaluationHistory[0], evaluationLevel: event.level },
              ...test.evaluationHistory.slice(1)
            ]
          : test.evaluationHistory;
        return {
          ...test,
          currentLevel: event.level,
          evaluationHistory: updatedHistory
        };
      }
      return test;
    });
    this.cdr.markForCheck();

    // Chiamata al backend
    this.objectivesTrackingService.editTestEvaluation(
      event.testId,
      event.level,
      this.currentOperatorId
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          console.log('[PatientFolderContainer] Test evaluation edited:', result);
          // L'aggiornamento ottimistico è già applicato, non serve ricaricare tutto
          // Questo evita il destroy/recreate dei componenti e il delay su "Annulla"
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error editing test evaluation:', err);
          // Rollback: ricarica i dati
          if (this.currentEvaluation) {
            this.populateObjectivesAndTests(this.currentEvaluation);
            this.cdr.markForCheck();
          }
        }
      });
  }

  /**
   * Handler per richiesta reset test - apre dialog conferma
   */
  onTestResetRequested(event: TestResetEvent): void {
    console.log('[PatientFolderContainer] Test reset requested:', event);
    const test = this.testsWithEvaluations.find(t => t.id === event.testId);
    if (test) {
      this.selectedTestForReset = test;
      this.showConfirmResetDialog = true;
      this.cdr.markForCheck();
    }
  }

  /**
   * Conferma reset test - esegue l'operazione
   */
  onConfirmReset(): void {
    if (!this.selectedTestForReset) return;

    const testId = this.selectedTestForReset.id;
    console.log('[PatientFolderContainer] Confirm reset for test:', testId);

    // Chiudi dialog
    this.showConfirmResetDialog = false;
    this.selectedTestForReset = null;

    // Aggiornamento ottimistico locale
    this.testsWithEvaluations = this.testsWithEvaluations.map(test => {
      if (test.id === testId) {
        return {
          ...test,
          currentLevel: 0,
          evaluationHistory: []
        };
      }
      return test;
    });
    this.cdr.markForCheck();

    // Chiamata al backend
    this.objectivesTrackingService.resetTestEvaluation(testId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          console.log('[PatientFolderContainer] Test reset:', result);
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error resetting test:', err);
          // Rollback: ricarica i dati
          if (this.currentEvaluation) {
            this.populateObjectivesAndTests(this.currentEvaluation);
            this.cdr.markForCheck();
          }
        }
      });
  }

  /**
   * Annulla reset test
   */
  onCancelReset(): void {
    this.showConfirmResetDialog = false;
    this.selectedTestForReset = null;
    this.cdr.markForCheck();
  }

  // === Test History Dialog Handlers ===

  /**
   * Apre il dialog storico test
   */
  onOpenTestHistory(test: TestWithEvaluations): void {
    console.log('[PatientFolderContainer] Open test history:', test.id);
    this.selectedTestForHistory = test;
    this.showTestHistoryDialog = true;
    this.cdr.markForCheck();
  }

  /**
   * Chiude il dialog storico test
   */
  onTestHistoryClosed(): void {
    this.showTestHistoryDialog = false;
    this.selectedTestForHistory = null;
    this.cdr.markForCheck();
  }

  /**
   * Handler per aggiornamento singola entry test - ricarica i dati ma NON chiude il dialog
   */
  onTestEntryUpdated(): void {
    console.log('[PatientFolderContainer] Test entry updated, reloading anamnesis');
    // Ricarica l'anamnesi per aggiornare i dati
    if (this.selectedPath) {
      this.loadAnamnesis(this.selectedPath.id);
    }
    // NON chiudere il dialog - l'operatore potrebbe voler continuare a modificare
  }

  onTestDeleted(event: TestDeleteEvent): void {
    console.log('[PatientFolderContainer] Test deleted:', event);

    // Verifica che ci sia almeno un altro test
    if (this.testsWithEvaluations.length <= 1) {
      alert('Deve restare almeno un test nella scheda anamnesi');
      return;
    }

    const confirmed = confirm('Eliminare questo test?\n\nQuesta azione non può essere annullata.');
    if (!confirmed) return;

    // Aggiornamento ottimistico locale
    this.testsWithEvaluations = this.testsWithEvaluations.filter(
      test => test.id !== event.testId
    );
    this.cdr.markForCheck();

    // Chiamata al backend
    this.objectivesTrackingService.deleteTest(event.testId, event.anamnesisId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          console.log('[PatientFolderContainer] Test deleted:', success);
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error deleting test:', err);
          // Rollback: ricarica i dati
          if (this.currentEvaluation) {
            this.populateObjectivesAndTests(this.currentEvaluation);
            this.cdr.markForCheck();
          }
        }
      });
  }

  // ==================== DOCUMENTI SCHEDA PAZIENTE ====================

  /**
   * Apre il tab Documenti dal riquadro nell'header paziente.
   * Funziona anche senza percorsi: il tab è a livello scheda paziente.
   */
  onViewDocumentsTab(): void {
    this.uiState = { ...this.uiState, activeTab: 'documents' };
    this.cdr.markForCheck();
  }

  /** Opzioni percorso per filtri/chip/dialog documenti. */
  get documentPathOptions(): PathOption[] {
    return this.paths.map((p) => ({ id: p.id, name: p.name }));
  }

  /** Opzioni trattamento (tutti i trattamenti del paziente, per percorso). */
  get documentTreatmentOptions(): TreatmentOption[] {
    return this.treatments
      .filter((t) => !!t.therapeuticPathId)
      .map((t) => ({
        id: t.id,
        therapeuticPathId: t.therapeuticPathId,
        label: `Trattamento del ${new Date(t.startedAt).toLocaleDateString('it-IT')}`,
      }));
  }

  loadPatientDocuments(): void {
    if (!this.patient?.id) return;

    this.uiState = { ...this.uiState, loadingDocuments: true };
    this.cdr.markForCheck();

    this.documentsService.getDocuments(this.patient.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (documents) => {
          this.patientDocuments = documents;
          this.uiState = { ...this.uiState, loadingDocuments: false };
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error loading documents:', err);
          this.uiState = { ...this.uiState, loadingDocuments: false };
          this.cdr.markForCheck();
        }
      });
  }

  onDocumentOpen(doc: PatientDocument): void {
    // Il blob è cifrato su S3: si apre scaricando il plaintext dal backend
    this.documentsTransfer.downloadDocument(doc.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          // Revoca ritardata: la nuova tab deve fare in tempo a caricare il blob
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error opening document:', err);
          alert('Impossibile aprire il documento');
        }
      });
  }

  onDocumentUpload(): void {
    this.showDocumentUploadDialog = true;
    this.cdr.markForCheck();
  }

  onDocumentDownload(doc: PatientDocument): void {
    this.documentsTransfer.downloadDocument(doc.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = doc.originalFileName;
          link.click();
          URL.revokeObjectURL(url);
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error downloading document:', err);
          alert('Impossibile scaricare il documento');
        }
      });
  }

  onDocumentDelete(doc: PatientDocument): void {
    if (!confirm(`Eliminare il documento "${doc.originalFileName}"?\nFinirà nel cestino e potrà essere ripristinato.`)) {
      return;
    }
    this.documentsService.deleteDocument(doc.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadPatientDocuments(),
        error: (err) => {
          console.error('[PatientFolderContainer] Error deleting document:', err);
          alert('Impossibile eliminare il documento');
        }
      });
  }

  // Helpers
  private selectPath(path: TherapeuticPath): void {
    this.selectedPath = path;
    this.uiState = {
      ...this.uiState,
      selectedPathId: path.id
    };
    // Carica l'anamnesi per questo percorso
    this.loadAnamnesis(path.id);
    this.cdr.markForCheck();
  }

  /**
   * Carica l'anamnesi per un percorso terapeutico
   */
  private loadAnamnesis(pathId: string): void {
    this.uiState = { ...this.uiState, loadingAnamnesis: true };
    this.currentEvaluation = null;
    // NON resettare gli array per evitare destroy/recreate dei componenti UI
    // durante l'aggiornamento. Gli array vengono aggiornati da populateObjectivesAndTests()
    this.cdr.markForCheck();

    // Prepara info paziente per il mapping
    const patientInfo = this.patient ? {
      nome: this.patient.nome || '',
      cognome: this.patient.cognome || '',
      eta: this.patient.dataNascita ? this.calculateAge(this.patient.dataNascita) : null,
      sesso: this.patient.genere || null
    } : undefined;

    this.evaluationService.getEvaluationByPath(pathId, patientInfo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (anamnesis) => {
          this.currentEvaluation = anamnesis;
          // Popola gli obiettivi e i test dall'anamnesi per la tab Obiettivi
          this.populateObjectivesAndTests(anamnesis);
          this.uiState = { ...this.uiState, loadingAnamnesis: false };
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error loading anamnesis:', err);
          this.currentEvaluation = null;
          this.objectivesWithProgress = [];
          this.testsWithEvaluations = [];
          this.uiState = { ...this.uiState, loadingAnamnesis: false };
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Popola gli array objectivesWithProgress e testsWithEvaluations dalla valutazione
   */
  private populateObjectivesAndTests(evaluation: EvaluationComplete | null): void {
    if (!evaluation) {
      this.objectivesWithProgress = [];
      this.testsWithEvaluations = [];
      return;
    }

    // Converti gli obiettivi della valutazione in ObjectiveWithProgress
    const allObjectives: ObjectiveWithProgress[] = [
      ...(evaluation.treatmentPlan.obiettiviBreveTermine || []).map((obj: Obiettivo) => ({
        ...obj,
        tipo: ObjectiveType.BREVE_TERMINE,
        progressLevel: obj.raggiunto ? 5 : 0,
        progressHistory: []
      })),
      ...(evaluation.treatmentPlan.obiettiviMedioTermine || []).map((obj: Obiettivo) => ({
        ...obj,
        tipo: ObjectiveType.MEDIO_TERMINE,
        progressLevel: obj.raggiunto ? 5 : 0,
        progressHistory: []
      })),
      ...(evaluation.treatmentPlan.obiettiviLungoTermine || []).map((obj: Obiettivo) => ({
        ...obj,
        tipo: ObjectiveType.LUNGO_TERMINE,
        progressLevel: obj.raggiunto ? 5 : 0,
        progressHistory: []
      }))
    ];
    this.objectivesWithProgress = allObjectives;

    // Converti i test della valutazione in TestWithEvaluations
    // I test possono venire sia dalla sezione objectiveExam che da monitoring
    const allTests = [
      ...(evaluation.objectiveExam.testSpecifici || []).map((test: TestSpecifico) => {
        const history = (test.evaluationHistory || [])
          .map((entry: TestEvaluationHistoryEntry) => ({
            id: entry.id,
            evaluationLevel: entry.evaluationLevel,
            note: entry.note,
            treatmentsSinceLast: entry.treatmentsSinceLast,
            operatorName: entry.operatorName,
            createdAt: typeof entry.createdAt === 'string' ? new Date(entry.createdAt) : entry.createdAt
          }))
          // Ordina per data decrescente: la più recente in posizione 0
          .sort((a: { createdAt: Date }, b: { createdAt: Date }) => b.createdAt.getTime() - a.createdAt.getTime());
        // currentLevel è l'ultima valutazione (la più recente) o 0
        const currentLevel = history.length > 0 ? history[0].evaluationLevel : 0;
        return {
          ...test,
          currentLevel,
          evaluationHistory: history,
          canRepeat: history.length > 0
        };
      }),
      ...(evaluation.monitoring.testSpecifici || []).map((test: TestSpecifico) => {
        const history = (test.evaluationHistory || [])
          .map((entry: TestEvaluationHistoryEntry) => ({
            id: entry.id,
            evaluationLevel: entry.evaluationLevel,
            note: entry.note,
            treatmentsSinceLast: entry.treatmentsSinceLast,
            operatorName: entry.operatorName,
            createdAt: typeof entry.createdAt === 'string' ? new Date(entry.createdAt) : entry.createdAt
          }))
          // Ordina per data decrescente: la più recente in posizione 0
          .sort((a: { createdAt: Date }, b: { createdAt: Date }) => b.createdAt.getTime() - a.createdAt.getTime());
        // currentLevel è l'ultima valutazione (la più recente) o 0
        const currentLevel = history.length > 0 ? history[0].evaluationLevel : 0;
        return {
          ...test,
          currentLevel,
          evaluationHistory: history,
          canRepeat: history.length > 0
        };
      })
    ];
    // Rimuovi duplicati basati sull'id
    const uniqueTests = allTests.filter((test, index, self) =>
      index === self.findIndex(t => t.id === test.id)
    );
    this.testsWithEvaluations = uniqueTests;
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

  getActivePathsCount(): number {
    return this.paths.filter(p => p.status?.toLowerCase() === 'active').length;
  }

  getTotalTreatmentsCount(): number {
    return this.treatments.length;
  }

  /**
   * Ricarica i trattamenti del paziente - metodo pubblico per refresh esterno.
   *
   * Ricarica anche gli scoperti sconto FE: le stesse azioni che invalidano la
   * lista (modifica trattamento, chiusura, incasso dal workspace) possono
   * accendere o spegnere il badge — p.es. spuntando o togliendo lo sconto FE
   * su un trattamento in corso.
   */
  reloadTreatments(): void {
    this.loadTreatments();
    this.loadPendingFe();
  }

  /**
   * Restituisce l'ID del percorso terapeutico selezionato
   * Usato per pre-selezionare il percorso nel dialog "Inizia Trattamento"
   */
  getSelectedPathId(): string | null {
    return this.uiState.selectedPathId;
  }

  /**
   * Filtra i trattamenti in base al percorso terapeutico selezionato
   */
  get filteredTreatments(): Treatment[] {
    if (!this.selectedPath) {
      return this.treatments;
    }
    return this.treatments.filter(t => t.therapeuticPathId === this.selectedPath!.id);
  }

  // === Patient Anamnesis Handlers ===

  /**
   * Apre il form per modificare/creare l'anamnesi paziente
   */
  onEditPatientAnamnesis(): void {
    console.log('[PatientFolderContainer] Edit patient anamnesis');
    this.showPatientAnamnesisForm = true;
    this.cdr.markForCheck();
  }

  /**
   * Elimina l'anamnesi paziente
   */
  onDeletePatientAnamnesis(): void {
    if (!this.patientAnamnesis) return;

    const confirmed = confirm('Eliminare l\'anamnesi del paziente?\n\nQuesta azione non può essere annullata.');
    if (!confirmed) return;

    const anamnesisId = this.patientAnamnesis.id;

    this.patientAnamnesisService.deleteAnamnesis(anamnesisId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          if (success) {
            this.patientAnamnesis = null;
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          console.error('[PatientFolderContainer] Error deleting patient anamnesis:', err);
          alert('Errore durante l\'eliminazione dell\'anamnesi. Riprova.');
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Callback quando l'anamnesi paziente viene salvata
   */
  onPatientAnamnesisSaved(anamnesis: PatientAnamnesis): void {
    console.log('[PatientFolderContainer] Patient anamnesis saved:', anamnesis);
    this.patientAnamnesis = anamnesis;
    this.showPatientAnamnesisForm = false;
    this.cdr.markForCheck();
  }

  /**
   * Chiude il form anamnesi paziente
   */
  closePatientAnamnesisForm(): void {
    this.showPatientAnamnesisForm = false;
    this.cdr.markForCheck();
  }
}

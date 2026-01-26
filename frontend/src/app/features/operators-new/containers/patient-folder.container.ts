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
import { Subject } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';

import { Patient } from '../../../models/patient.model';
import { TherapeuticPath, Anamnesis, PathDocument } from '../../../models/therapeutic-path.model';
import { Treatment } from '../../../models/treatment.model';
import { TherapeuticPathService } from '../../../services/therapeutic-path.service';
import { TreatmentService } from '../../../services/treatment.service';

import { PatientHeaderComponent } from '../components/patient-header/patient-header.component';
import { PathContentComponent, PathContentTab } from '../components/path-content/path-content.component';
import { PathDialogContainer } from './path-dialog.container';
import { TreatmentDetailDialogContainerComponent } from './treatment-detail-dialog.container';
import { AnamnesisFormContainer } from './anamnesis-form.container';
import { AnamnesisDialogContainer } from './anamnesis-dialog.container';
import { AnamnesisComplete } from '../models/anamnesis.model';
import { MOCK_ANAMNESIS_COMPLETE } from '../mocks/anamnesis.mock';
import {
  PatientFolderUIState,
  PatientFolderTab,
  createInitialPatientFolderUIState
} from '../models/patient-folder-state.model';
import {
  PathDialogData,
  createNewPathDialogData,
  createEditPathDialogData
} from '../models/path-dialog.model';

@Component({
  selector: 'app-patient-folder-container',
  standalone: true,
  imports: [
    CommonModule,
    PatientHeaderComponent,
    PathContentComponent,
    PathDialogContainer,
    TreatmentDetailDialogContainerComponent,
    AnamnesisFormContainer,
    AnamnesisDialogContainer
  ],
  template: `
    <div class="patient-folder" [class.no-patient]="!patient">
      <!-- Header paziente -->
      <app-patient-header
        [patient]="patient"
        [pathsCount]="paths.length"
        [activePathsCount]="getActivePathsCount()"
        [totalTreatmentsCount]="getTotalTreatmentsCount()"
        (viewDetails)="onViewPatientDetails()"
        (createPath)="onCreatePath()">
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
              [anamnesisComplete]="mockAnamnesisComplete"
              [documents]="selectedPath?.documents || []"
              [selectedTreatmentId]="uiState.selectedTreatmentId"
              [loadingTreatments]="uiState.loadingTreatments"
              [loadingAnamnesis]="uiState.loadingAnamnesis"
              [loadingDocuments]="uiState.loadingDocuments"
              (tabChange)="onTabChange($event)"
              (editPath)="onEditPath()"
              (deletePath)="onDeletePath()"
              (treatmentSelect)="onTreatmentSelect($event)"
              (treatmentDoubleClick)="onTreatmentDoubleClick($event)"
              (treatmentEdit)="onTreatmentEdit($event)"
              (editAnamnesis)="onEditAnamnesis()"
              (deleteAnamnesis)="onDeleteAnamnesis()"
              (expandAnamnesis)="onExpandAnamnesis()"
              (documentOpen)="onDocumentOpen($event)"
              (documentUpload)="onDocumentUpload()"
              (documentDownload)="onDocumentDownload($event)"
              (documentDelete)="onDocumentDelete($event)">
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

    <!-- Treatment Detail Dialog Container -->
    <app-treatment-detail-dialog-container
      #treatmentDetailDialog
      (close)="onTreatmentDetailClose()"
      (editTreatment)="onTreatmentEdit($event)">
    </app-treatment-detail-dialog-container>

    <!-- Anamnesis Form Dialog -->
    @if (showAnamnesisForm) {
      <div class="dialog-overlay">
        <app-anamnesis-form-container
          [mode]="anamnesisFormMode"
          [patient]="patient"
          [path]="selectedPath"
          [anamnesis]="mockAnamnesisComplete"
          (saved)="onAnamnesisSaved($event)"
          (close)="closeAnamnesisForm()">
        </app-anamnesis-form-container>
      </div>
    }

    <!-- Anamnesis Expand Dialog -->
    <app-anamnesis-dialog-container
      #anamnesisDialog
      [patient]="patient"
      [path]="selectedPath"
      [anamnesisComplete]="mockAnamnesisComplete"
      (edit)="onEditAnamnesis()"
      (delete)="onDeleteAnamnesis()"
      (close)="onAnamnesisDialogClose()">
    </app-anamnesis-dialog-container>
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
  @ViewChild('anamnesisDialog') anamnesisDialog!: AnamnesisDialogContainer;

  // State
  uiState: PatientFolderUIState = createInitialPatientFolderUIState();
  paths: TherapeuticPath[] = [];
  selectedPath: TherapeuticPath | null = null;
  treatments: Treatment[] = [];

  // Dialog state
  showPathDialog = false;
  pathDialogData: PathDialogData | null = null;

  // Anamnesis state
  showAnamnesisForm = false;
  anamnesisFormMode: 'create' | 'edit' = 'create';
  mockAnamnesisComplete: AnamnesisComplete | null = MOCK_ANAMNESIS_COMPLETE; // MOCK per testing

  constructor(
    private pathService: TherapeuticPathService,
    private treatmentService: TreatmentService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patient'] && this.patient) {
      // Reset immediato dello stato quando cambia il paziente
      // per evitare di mostrare dati del paziente precedente
      this.selectedPath = null;
      this.paths = [];
      this.treatments = [];
      this.uiState = { ...this.uiState, selectedPathId: null, selectedTreatmentId: null };
      this.cdr.markForCheck();

      // Poi carica i nuovi dati
      this.loadPaths();
      this.loadTreatments();
    } else if (changes['patient'] && !this.patient) {
      this.paths = [];
      this.selectedPath = null;
      this.treatments = [];
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

    this.pathService.getPathsByPatient(Number(this.patient.id))
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

    this.treatmentService.getTreatmentsByPatient(Number(this.patient.id))
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

  onCreatePath(): void {
    if (!this.patient) return;

    this.pathDialogData = createNewPathDialogData(
      Number(this.patient.id),
      this.currentOperatorId
    );
    this.showPathDialog = true;
    this.cdr.markForCheck();
  }

  onEditPath(): void {
    if (!this.patient || !this.selectedPath) return;

    this.pathDialogData = createEditPathDialogData(
      this.selectedPath,
      Number(this.patient.id),
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

  onEditAnamnesis(): void {
    console.log('[PatientFolderContainer] Edit anamnesis');
    this.anamnesisFormMode = this.mockAnamnesisComplete ? 'edit' : 'create';
    this.showAnamnesisForm = true;
    this.cdr.markForCheck();
  }

  onDeleteAnamnesis(): void {
    const confirmed = confirm('Eliminare l\'anamnesi?\n\nQuesta azione non può essere annullata.');
    if (!confirmed) return;

    console.log('[PatientFolderContainer] Delete anamnesis');
    // MOCK: Reset anamnesi
    this.mockAnamnesisComplete = null;
    this.cdr.markForCheck();
  }

  onExpandAnamnesis(): void {
    console.log('[PatientFolderContainer] Expand anamnesis');
    if (this.anamnesisDialog) {
      this.anamnesisDialog.open();
    }
  }

  onAnamnesisSaved(anamnesis: AnamnesisComplete): void {
    console.log('[PatientFolderContainer] Anamnesis saved:', anamnesis);
    // MOCK: Aggiorna anamnesi locale
    this.mockAnamnesisComplete = anamnesis;
    this.showAnamnesisForm = false;
    this.cdr.markForCheck();
  }

  closeAnamnesisForm(): void {
    this.showAnamnesisForm = false;
    this.cdr.markForCheck();
  }

  onAnamnesisDialogClose(): void {
    console.log('[PatientFolderContainer] Anamnesis dialog closed');
  }

  onDocumentOpen(doc: PathDocument): void {
    // Apri documento in nuova tab
    if (doc.url) {
      window.open(doc.url, '_blank');
    }
  }

  onDocumentUpload(): void {
    // TODO: Aprire dialog per upload documento
    console.log('[PatientFolderContainer] Upload document');
  }

  onDocumentDownload(doc: PathDocument): void {
    // Scarica documento
    if (doc.url) {
      const link = document.createElement('a');
      link.href = doc.url;
      link.download = doc.name;
      link.click();
    }
  }

  onDocumentDelete(doc: PathDocument): void {
    if (confirm(`Eliminare il documento "${doc.name}"?`)) {
      // TODO: Implementare eliminazione
      console.log('[PatientFolderContainer] Delete document:', doc.id);
    }
  }

  // Helpers
  private selectPath(path: TherapeuticPath): void {
    this.selectedPath = path;
    this.uiState = {
      ...this.uiState,
      selectedPathId: path.id
    };
    this.cdr.markForCheck();
  }

  getActivePathsCount(): number {
    return this.paths.filter(p => p.status?.toLowerCase() === 'active').length;
  }

  getTotalTreatmentsCount(): number {
    return this.treatments.length;
  }

  /**
   * Ricarica i trattamenti del paziente - metodo pubblico per refresh esterno
   */
  reloadTreatments(): void {
    this.loadTreatments();
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
}

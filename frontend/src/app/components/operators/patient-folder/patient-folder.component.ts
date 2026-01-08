import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Patient } from '../../../models/patient.model';
import { TherapeuticPath } from '../../../models/therapeutic-path.model';
import { TherapeuticPathTimelineComponent } from '../therapeutic-path-timeline/therapeutic-path-timeline.component';
import { TherapeuticPathAccordionComponent } from '../therapeutic-path-accordion/therapeutic-path-accordion.component';
import {
  TherapeuticPathDialogComponent,
  TherapeuticPathDialogData,
  TherapeuticPathFormResult
} from '../therapeutic-path-dialog/therapeutic-path-dialog.component';
import { TherapeuticPathService, CreateTherapeuticPathInput, UpdateTherapeuticPathInput } from '../../../services/therapeutic-path.service';
import { ConfirmDialogComponent } from '../../calendar-cdk/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-patient-folder',
  standalone: true,
  imports: [
    CommonModule,
    TherapeuticPathTimelineComponent,
    TherapeuticPathAccordionComponent,
    TherapeuticPathDialogComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './patient-folder.component.html',
  styleUrls: ['./patient-folder.component.scss'],
})
export class PatientFolderComponent implements OnChanges {
  @Input() patient: Patient | null = null;
  @Input() paths: TherapeuticPath[] = [];
  @Input() loading = false;
  @Input() currentOperatorId: string | null = null;

  @Output() pathSelect = new EventEmitter<TherapeuticPath>();
  @Output() viewPatientDetails = new EventEmitter<Patient>();
  @Output() pathCreated = new EventEmitter<TherapeuticPath>();
  @Output() pathUpdated = new EventEmitter<TherapeuticPath>();
  @Output() pathDeleted = new EventEmitter<string>();

  // Local state
  selectedPath: TherapeuticPath | null = null;
  expandedPathId: string | null = null;

  // Dialog state
  showPathDialog = false;
  pathDialogData: TherapeuticPathDialogData | null = null;
  showDeleteConfirm = false;
  pathToDelete: TherapeuticPath | null = null;
  savingPath = false;

  constructor(private therapeuticPathService: TherapeuticPathService) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Auto-select first active path when paths change
    if (changes['paths'] && this.paths.length > 0) {
      const activePath = this.paths.find((p) => p.status === 'active');
      if (activePath) {
        this.onPathSelect(activePath);
      } else {
        this.onPathSelect(this.paths[0]);
      }
    }
  }

  onPathSelect(path: TherapeuticPath): void {
    this.selectedPath = path;
    this.expandedPathId = path.id;
    this.pathSelect.emit(path);
  }

  onViewPatientDetails(): void {
    if (this.patient) {
      this.viewPatientDetails.emit(this.patient);
    }
  }

  togglePathExpanded(pathId: string): void {
    this.expandedPathId = this.expandedPathId === pathId ? null : pathId;
  }

  isPathExpanded(pathId: string): boolean {
    return this.expandedPathId === pathId;
  }

  isPathSelected(pathId: string): boolean {
    return this.selectedPath?.id === pathId;
  }

  // Patient helpers
  getPatientName(): string {
    if (!this.patient) return '';
    return `${this.patient.nome} ${this.patient.cognome}`;
  }

  getPatientInitials(): string {
    if (!this.patient) return '?';
    return ((this.patient.nome?.charAt(0) || '') + (this.patient.cognome?.charAt(0) || '')).toUpperCase();
  }

  getPatientAge(): number | null {
    if (!this.patient?.dataNascita) return null;
    const birth = new Date(this.patient.dataNascita);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  getPatientPhone(): string {
    if (!this.patient) return '';
    return this.patient.cellulare || this.patient.telefono || '';
  }

  getPatientEmail(): string {
    return this.patient?.email || '';
  }

  // Path stats
  get activePathsCount(): number {
    return this.paths.filter((p) => p.status === 'active').length;
  }

  get completedPathsCount(): number {
    return this.paths.filter((p) => p.status === 'completed').length;
  }

  get totalTreatmentsCount(): number {
    return this.paths.reduce((sum, p) => sum + (p.treatments?.length || 0), 0);
  }

  // ==================== CRUD Operations ====================

  openNewPathDialog(): void {
    if (!this.patient) return;

    this.pathDialogData = {
      mode: 'create',
      patientId: this.patient.id,
      currentOperatorId: this.currentOperatorId || undefined
    };
    this.showPathDialog = true;
  }

  openEditPathDialog(path: TherapeuticPath): void {
    if (!this.patient) return;

    this.pathDialogData = {
      mode: 'edit',
      path: path,
      patientId: this.patient.id,
      currentOperatorId: this.currentOperatorId || undefined
    };
    this.showPathDialog = true;
  }

  onPathDialogSave(result: TherapeuticPathFormResult): void {
    if (!this.patient || !this.pathDialogData) return;

    this.savingPath = true;

    if (this.pathDialogData.mode === 'create') {
      const input: CreateTherapeuticPathInput = {
        patientId: Number(this.patient.id),
        primaryOperatorId: result.primaryOperatorId,
        name: result.name,
        diagnosis: result.diagnosis,
        icdCode: result.icdCode,
        externalDoctorName: result.externalDoctorName,
        externalPrescriptionRef: result.externalPrescriptionRef,
        notes: result.notes
      };

      this.therapeuticPathService.createPath(input).subscribe({
        next: (newPath) => {
          this.savingPath = false;
          this.showPathDialog = false;
          this.pathDialogData = null;
          this.pathCreated.emit(newPath);
          // Select the new path
          this.onPathSelect(newPath);
        },
        error: (error) => {
          console.error('Error creating path:', error);
          this.savingPath = false;
          // TODO: Show error toast
        }
      });
    } else if (this.pathDialogData.mode === 'edit' && this.pathDialogData.path) {
      const input: UpdateTherapeuticPathInput = {
        name: result.name,
        diagnosis: result.diagnosis,
        icdCode: result.icdCode,
        externalDoctorName: result.externalDoctorName,
        externalPrescriptionRef: result.externalPrescriptionRef,
        notes: result.notes,
        status: result.status
      };

      this.therapeuticPathService.updatePath(this.pathDialogData.path.id, input).subscribe({
        next: (updatedPath) => {
          this.savingPath = false;
          this.showPathDialog = false;
          this.pathDialogData = null;
          this.pathUpdated.emit(updatedPath);
        },
        error: (error) => {
          console.error('Error updating path:', error);
          this.savingPath = false;
          // TODO: Show error toast
        }
      });
    }
  }

  onPathDialogCancel(): void {
    this.showPathDialog = false;
    this.pathDialogData = null;
  }

  confirmDeletePath(path: TherapeuticPath): void {
    this.pathToDelete = path;
    this.showDeleteConfirm = true;
  }

  onDeleteConfirm(): void {
    if (!this.pathToDelete) return;

    const pathId = this.pathToDelete.id;
    this.therapeuticPathService.deletePath(pathId).subscribe({
      next: () => {
        this.showDeleteConfirm = false;
        this.pathToDelete = null;
        this.pathDeleted.emit(pathId);

        // If we deleted the selected path, clear selection
        if (this.selectedPath?.id === pathId) {
          this.selectedPath = null;
          this.expandedPathId = null;
        }
      },
      error: (error) => {
        console.error('Error deleting path:', error);
        this.showDeleteConfirm = false;
        this.pathToDelete = null;
        // TODO: Show error toast
      }
    });
  }

  onDeleteCancel(): void {
    this.showDeleteConfirm = false;
    this.pathToDelete = null;
  }
}

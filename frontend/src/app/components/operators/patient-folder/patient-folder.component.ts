import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Patient } from '../../../models/patient.model';
import { TherapeuticPath } from '../../../models/therapeutic-path.model';
import { TherapeuticPathTimelineComponent } from '../therapeutic-path-timeline/therapeutic-path-timeline.component';
import { TherapeuticPathAccordionComponent } from '../therapeutic-path-accordion/therapeutic-path-accordion.component';

@Component({
  selector: 'app-patient-folder',
  standalone: true,
  imports: [CommonModule, TherapeuticPathTimelineComponent, TherapeuticPathAccordionComponent],
  templateUrl: './patient-folder.component.html',
  styleUrls: ['./patient-folder.component.scss'],
})
export class PatientFolderComponent implements OnChanges {
  @Input() patient: Patient | null = null;
  @Input() paths: TherapeuticPath[] = [];
  @Input() loading = false;

  @Output() pathSelect = new EventEmitter<TherapeuticPath>();
  @Output() viewPatientDetails = new EventEmitter<Patient>();

  // Local state
  selectedPath: TherapeuticPath | null = null;
  expandedPathId: string | null = null;

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
}

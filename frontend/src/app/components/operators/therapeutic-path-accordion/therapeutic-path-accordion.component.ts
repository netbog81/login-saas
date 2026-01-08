import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  TherapeuticPath,
  PathTreatment,
  getPathStatusLabel,
  getPathStatusColor,
  formatPathProgress,
  getPathProgressPercentage,
  formatFileSize,
} from '../../../models/therapeutic-path.model';
import { TreatmentHistoryItemComponent } from '../treatment-history-item/treatment-history-item.component';

@Component({
  selector: 'app-therapeutic-path-accordion',
  standalone: true,
  imports: [CommonModule, TreatmentHistoryItemComponent],
  templateUrl: './therapeutic-path-accordion.component.html',
  styleUrls: ['./therapeutic-path-accordion.component.scss'],
})
export class TherapeuticPathAccordionComponent {
  @Input() path!: TherapeuticPath;
  @Input() expanded = false;
  @Input() selected = false;

  @Output() toggleExpand = new EventEmitter<void>();
  @Output() selectPath = new EventEmitter<TherapeuticPath>();
  @Output() viewAnamnesis = new EventEmitter<TherapeuticPath>();
  @Output() viewDocuments = new EventEmitter<TherapeuticPath>();
  @Output() editPath = new EventEmitter<TherapeuticPath>();
  @Output() deletePath = new EventEmitter<TherapeuticPath>();

  // Local state
  activeTab: 'treatments' | 'anamnesis' | 'documents' = 'treatments';
  expandedTreatmentId: string | null = null;

  onToggleExpand(): void {
    this.toggleExpand.emit();
  }

  onSelectPath(): void {
    this.selectPath.emit(this.path);
  }

  onViewAnamnesis(): void {
    this.viewAnamnesis.emit(this.path);
  }

  onViewDocuments(): void {
    this.viewDocuments.emit(this.path);
  }

  onEditPath(event: Event): void {
    event.stopPropagation();
    this.editPath.emit(this.path);
  }

  onDeletePath(event: Event): void {
    event.stopPropagation();
    this.deletePath.emit(this.path);
  }

  setActiveTab(tab: 'treatments' | 'anamnesis' | 'documents'): void {
    this.activeTab = tab;
  }

  toggleTreatmentExpand(treatmentId: string): void {
    this.expandedTreatmentId = this.expandedTreatmentId === treatmentId ? null : treatmentId;
  }

  isTreatmentExpanded(treatmentId: string): boolean {
    return this.expandedTreatmentId === treatmentId;
  }

  // Helper methods
  getStatusLabel(): string {
    return getPathStatusLabel(this.path.status);
  }

  getStatusColor(): string {
    return getPathStatusColor(this.path.status);
  }

  getProgress(): string {
    return formatPathProgress(this.path);
  }

  getProgressPercentage(): number {
    return getPathProgressPercentage(this.path);
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  formatFileSize(bytes: number): string {
    return formatFileSize(bytes);
  }

  get sortedTreatments(): PathTreatment[] {
    if (!this.path.treatments) return [];
    return [...this.path.treatments].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  get treatmentsCount(): number {
    return this.path.treatments?.length || 0;
  }

  get documentsCount(): number {
    return this.path.documents?.length || 0;
  }

  hasAnamnesis(): boolean {
    return !!this.path.anamnesis;
  }

  getDocumentTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      pdf: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
      image: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
      video: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
      other: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    };
    return icons[type] || icons['other'];
  }
}

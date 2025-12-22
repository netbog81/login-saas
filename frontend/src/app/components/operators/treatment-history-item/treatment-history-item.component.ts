import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PathTreatment, getTreatmentTypeLabel, getTreatmentTypeColor } from '../../../models/therapeutic-path.model';

@Component({
  selector: 'app-treatment-history-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './treatment-history-item.component.html',
  styleUrls: ['./treatment-history-item.component.scss'],
})
export class TreatmentHistoryItemComponent {
  @Input() treatment!: PathTreatment;
  @Input() expanded = false;
  @Input() isFirst = false;
  @Input() isLast = false;

  @Output() toggleExpand = new EventEmitter<void>();
  @Output() viewDetails = new EventEmitter<PathTreatment>();

  onToggleExpand(): void {
    this.toggleExpand.emit();
  }

  onViewDetails(): void {
    this.viewDetails.emit(this.treatment);
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  formatTime(time: string | undefined): string {
    return time?.substring(0, 5) || '';
  }

  getTypeLabel(): string {
    return getTreatmentTypeLabel(this.treatment.type);
  }

  getTypeColor(): string {
    return getTreatmentTypeColor(this.treatment.type);
  }

  hasInstruments(): boolean {
    return !!(this.treatment.instrumentsUsed && this.treatment.instrumentsUsed.length > 0);
  }

  hasPainScores(): boolean {
    return this.treatment.painScaleBefore !== undefined || this.treatment.painScaleAfter !== undefined;
  }

  getPainDifference(): number | null {
    if (this.treatment.painScaleBefore !== undefined && this.treatment.painScaleAfter !== undefined) {
      return this.treatment.painScaleBefore - this.treatment.painScaleAfter;
    }
    return null;
  }

  getPainDifferenceClass(): string {
    const diff = this.getPainDifference();
    if (diff === null) return '';
    if (diff > 0) return 'improved';
    if (diff < 0) return 'worsened';
    return 'unchanged';
  }
}

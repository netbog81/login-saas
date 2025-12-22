import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TherapeuticPath, getPathStatusColor, getPathStatusLabel } from '../../../models/therapeutic-path.model';

@Component({
  selector: 'app-therapeutic-path-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './therapeutic-path-timeline.component.html',
  styleUrls: ['./therapeutic-path-timeline.component.scss'],
})
export class TherapeuticPathTimelineComponent {
  @Input() paths: TherapeuticPath[] = [];
  @Input() selectedPathId: string | null = null;
  @Input() loading = false;

  @Output() pathSelect = new EventEmitter<TherapeuticPath>();

  onPathSelect(path: TherapeuticPath): void {
    this.pathSelect.emit(path);
  }

  isSelected(path: TherapeuticPath): boolean {
    return this.selectedPathId === path.id;
  }

  getStatusColor(path: TherapeuticPath): string {
    return getPathStatusColor(path.status);
  }

  getStatusLabel(path: TherapeuticPath): string {
    return getPathStatusLabel(path.status);
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
    });
  }

  getYear(date: Date | string): string {
    return new Date(date).getFullYear().toString();
  }

  get sortedPaths(): TherapeuticPath[] {
    return [...this.paths].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
  }

  get pathsByYear(): Map<string, TherapeuticPath[]> {
    const grouped = new Map<string, TherapeuticPath[]>();
    for (const path of this.sortedPaths) {
      const year = this.getYear(path.startDate);
      if (!grouped.has(year)) {
        grouped.set(year, []);
      }
      grouped.get(year)!.push(path);
    }
    return grouped;
  }

  get years(): string[] {
    return Array.from(this.pathsByYear.keys());
  }

  getPathsForYear(year: string): TherapeuticPath[] {
    return this.pathsByYear.get(year) || [];
  }
}

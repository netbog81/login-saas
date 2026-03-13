import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WaitingListEntry, UpdateWaitingListEntryInput } from '../../../../models/waiting-list.model';
import { WaitingListOperator } from '../waiting-list-form/waiting-list-form.component';

@Component({
  selector: 'app-waiting-list-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSliderModule,
    MatTooltipModule,
  ],
  templateUrl: './waiting-list-card.component.html',
  styleUrls: ['./waiting-list-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaitingListCardComponent {
  @Input() entry!: WaitingListEntry;
  @Input() operators: WaitingListOperator[] = [];
  @Output() update = new EventEmitter<{ id: string; changes: UpdateWaitingListEntryInput }>();
  @Output() delete = new EventEmitter<string>();

  editing = false;
  confirmingDelete = false;

  // Edit fields
  editPatientName = '';
  editPhone = '';
  editOperatorId: string | null = null;
  editNotes = '';
  editPriority = 1;

  get displayName(): string {
    return this.entry.patientName;
  }

  get operatorName(): string {
    if (this.entry.operator) {
      return `${this.entry.operator.name} ${this.entry.operator.surname || ''}`.trim();
    }
    return '';
  }

  get priorityColor(): string {
    return this.getPriorityColorValue(this.entry.priority);
  }

  get editPriorityColor(): string {
    return this.getPriorityColorValue(this.editPriority);
  }

  private getPriorityColorValue(priority: number): string {
    const colors: Record<number, string> = {
      1: '#4caf50',
      2: '#8bc34a',
      3: '#ffc107',
      4: '#ff9800',
      5: '#f44336',
    };
    return colors[priority] || '#9e9e9e';
  }

  startEdit(): void {
    this.editPatientName = this.entry.patientName;
    this.editPhone = this.entry.phone || '';
    this.editOperatorId = this.entry.operatorId;
    this.editNotes = this.entry.notes || '';
    this.editPriority = this.entry.priority;
    this.editing = true;
    this.confirmingDelete = false;
  }

  cancelEdit(): void {
    this.editing = false;
  }

  saveEdit(): void {
    const changes: UpdateWaitingListEntryInput = {
      patientName: this.editPatientName,
      phone: this.editPhone || undefined,
      operatorId: this.editOperatorId,
      notes: this.editNotes || undefined,
      priority: this.editPriority,
    };
    this.update.emit({ id: this.entry.id, changes });
    this.editing = false;
  }

  onDeleteClick(): void {
    this.confirmingDelete = true;
  }

  confirmDelete(): void {
    this.delete.emit(this.entry.id);
    this.confirmingDelete = false;
  }

  cancelDelete(): void {
    this.confirmingDelete = false;
  }
}

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface WorkingHoursDialogData {
  workingHoursStart: number;
  workingHoursEnd: number;
}

export interface WorkingHoursDialogResult {
  action: 'save' | 'cancel';
  workingHoursStart?: number;
  workingHoursEnd?: number;
}

@Component({
  selector: 'app-working-hours-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './working-hours-dialog.component.html',
  styleUrls: ['./working-hours-dialog.component.scss']
})
export class WorkingHoursDialogComponent implements OnInit {
  @Input() data!: WorkingHoursDialogData;
  @Output() result = new EventEmitter<WorkingHoursDialogResult>();

  // Local form values
  startHour: number = 8;
  endHour: number = 20;

  // Available hours for selection
  availableHours: number[] = [];

  ngOnInit(): void {
    // Initialize hours array (0-23)
    this.availableHours = Array.from({ length: 24 }, (_, i) => i);

    // Set initial values from input data
    if (this.data) {
      this.startHour = this.data.workingHoursStart;
      this.endHour = this.data.workingHoursEnd;
    }
  }

  formatHour(hour: number): string {
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  onSave(): void {
    // Validate that end hour is after start hour
    if (this.endHour <= this.startHour) {
      alert('L\'orario di fine deve essere successivo all\'orario di inizio');
      return;
    }

    this.result.emit({
      action: 'save',
      workingHoursStart: this.startHour,
      workingHoursEnd: this.endHour
    });
  }

  onCancel(): void {
    this.result.emit({ action: 'cancel' });
  }
}
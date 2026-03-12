import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import {
  WhatsappLogFilter,
  WhatsappMessageStatus,
  WhatsappMessageType,
  MESSAGE_STATUS_LABELS,
  MESSAGE_TYPE_LABELS,
} from '../../models/whatsapp.models';

@Component({
  selector: 'app-message-filter',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  template: `
    <div class="filter-bar">
      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Paziente</mat-label>
        <input matInput [(ngModel)]="patientName" placeholder="Nome paziente..." />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Stato</mat-label>
        <mat-select [(ngModel)]="status">
          <mat-option [value]="null">Tutti</mat-option>
          @for (s of statusOptions; track s.value) {
            <mat-option [value]="s.value">{{ s.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Tipo</mat-label>
        <mat-select [(ngModel)]="messageType">
          <mat-option [value]="null">Tutti</mat-option>
          @for (t of typeOptions; track t.value) {
            <mat-option [value]="t.value">{{ t.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Data da</mat-label>
        <input matInput [matDatepicker]="pickerFrom" [(ngModel)]="dateFrom" />
        <mat-datepicker-toggle matIconSuffix [for]="pickerFrom"></mat-datepicker-toggle>
        <mat-datepicker #pickerFrom></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Data a</mat-label>
        <input matInput [matDatepicker]="pickerTo" [(ngModel)]="dateTo" />
        <mat-datepicker-toggle matIconSuffix [for]="pickerTo"></mat-datepicker-toggle>
        <mat-datepicker #pickerTo></mat-datepicker>
      </mat-form-field>

      <div class="filter-actions">
        <button mat-raised-button color="primary" (click)="onSearch()">
          <mat-icon>search</mat-icon>
          Cerca
        </button>
        <button mat-button (click)="onReset()">
          <mat-icon>clear</mat-icon>
          Reset
        </button>
      </div>
    </div>
  `,
  styles: [`
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .filter-field {
      flex: 1;
      min-width: 150px;
      max-width: 220px;
    }

    .filter-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      padding-top: 4px;
    }

    @media (max-width: 768px) {
      .filter-bar {
        flex-direction: column;
      }

      .filter-field {
        max-width: 100%;
        width: 100%;
      }

      .filter-actions {
        width: 100%;
        justify-content: flex-end;
      }
    }
  `],
})
export class MessageFilterComponent {
  @Output() search = new EventEmitter<WhatsappLogFilter>();
  @Output() reset = new EventEmitter<void>();

  patientName = '';
  status: WhatsappMessageStatus | null = null;
  messageType: WhatsappMessageType | null = null;
  dateFrom: Date | null = null;
  dateTo: Date | null = null;

  statusOptions = Object.entries(MESSAGE_STATUS_LABELS).map(([value, label]) => ({
    value: value as WhatsappMessageStatus,
    label,
  }));

  typeOptions = Object.entries(MESSAGE_TYPE_LABELS).map(([value, label]) => ({
    value: value as WhatsappMessageType,
    label,
  }));

  onSearch(): void {
    const filter: WhatsappLogFilter = {
      page: 1,
      limit: 50,
    };

    if (this.patientName) filter.patientName = this.patientName;
    if (this.status) filter.status = this.status;
    if (this.messageType) filter.messageType = this.messageType;
    if (this.dateFrom) filter.dateFrom = this.dateFrom.toISOString();
    if (this.dateTo) filter.dateTo = this.dateTo.toISOString();

    this.search.emit(filter);
  }

  onReset(): void {
    this.patientName = '';
    this.status = null;
    this.messageType = null;
    this.dateFrom = null;
    this.dateTo = null;
    this.reset.emit();
  }
}

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatSliderModule } from '@angular/material/slider';
import { Patient } from '../../../../models/patient.model';
import { CreateWaitingListEntryInput } from '../../../../models/waiting-list.model';

export interface WaitingListOperator {
  id: string;
  name: string;
  surname?: string;
  color?: string;
}

@Component({
  selector: 'app-waiting-list-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatAutocompleteModule,
    MatSliderModule,
  ],
  templateUrl: './waiting-list-form.component.html',
  styleUrls: ['./waiting-list-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaitingListFormComponent implements OnInit {
  @Input() patients: Patient[] = [];
  @Input() operators: WaitingListOperator[] = [];
  @Output() addEntry = new EventEmitter<CreateWaitingListEntryInput>();
  @Output() patientSearch = new EventEmitter<string>();

  form!: FormGroup;
  selectedPatient: Patient | null = null;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      patientName: ['', Validators.required],
      phone: [''],
      operatorId: [null],
      notes: [''],
      priority: [1],
    });
  }

  onPatientInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.selectedPatient = null;
    if (value && value.length >= 2) {
      this.patientSearch.emit(value);
    }
  }

  onPatientSelected(event: MatAutocompleteSelectedEvent): void {
    const patient = event.option.value as Patient;
    this.selectedPatient = patient;
    this.form.patchValue({
      patientName: patient.nomeCompleto || `${patient.nome} ${patient.cognome}`,
      phone: patient.cellulare || patient.telefono || '',
    });
  }

  displayPatient(patient: Patient | string | null | undefined): string {
    if (!patient) return '';
    if (typeof patient === 'string') return patient;
    return patient.nomeCompleto || `${patient.nome || ''} ${patient.cognome || ''}`.trim() || '';
  }

  get priorityColor(): string {
    const priority = this.form?.get('priority')?.value ?? 1;
    const colors: Record<number, string> = {
      1: '#4caf50',
      2: '#8bc34a',
      3: '#ffc107',
      4: '#ff9800',
      5: '#f44336',
    };
    return colors[priority] || '#9e9e9e';
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const formValue = this.form.value;
    const input: CreateWaitingListEntryInput = {
      patientName: typeof formValue.patientName === 'string'
        ? formValue.patientName
        : this.displayPatient(formValue.patientName),
      phone: formValue.phone || undefined,
      operatorId: formValue.operatorId || undefined,
      notes: formValue.notes || undefined,
      priority: formValue.priority,
    };

    if (this.selectedPatient) {
      input.patientId = this.selectedPatient.id;
    }

    this.addEntry.emit(input);
    this.resetForm();
  }

  private resetForm(): void {
    this.form.reset({ patientName: '', phone: '', notes: '', operatorId: null, priority: 1 });
    this.selectedPatient = null;
  }

  getPriorityLabel(value: number): string {
    const labels: Record<number, string> = {
      1: 'Bassa',
      2: 'Medio-bassa',
      3: 'Media',
      4: 'Medio-alta',
      5: 'Alta',
    };
    return labels[value] || '';
  }
}

/**
 * Patient Anamnesis Form Container
 * Layer 2: Smart Component - Container per il form anamnesi paziente
 *
 * Responsabilità:
 * - Gestire stato del form (salvataggio, errori)
 * - Comunicare con SimplePatientAnamnesisService
 * - Emettere eventi di successo/chiusura
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';

// Component
import { PatientAnamnesisFormComponent } from '../components/patient-anamnesis-form/patient-anamnesis-form.component';

// Service
import { SimplePatientAnamnesisService } from '../../../services/simple-patient-anamnesis.service';

// Models
import { PatientAnamnesis } from '../models/patient-anamnesis.model';

@Component({
  selector: 'app-patient-anamnesis-form-container',
  standalone: true,
  imports: [
    CommonModule,
    PatientAnamnesisFormComponent
  ],
  template: `
    <app-patient-anamnesis-form
      [anamnesis]="anamnesis"
      [patientId]="patientId"
      [saving]="saving"
      (save)="onSave($event)"
      (cancel)="onCancel()">
    </app-patient-anamnesis-form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientAnamnesisFormContainer {
  @Input() anamnesis: PatientAnamnesis | null = null;
  @Input() patientId: string = '';
  @Input() operatorId: string | null = null;

  @Output() saved = new EventEmitter<PatientAnamnesis>();
  @Output() close = new EventEmitter<void>();

  saving = false;

  constructor(
    private patientAnamnesisService: SimplePatientAnamnesisService,
    private cdr: ChangeDetectorRef
  ) {}

  onSave(data: Partial<PatientAnamnesis>): void {
    if (!this.patientId) {
      console.error('PatientId is required');
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    // Prepara input per service
    const input = this.patientAnamnesisService.mapToUpdateInput(
      data,
      this.operatorId ?? undefined
    );

    // Usa upsert per creare o aggiornare
    this.patientAnamnesisService.upsertAnamnesis(this.patientId, input).subscribe({
      next: (result) => {
        this.saving = false;
        this.saved.emit(result);
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error saving patient anamnesis:', error);
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  onCancel(): void {
    this.close.emit();
  }
}

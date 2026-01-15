import { Component, EventEmitter, Input, OnInit, Output, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OperatorService } from '../../../services/operator.service';
import { TherapeuticPath, PathStatus } from '../../../models/therapeutic-path.model';

interface Operator {
  id: string;
  firstName: string;
  lastName: string;
}

export interface TherapeuticPathDialogData {
  mode: 'create' | 'edit';
  path?: TherapeuticPath;
  patientId: number;
  currentOperatorId?: string;
}

export interface TherapeuticPathFormResult {
  primaryOperatorId: string;
  name: string;
  diagnosis?: string;
  icdCode?: string;
  externalDoctorName?: string;
  externalPrescriptionRef?: string;
  notes?: string;
  status?: PathStatus;
}

@Component({
  selector: 'app-therapeutic-path-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './therapeutic-path-dialog.component.html',
  styleUrl: './therapeutic-path-dialog.component.scss'
})
export class TherapeuticPathDialogComponent implements OnInit, OnDestroy {
  @Input() data!: TherapeuticPathDialogData;
  @Output() save = new EventEmitter<TherapeuticPathFormResult>();
  @Output() cancel = new EventEmitter<void>();

  form!: FormGroup;
  operators: Operator[] = [];
  loadingOperators = false;
  saving = false;

  private destroy$ = new Subject<void>();

  // Status options for edit mode
  statusOptions: { value: PathStatus; label: string }[] = [
    { value: 'active', label: 'Attivo' },
    { value: 'suspended', label: 'Sospeso' },
    { value: 'completed', label: 'Completato' },
    { value: 'archived', label: 'Archiviato' }
  ];

  // Overlay click tracking (per evitare chiusura durante click-and-drag)
  overlayMouseDownTarget: EventTarget | null = null;

  onOverlayMouseDown(event: MouseEvent): void {
    this.overlayMouseDownTarget = event.target;
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.overlayMouseDownTarget === event.currentTarget &&
        event.target === event.currentTarget) {
      this.onCancel();
    }
    this.overlayMouseDownTarget = null;
  }

  constructor(
    private fb: FormBuilder,
    private operatorService: OperatorService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadOperators();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    const isEdit = this.data.mode === 'edit';
    const path = this.data.path;

    this.form = this.fb.group({
      primaryOperatorId: [
        isEdit ? path?.primaryOperatorId : this.data.currentOperatorId || '',
        Validators.required
      ],
      name: [isEdit ? path?.name : '', Validators.required],
      diagnosis: [isEdit ? path?.diagnosis : ''],
      icdCode: [isEdit ? path?.icdCode : ''],
      externalDoctorName: [isEdit ? (path as any)?.externalDoctorName : ''],
      externalPrescriptionRef: [isEdit ? (path as any)?.externalPrescriptionRef : ''],
      notes: [isEdit ? path?.notes : ''],
      status: [isEdit ? path?.status : 'active']
    });
  }

  private loadOperators(): void {
    this.loadingOperators = true;
    this.operatorService.getOperators(undefined, undefined, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (operators) => {
          this.operators = operators.map(op => ({
            id: op.id,
            firstName: op.name || '',
            lastName: op.surname || ''
          }));
          this.loadingOperators = false;
        },
        error: (error) => {
          console.error('Error loading operators:', error);
          this.loadingOperators = false;
        }
      });
  }

  get isEditMode(): boolean {
    return this.data.mode === 'edit';
  }

  get dialogTitle(): string {
    return this.isEditMode ? 'Modifica Percorso Terapeutico' : 'Nuovo Percorso Terapeutico';
  }

  getOperatorDisplayName(operator: Operator): string {
    return `${operator.lastName} ${operator.firstName}`.trim();
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving) {
      this.markFormTouched();
      return;
    }

    this.saving = true;
    const formValue = this.form.value;

    const result: TherapeuticPathFormResult = {
      primaryOperatorId: formValue.primaryOperatorId,
      name: formValue.name.trim(),
      diagnosis: formValue.diagnosis?.trim() || undefined,
      icdCode: formValue.icdCode?.trim() || undefined,
      externalDoctorName: formValue.externalDoctorName?.trim() || undefined,
      externalPrescriptionRef: formValue.externalPrescriptionRef?.trim() || undefined,
      notes: formValue.notes?.trim() || undefined,
      status: this.isEditMode ? formValue.status : undefined
    };

    this.save.emit(result);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  private markFormTouched(): void {
    Object.keys(this.form.controls).forEach(key => {
      this.form.get(key)?.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.form.get(fieldName);
    if (field?.errors?.['required']) {
      return 'Campo obbligatorio';
    }
    return '';
  }
}

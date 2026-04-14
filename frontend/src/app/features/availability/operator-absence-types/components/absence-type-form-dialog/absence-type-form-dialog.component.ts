import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { OperatorAbsenceType } from '../../models/operator-absence-type.model';

export interface AbsenceTypeFormDialogData {
  absenceType?: OperatorAbsenceType;
}

export interface AbsenceTypeFormDialogResult {
  name: string;
  description?: string;
  isActive?: boolean;
}

/**
 * Dialog Angular Material per creazione/modifica di un OperatorAbsenceType.
 *
 * Layer 1 (dumb) — riceve l'item via MAT_DIALOG_DATA (assente in create mode)
 * e chiude ritornando i dati del form al container chiamante, che si occupa
 * della chiamata al service.
 */
@Component({
  selector: 'app-absence-type-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ isEditMode ? 'Modifica tipo di assenza' : 'Nuovo tipo di assenza' }}
    </h2>

    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nome</mat-label>
          <input matInput formControlName="name" placeholder="Es: Ferie, Malattia, Permesso" required />
          <mat-error *ngIf="form.get('name')?.hasError('required')">
            Il nome è obbligatorio
          </mat-error>
          <mat-error *ngIf="form.get('name')?.hasError('maxlength')">
            Il nome può contenere al massimo 255 caratteri
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Descrizione</mat-label>
          <textarea
            matInput
            formControlName="description"
            rows="3"
            placeholder="Descrizione opzionale"
          ></textarea>
        </mat-form-field>

        <mat-checkbox *ngIf="isEditMode" formControlName="isActive">Attivo</mat-checkbox>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="onCancel()">Annulla</button>
        <button
          mat-flat-button
          color="primary"
          type="submit"
          [disabled]="form.invalid"
        >
          {{ isEditMode ? 'Salva modifiche' : 'Crea' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
        display: block;
      }
      mat-dialog-content {
        min-width: 360px;
      }
      mat-checkbox {
        margin-top: 8px;
      }
    `,
  ],
})
export class AbsenceTypeFormDialogComponent {
  form: FormGroup;
  isEditMode: boolean;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AbsenceTypeFormDialogComponent, AbsenceTypeFormDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: AbsenceTypeFormDialogData,
  ) {
    this.isEditMode = !!data.absenceType;
    this.form = this.fb.group({
      name: [
        data.absenceType?.name ?? '',
        [Validators.required, Validators.maxLength(255)],
      ],
      description: [data.absenceType?.description ?? ''],
      isActive: [data.absenceType?.isActive ?? true],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    const value = this.form.value;
    const result: AbsenceTypeFormDialogResult = {
      name: value.name.trim(),
      description: value.description?.trim() || undefined,
      ...(this.isEditMode && { isActive: value.isActive }),
    };
    this.dialogRef.close(result);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

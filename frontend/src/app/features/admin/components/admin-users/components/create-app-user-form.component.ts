import { Component, Input, Output, EventEmitter, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AppUserType, CreateAppUserInput } from '../../../../../services/app-user.service';

const USER_TYPE_LABELS: Record<AppUserType, string> = {
  OPERATOR: 'Operatore',
  SECRETARY: 'Segreteria',
  PRIVACY_OFFICER: 'Responsabile Privacy',
  IT_MANAGER: 'IT Manager',
};

@Component({
  selector: 'app-create-app-user-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="create-form">
      <mat-form-field appearance="outline">
        <mat-label>Nome *</mat-label>
        <input matInput formControlName="name">
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Cognome</mat-label>
        <input matInput formControlName="surname">
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Email</mat-label>
        <input matInput type="email" formControlName="email">
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Telefono</mat-label>
        <input matInput formControlName="phone">
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Tipo Utente *</mat-label>
        <mat-select formControlName="userType">
          @for (type of userTypes; track type) {
            <mat-option [value]="type">{{ userTypeLabel(type) }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <div class="form-actions">
        <button mat-stroked-button type="button" (click)="onReset()">Annulla</button>
        <button mat-raised-button color="primary" type="submit"
          [disabled]="form.invalid || submitting">
          @if (submitting) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            <mat-icon>save</mat-icon>
          }
          Crea Utente
        </button>
      </div>
    </form>
  `,
  styles: [`
    .create-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 16px;
    }
    .form-actions {
      grid-column: 1 / -1;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    @media (max-width: 599px) {
      .create-form {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class CreateAppUserFormComponent {
  private readonly fb = inject(FormBuilder);

  @Input() userTypes: AppUserType[] = ['OPERATOR', 'SECRETARY', 'PRIVACY_OFFICER', 'IT_MANAGER'];
  @Input() submitting = false;

  @Output() create = new EventEmitter<CreateAppUserInput>();
  @Output() cancel = new EventEmitter<void>();

  form = this.fb.group({
    name: ['', Validators.required],
    surname: [''],
    email: ['', Validators.email],
    phone: [''],
    userType: ['OPERATOR' as AppUserType, Validators.required],
  });

  userTypeLabel(type: AppUserType): string {
    return USER_TYPE_LABELS[type] ?? type;
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.create.emit(this.form.value as CreateAppUserInput);
  }

  onReset(): void {
    this.form.reset({ userType: 'OPERATOR' });
    this.cancel.emit();
  }
}

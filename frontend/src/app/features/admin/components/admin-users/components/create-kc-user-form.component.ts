import { Component, Input, Output, EventEmitter, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  KeycloakRealmRole,
  CreateKeycloakUserInput,
} from '../../../../../services/app-user.service';

@Component({
  selector: 'app-create-kc-user-form',
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
        <mat-label>Email *</mat-label>
        <input matInput type="email" formControlName="email">
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Nome *</mat-label>
        <input matInput formControlName="firstName">
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Cognome *</mat-label>
        <input matInput formControlName="lastName">
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Username *</mat-label>
        <input matInput formControlName="username">
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Ruolo Realm</mat-label>
        <mat-select formControlName="realmRole">
          <mat-option value="">Nessuno</mat-option>
          @for (r of realmRoles; track r.id) {
            <mat-option [value]="r.name">{{ r.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <p class="password-note">
        <mat-icon class="note-icon">info</mat-icon>
        L'utente dovra' impostare la password tramite il flusso "Password dimenticata" di Keycloak.
      </p>

      <div class="form-actions">
        <button mat-stroked-button type="button" (click)="onReset()">Annulla</button>
        <button mat-raised-button color="primary" type="submit"
          [disabled]="form.invalid || submitting">
          @if (submitting) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            <mat-icon>add</mat-icon>
          }
          Crea in Keycloak
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
    .password-note {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 8px;
      color: rgba(0,0,0,0.6);
      font-size: 0.85rem;
      margin: 0;
      padding: 4px 0;
    }
    .note-icon { font-size: 18px; width: 18px; height: 18px; }
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
export class CreateKcUserFormComponent {
  private readonly fb = inject(FormBuilder);

  @Input() realmRoles: KeycloakRealmRole[] = [];
  @Input() submitting = false;

  @Output() create = new EventEmitter<CreateKeycloakUserInput>();
  @Output() cancel = new EventEmitter<void>();

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    username: ['', Validators.required],
    realmRole: [''],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    const value = this.form.value;
    const input: CreateKeycloakUserInput = {
      email: value.email!,
      firstName: value.firstName!,
      lastName: value.lastName!,
      username: value.username!,
      realmRole: value.realmRole || undefined,
    };
    this.create.emit(input);
  }

  onReset(): void {
    this.form.reset();
    this.cancel.emit();
  }
}

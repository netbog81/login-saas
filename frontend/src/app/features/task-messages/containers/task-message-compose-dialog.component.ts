import {
  Component,
  Inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil, startWith, map, Observable, of } from 'rxjs';
import { AppUserService, AppUser } from '../../../services/app-user.service';
import { TaskMessage, CreateTaskMessageInput } from '../models/task-message.models';

export interface ComposeDialogData {
  editMode: boolean;
  message?: TaskMessage;
  currentUserId: string;
}

export interface ComposeDialogResult {
  input: CreateTaskMessageInput;
  gatewayMessageId?: string;
}

@Component({
  selector: 'app-task-message-compose-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      {{ data.editMode ? 'Modifica Messaggio' : 'Nuovo Messaggio/Task' }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="compose-form">

        @if (!data.editMode) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Destinatario</mat-label>
            <input matInput
              formControlName="recipientSearch"
              [matAutocomplete]="autoRecipient"
              placeholder="Cerca utente per nome...">
            <mat-autocomplete #autoRecipient="matAutocomplete"
              [displayWith]="displayUser"
              (optionSelected)="onRecipientSelected($event.option.value)">
              @for (user of filteredUsers$ | async; track user.id) {
                <mat-option [value]="user">
                  {{ user.name }} {{ user.surname || '' }}
                  <span class="user-type">({{ user.userType }})</span>
                </mat-option>
              }
            </mat-autocomplete>
            @if (form.get('recipientSearch')?.hasError('required') && form.get('recipientSearch')?.touched) {
              <mat-error>Destinatario obbligatorio</mat-error>
            }
          </mat-form-field>
        }

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Contenuto</mat-label>
          <textarea matInput
            formControlName="content"
            rows="5"
            placeholder="Scrivi il messaggio o il task..."></textarea>
          @if (form.get('content')?.hasError('required') && form.get('content')?.touched) {
            <mat-error>Il contenuto è obbligatorio</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Disponibile dal (opzionale)</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="availableFrom" [min]="minDate">
          <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
          <mat-hint>Lascia vuoto per rendere il messaggio subito disponibile</mat-hint>
        </mat-form-field>

        @if (form.get('availableFrom')?.value) {
          <div class="info-box">
            <mat-icon>info</mat-icon>
            <span>Il destinatario vedrà il messaggio solo a partire dalla data indicata.</span>
          </div>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Annulla</button>
      <button mat-raised-button color="primary" [disabled]="!isFormValid() || saving" (click)="onSave()">
        @if (saving) {
          <mat-spinner diameter="20"></mat-spinner>
        } @else {
          {{ data.editMode ? 'Salva' : 'Invia' }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .compose-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 400px;
    }
    .full-width { width: 100%; }
    .user-type { color: #999; font-size: 12px; margin-left: 4px; }
    .info-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #fff3e0;
      border-radius: 4px;
      font-size: 13px;
      color: #e65100;
    }
    .info-box mat-icon { font-size: 18px; width: 18px; height: 18px; }
    mat-dialog-actions mat-spinner { margin-right: 8px; }

    @media (max-width: 500px) {
      .compose-form { min-width: unset; }
    }
  `],
})
export class TaskMessageComposeDialogComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  users: AppUser[] = [];
  filteredUsers$: Observable<AppUser[]> = of([]);
  saving = false;
  minDate = new Date();
  private selectedRecipientId: string | null = null;
  private readonly destroy$ = new Subject<void>();

  constructor(
    public dialogRef: MatDialogRef<TaskMessageComposeDialogComponent, ComposeDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: ComposeDialogData,
    private fb: FormBuilder,
    private appUserService: AppUserService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      recipientSearch: [this.data.message?.recipientUser ? this.displayUser(this.data.message.recipientUser as any) : '', Validators.required],
      content: [this.data.message?.content || '', Validators.required],
      availableFrom: [this.data.message?.availableFrom ? new Date(this.data.message.availableFrom) : null],
    });

    if (this.data.editMode && this.data.message) {
      this.selectedRecipientId = this.data.message.recipientUserId;
    }

    // Load users for autocomplete
    this.appUserService.getUsers(undefined, true).pipe(
      takeUntil(this.destroy$),
    ).subscribe((users) => {
      this.ngZone.run(() => {
        // Exclude current user from recipients
        this.users = users.filter(u => u.id !== this.data.currentUserId);
        this.setupAutocomplete();
        this.cdr.markForCheck();
      });
    });
  }

  private setupAutocomplete(): void {
    this.filteredUsers$ = this.form.get('recipientSearch')!.valueChanges.pipe(
      startWith(''),
      map(value => {
        const search = typeof value === 'string' ? value.toLowerCase() : '';
        if (!search) return this.users;
        return this.users.filter(u => {
          const fullName = `${u.name} ${u.surname || ''}`.toLowerCase();
          return fullName.includes(search);
        });
      }),
    );
  }

  onRecipientSelected(user: AppUser): void {
    this.selectedRecipientId = user.id;
  }

  displayUser(user: AppUser | null): string {
    if (!user) return '';
    return `${user.name}${user.surname ? ' ' + user.surname : ''}`;
  }

  isFormValid(): boolean {
    const contentValid = !!this.form.get('content')?.value?.trim();
    if (this.data.editMode) {
      return contentValid;
    }
    return contentValid && !!this.selectedRecipientId;
  }

  onSave(): void {
    if (!this.isFormValid()) return;
    this.saving = true;

    const result: ComposeDialogResult = {
      input: {
        recipientUserId: this.selectedRecipientId || this.data.message?.recipientUserId || '',
        content: this.form.get('content')!.value.trim(),
        availableFrom: this.form.get('availableFrom')?.value
          ? new Date(this.form.get('availableFrom')!.value).toISOString()
          : undefined,
      },
    };

    if (this.data.editMode && this.data.message) {
      result.gatewayMessageId = this.data.message.gatewayMessageId;
    }

    this.dialogRef.close(result);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

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
import {
  TaskMessage,
  CreateTaskMessageInput,
  TaskMessageRecipientGroup,
  RECIPIENT_GROUP_LABELS,
} from '../models/task-message.models';

export interface ComposeDialogData {
  editMode: boolean;
  message?: TaskMessage;
  currentUserId: string;
}

export interface ComposeDialogResult {
  input: CreateTaskMessageInput;
  gatewayMessageId?: string;
}

/** Voce dell'autocomplete destinatario: utente singolo oppure gruppo */
interface RecipientOption {
  kind: 'user' | 'group';
  user?: AppUser;
  group?: TaskMessageRecipientGroup;
  label: string;
  hint: string;
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
              placeholder="Cerca utente o gruppo...">
            <mat-autocomplete #autoRecipient="matAutocomplete"
              [displayWith]="displayOption"
              (optionSelected)="onRecipientSelected($event.option.value)">
              @for (option of filteredOptions$ | async; track option.label) {
                <mat-option [value]="option">
                  @if (option.kind === 'group') {
                    <mat-icon class="group-icon">groups</mat-icon>
                  }
                  {{ option.label }}
                  <span class="user-type">({{ option.hint }})</span>
                </mat-option>
              }
            </mat-autocomplete>
            @if (form.get('recipientSearch')?.hasError('required') && form.get('recipientSearch')?.touched) {
              <mat-error>Destinatario obbligatorio</mat-error>
            }
          </mat-form-field>
          @if (selectedGroup) {
            <div class="info-box">
              <mat-icon>groups</mat-icon>
              <span>Il messaggio sarà visibile a tutte le segretarie: la prima che lo segna come eseguito lo farà scomparire alle altre.</span>
            </div>
          }
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
    .group-icon {
      vertical-align: middle;
      margin-right: 6px;
      color: #1565c0;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
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
  options: RecipientOption[] = [];
  filteredOptions$: Observable<RecipientOption[]> = of([]);
  saving = false;
  minDate = new Date();
  selectedGroup: TaskMessageRecipientGroup | null = null;
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
    const editRecipientLabel = this.data.message?.recipientGroup
      ? RECIPIENT_GROUP_LABELS[this.data.message.recipientGroup]
      : this.data.message?.recipientUser
        ? this.displayUserName(this.data.message.recipientUser as any)
        : '';

    this.form = this.fb.group({
      recipientSearch: [editRecipientLabel, Validators.required],
      content: [this.data.message?.content || '', Validators.required],
      availableFrom: [this.data.message?.availableFrom ? new Date(this.data.message.availableFrom) : null],
    });

    if (this.data.editMode && this.data.message) {
      this.selectedRecipientId = this.data.message.recipientUserId ?? null;
      this.selectedGroup = this.data.message.recipientGroup ?? null;
    }

    // Load users for autocomplete
    this.appUserService.getUsers(undefined, true).pipe(
      takeUntil(this.destroy$),
    ).subscribe((users) => {
      this.ngZone.run(() => {
        // Gruppo Segreteria in cima, poi gli utenti (escluso l'utente corrente)
        const groupOptions: RecipientOption[] = [{
          kind: 'group',
          group: 'SECRETARY',
          label: RECIPIENT_GROUP_LABELS['SECRETARY'],
          hint: 'gruppo: tutte le segretarie',
        }];
        const userOptions: RecipientOption[] = users
          .filter(u => u.id !== this.data.currentUserId)
          .map(u => ({
            kind: 'user' as const,
            user: u,
            label: this.displayUserName(u),
            hint: u.userType,
          }));
        this.options = [...groupOptions, ...userOptions];
        this.setupAutocomplete();
        this.cdr.markForCheck();
      });
    });
  }

  private setupAutocomplete(): void {
    this.filteredOptions$ = this.form.get('recipientSearch')!.valueChanges.pipe(
      startWith(''),
      map(value => {
        const search = typeof value === 'string' ? value.toLowerCase() : '';
        if (!search) return this.options;
        return this.options.filter(o => o.label.toLowerCase().includes(search));
      }),
    );
  }

  onRecipientSelected(option: RecipientOption): void {
    if (option.kind === 'group') {
      this.selectedGroup = option.group!;
      this.selectedRecipientId = null;
    } else {
      this.selectedRecipientId = option.user!.id;
      this.selectedGroup = null;
    }
  }

  displayOption(option: RecipientOption | string | null): string {
    if (!option) return '';
    if (typeof option === 'string') return option;
    return option.label;
  }

  private displayUserName(user: { name: string; surname?: string }): string {
    return `${user.name}${user.surname ? ' ' + user.surname : ''}`;
  }

  isFormValid(): boolean {
    const contentValid = !!this.form.get('content')?.value?.trim();
    if (this.data.editMode) {
      return contentValid;
    }
    return contentValid && (!!this.selectedRecipientId || !!this.selectedGroup);
  }

  onSave(): void {
    if (!this.isFormValid()) return;
    this.saving = true;

    const input: CreateTaskMessageInput = {
      content: this.form.get('content')!.value.trim(),
      availableFrom: this.form.get('availableFrom')?.value
        ? new Date(this.form.get('availableFrom')!.value).toISOString()
        : undefined,
    };
    if (this.selectedGroup) {
      input.recipientGroup = this.selectedGroup;
    } else {
      input.recipientUserId = this.selectedRecipientId || this.data.message?.recipientUserId || '';
    }

    const result: ComposeDialogResult = { input };

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

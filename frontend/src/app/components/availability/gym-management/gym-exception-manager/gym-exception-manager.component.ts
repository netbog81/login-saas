import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { GymExceptionService, GymException, GymExceptionType, CreateGymExceptionInput, UpdateGymExceptionInput } from '../../../../services/gym-exception.service';
import { OperatorService } from '../../../../services/operator.service';
import { Operator, OperatorMacroCategory } from '../../../../graphql/generated/types';

@Component({
  selector: 'app-gym-exception-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gym-exception-manager.component.html',
  styleUrls: ['./gym-exception-manager.component.scss'],
})
export class GymExceptionManagerComponent implements OnInit, OnDestroy, OnChanges {
  private destroy$ = new Subject<void>();

  @Input() gymRoom: { id: string; name: string } | null = null;

  // Data
  exceptions: GymException[] = [];
  operators: Operator[] = [];
  loading = false;
  error: string | null = null;

  // Date range
  startDate: string = '';
  endDate: string = '';

  // Form state
  showForm = false;
  isEditMode = false;
  editingException: Partial<CreateGymExceptionInput> & { id?: string } = {};

  // Enum for template
  GymExceptionType = GymExceptionType;

  exceptionTypeOptions = [
    { value: GymExceptionType.CLOSED, label: 'Chiusura' },
    { value: GymExceptionType.OPERATOR_ABSENT, label: 'Operatore assente' },
    { value: GymExceptionType.MODIFIED_HOURS, label: 'Orari modificati' },
  ];

  constructor(
    private exceptionService: GymExceptionService,
    private operatorService: OperatorService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.initDateRange();
    this.loadOperators();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['gymRoom'] && this.gymRoom) {
      this.loadExceptions();
    }
  }

  initDateRange() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    this.startDate = startOfMonth.toISOString().split('T')[0];
    this.endDate = endOfMonth.toISOString().split('T')[0];
  }

  loadOperators() {
    this.operatorService.getOperators(OperatorMacroCategory.GymInstructor, undefined, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (operators) => {
          this.operators = operators;
        },
        error: (error) => {
          console.error('Error loading operators:', error);
        },
      });
  }

  loadExceptions() {
    if (!this.gymRoom) return;

    this.loading = true;
    this.error = null;

    this.exceptionService.getByDateRange(this.gymRoom.id, this.startDate, this.endDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (exceptions) => {
          this.exceptions = exceptions.sort((a, b) =>
            new Date(a.exceptionDate).getTime() - new Date(b.exceptionDate).getTime()
          );
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading exceptions:', error);
          this.error = 'Errore nel caricamento delle eccezioni';
          this.loading = false;
        },
      });
  }

  onDateRangeChange() {
    this.ngZone.run(() => {
      this.loadExceptions();
    });
  }

  openForm(exception?: GymException) {
    this.ngZone.run(() => {
      if (exception) {
        this.isEditMode = true;
        this.editingException = {
          id: exception.id,
          gymRoomId: exception.gymRoomId,
          operatorId: exception.operatorId,
          exceptionDate: exception.exceptionDate,
          startTime: exception.startTime,
          endTime: exception.endTime,
          exceptionType: exception.exceptionType,
          substituteOperatorId: exception.substituteOperatorId,
          reason: exception.reason,
        };
      } else {
        this.isEditMode = false;
        const today = new Date().toISOString().split('T')[0];
        this.editingException = {
          gymRoomId: this.gymRoom?.id || '',
          exceptionDate: today,
          exceptionType: GymExceptionType.CLOSED,
        };
      }
      this.showForm = true;
      this.error = null;
    });
  }

  closeForm() {
    this.ngZone.run(() => {
      this.showForm = false;
      this.isEditMode = false;
      this.editingException = {};
      this.error = null;
    });
  }

  saveException() {
    if (this.loading || !this.gymRoom) return;

    if (!this.editingException.exceptionDate) {
      this.error = 'La data è obbligatoria';
      return;
    }

    if (!this.editingException.exceptionType) {
      this.error = 'Il tipo di eccezione è obbligatorio';
      return;
    }

    this.loading = true;
    this.error = null;

    if (this.isEditMode && this.editingException.id) {
      const input: UpdateGymExceptionInput = {
        operatorId: this.editingException.operatorId,
        exceptionDate: this.editingException.exceptionDate,
        startTime: this.editingException.startTime,
        endTime: this.editingException.endTime,
        exceptionType: this.editingException.exceptionType,
        substituteOperatorId: this.editingException.substituteOperatorId,
        reason: this.editingException.reason,
      };

      this.exceptionService.update(this.editingException.id, input)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadExceptions();
            this.closeForm();
          },
          error: (error) => {
            console.error('Error updating exception:', error);
            this.error = 'Errore nell\'aggiornamento dell\'eccezione';
            this.loading = false;
          },
        });
    } else {
      const input: CreateGymExceptionInput = {
        gymRoomId: this.gymRoom.id,
        operatorId: this.editingException.operatorId,
        exceptionDate: this.editingException.exceptionDate!,
        startTime: this.editingException.startTime,
        endTime: this.editingException.endTime,
        exceptionType: this.editingException.exceptionType!,
        substituteOperatorId: this.editingException.substituteOperatorId,
        reason: this.editingException.reason,
      };

      this.exceptionService.create(input)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadExceptions();
            this.closeForm();
          },
          error: (error) => {
            console.error('Error creating exception:', error);
            this.error = 'Errore nella creazione dell\'eccezione';
            this.loading = false;
          },
        });
    }
  }

  deleteException(exception: GymException) {
    this.ngZone.run(() => {
      if (!this.gymRoom) return;
      if (!confirm('Sei sicuro di voler eliminare questa eccezione?')) return;

      this.loading = true;
      this.exceptionService.delete(exception.id, this.gymRoom.id, exception.exceptionDate)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadExceptions();
          },
          error: (error) => {
            console.error('Error deleting exception:', error);
            this.error = 'Errore nell\'eliminazione dell\'eccezione';
            this.loading = false;
          },
        });
    });
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  formatExceptionType(type: GymExceptionType): string {
    return this.exceptionService.formatExceptionType(type);
  }

  getExceptionTypeClass(type: GymExceptionType): string {
    switch (type) {
      case GymExceptionType.CLOSED:
        return 'type-closed';
      case GymExceptionType.OPERATOR_ABSENT:
        return 'type-absent';
      case GymExceptionType.MODIFIED_HOURS:
        return 'type-modified';
      default:
        return '';
    }
  }

  showSubstituteField(): boolean {
    return this.editingException.exceptionType === GymExceptionType.OPERATOR_ABSENT;
  }

  showOperatorField(): boolean {
    return this.editingException.exceptionType === GymExceptionType.OPERATOR_ABSENT;
  }

  showTimeFields(): boolean {
    return this.editingException.exceptionType !== GymExceptionType.CLOSED ||
           (this.editingException.startTime !== undefined || this.editingException.endTime !== undefined);
  }
}

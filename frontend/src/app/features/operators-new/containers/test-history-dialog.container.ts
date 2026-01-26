import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnDestroy,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import {
  TestHistoryDialogComponent,
  TestHistoryDialogData,
  TestHistoryEditEvent,
  TestHistoryDeleteEvent
} from '../components/test-history-dialog/test-history-dialog.component';
import { ObjectivesTrackingService } from '../../../services/objectives-tracking.service';
import { TestWithEvaluations } from '../models/objectives-tracking.model';

@Component({
  selector: 'app-test-history-dialog-container',
  standalone: true,
  imports: [CommonModule, TestHistoryDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isVisible && dialogData) {
      <app-test-history-dialog
        [data]="dialogData"
        [isVisible]="isVisible"
        (close)="onClose()"
        (editEntry)="onEditEntry($event)"
        (deleteEntry)="onDeleteEntry($event)">
      </app-test-history-dialog>
    }
  `
})
export class TestHistoryDialogContainer implements OnChanges, OnDestroy {
  @Input() test: TestWithEvaluations | null = null;
  @Input() isVisible = false;

  @Output() closed = new EventEmitter<void>();
  @Output() entryUpdated = new EventEmitter<void>();  // Emesso dopo edit/delete - NON chiude il dialog

  dialogData: TestHistoryDialogData | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private objectivesTrackingService: ObjectivesTrackingService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['isVisible'] || changes['test']) && this.isVisible && this.test) {
      this.dialogData = {
        testId: this.test.id,
        testName: this.test.nome,
        history: this.test.evaluationHistory || []
      };
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onClose(): void {
    this.closed.emit();
  }

  onEditEntry(event: TestHistoryEditEvent): void {
    this.objectivesTrackingService.editTestEvaluationEntry(
      event.entryId,
      event.level,
      event.note
    ).pipe(takeUntil(this.destroy$))
     .subscribe({
       next: () => {
         // Emette entryUpdated per ricaricare i dati senza chiudere il dialog
         this.entryUpdated.emit();
       },
       error: (err) => console.error('Errore modifica valutazione:', err)
     });
  }

  onDeleteEntry(event: TestHistoryDeleteEvent): void {
    // Conferma prima di eliminare
    const entry = this.dialogData?.history.find(e => e.id === event.entryId);
    const confirmMsg = entry
      ? `Eliminare la valutazione del ${new Date(entry.createdAt).toLocaleDateString('it-IT')}?`
      : 'Eliminare questa valutazione?';

    if (confirm(confirmMsg)) {
      this.objectivesTrackingService.deleteTestEvaluationEntry(event.entryId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            // Emette entryUpdated per ricaricare i dati senza chiudere il dialog
            this.entryUpdated.emit();
          },
          error: (err) => console.error('Errore eliminazione valutazione:', err)
        });
    }
  }
}

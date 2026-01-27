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
  @Input() set test(value: TestWithEvaluations | null) {
    this._test = value;
    // Aggiorna dialogData quando test cambia (anche se solo il contenuto interno)
    if (this.isVisible && value) {
      this.refreshDialogData();
    }
  }
  get test(): TestWithEvaluations | null {
    return this._test;
  }
  private _test: TestWithEvaluations | null = null;

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
    // Gestisce cambiamenti a isVisible
    if (changes['isVisible'] && this.isVisible && this._test) {
      this.refreshDialogData();
    }
  }

  /**
   * Aggiorna dialogData con un nuovo riferimento per forzare il re-render
   */
  private refreshDialogData(): void {
    if (this._test) {
      this.dialogData = {
        testId: this._test.id,
        testName: this._test.nome,
        // Spread per creare nuovo riferimento array e forzare change detection
        history: [...(this._test.evaluationHistory || [])]
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
         // Aggiornamento ottimistico locale del dialog
         if (this.dialogData) {
           this.dialogData = {
             ...this.dialogData,
             history: this.dialogData.history.map(entry =>
               entry.id === event.entryId
                 ? { ...entry, evaluationLevel: event.level, note: event.note }
                 : entry
             )
           };
           this.cdr.markForCheck();
         }
         // Emette entryUpdated per aggiornare anche il parent
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

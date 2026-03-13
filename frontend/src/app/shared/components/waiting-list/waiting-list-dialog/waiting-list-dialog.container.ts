import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, debounceTime, switchMap } from 'rxjs';

import { WaitingListService } from '../../../../services/waiting-list.service';
import { PatientService } from '../../../../services/patient.service';
import { OperatorService } from '../../../../services/operator.service';
import { WaitingListEntry, CreateWaitingListEntryInput, UpdateWaitingListEntryInput } from '../../../../models/waiting-list.model';
import { Patient } from '../../../../models/patient.model';
import { WaitingListFormComponent, WaitingListOperator } from '../waiting-list-form/waiting-list-form.component';
import { WaitingListCardsListComponent } from '../waiting-list-cards-list/waiting-list-cards-list.component';

@Component({
  selector: 'app-waiting-list-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    DragDropModule,
    MatExpansionModule,
    WaitingListFormComponent,
    WaitingListCardsListComponent,
  ],
  templateUrl: './waiting-list-dialog.container.html',
  styleUrls: ['./waiting-list-dialog.container.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaitingListDialogContainer implements OnInit, OnDestroy {
  private readonly waitingListService = inject(WaitingListService);
  private readonly patientService = inject(PatientService);
  private readonly operatorService = inject(OperatorService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(MatDialogRef<WaitingListDialogContainer>);
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();

  entries: WaitingListEntry[] = [];
  patients: Patient[] = [];
  operators: WaitingListOperator[] = [];
  loading = true;

  ngOnInit(): void {
    this.loadEntries();
    this.loadOperators();
    this.setupPatientSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadEntries(): void {
    this.waitingListService.getEntries('WAITING')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (entries) => {
          this.entries = entries;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private loadOperators(): void {
    this.operatorService.getOperators()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (operators) => {
          this.operators = operators.map(op => ({
            id: op.id,
            name: op.name,
            surname: op.surname ?? undefined,
            color: op.color ?? undefined,
          }));
          this.cdr.markForCheck();
        },
      });
  }

  private setupPatientSearch(): void {
    this.searchSubject$
      .pipe(
        debounceTime(300),
        switchMap((term) => this.patientService.searchPatients(term)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (patients) => {
          this.patients = patients;
          this.cdr.markForCheck();
        },
      });
  }

  onPatientSearch(term: string): void {
    this.searchSubject$.next(term);
  }

  onAddEntry(input: CreateWaitingListEntryInput): void {
    this.waitingListService.createEntry(input)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadEntries(),
      });
  }

  onUpdateEntry(event: { id: string; changes: UpdateWaitingListEntryInput }): void {
    this.waitingListService.updateEntry(event.id, event.changes)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadEntries(),
      });
  }

  onDeleteEntry(id: string): void {
    this.waitingListService.deleteEntry(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadEntries(),
      });
  }

  onReorder(newOrder: { id: string; position: number }[]): void {
    // Optimistic UI update
    const reordered = newOrder
      .map(item => this.entries.find(e => e.id === item.id)!)
      .filter(Boolean);
    this.entries = reordered;
    this.cdr.markForCheck();

    this.waitingListService.reorderEntries(newOrder)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.entries = updated;
          this.cdr.markForCheck();
        },
        error: () => this.loadEntries(),
      });
  }

  closeDialog(): void {
    this.dialogRef.close();
  }
}

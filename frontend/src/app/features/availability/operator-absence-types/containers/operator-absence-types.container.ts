import { Component, OnInit, OnDestroy, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil, filter } from 'rxjs';

import { OperatorAbsenceTypeService } from '../services/operator-absence-type.service';
import { OperatorAbsenceType } from '../models/operator-absence-type.model';
import { AbsenceTypeListComponent } from '../components/absence-type-list/absence-type-list.component';
import {
  AbsenceTypeFormDialogComponent,
  AbsenceTypeFormDialogData,
  AbsenceTypeFormDialogResult,
} from '../components/absence-type-form-dialog/absence-type-form-dialog.component';

/**
 * Container smart per il CRUD dei tipi di assenza operatore.
 * Orchestrazione:
 *  - carica la lista via OperatorAbsenceTypeService
 *  - apre il dialog create/edit via MatDialog
 *  - gestisce delete con conferma
 *  - mostra toast di successo/errore via MatSnackBar
 */
@Component({
  selector: 'app-operator-absence-types-container',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    AbsenceTypeListComponent,
  ],
  template: `
    <div class="absence-types-container">
      <div *ngIf="loading" class="loading">
        <mat-spinner diameter="32"></mat-spinner>
        <span>Caricamento...</span>
      </div>

      <app-absence-type-list
        *ngIf="!loading"
        [items]="items"
        (create)="onCreate()"
        (edit)="onEdit($event)"
        (delete)="onDelete($event)"
      ></app-absence-type-list>
    </div>
  `,
  styles: [
    `
      .absence-types-container {
        padding: 24px;
      }
      .loading {
        display: flex;
        align-items: center;
        gap: 12px;
        color: rgba(0, 0, 0, 0.54);
      }
    `,
  ],
})
export class OperatorAbsenceTypesContainerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private service = inject(OperatorAbsenceTypeService);
  private ngZone = inject(NgZone);

  items: OperatorAbsenceType[] = [];
  loading = false;

  ngOnInit(): void {
    this.loadItems();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadItems(): void {
    this.loading = true;
    this.service
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.ngZone.run(() => {
            this.items = items;
            this.loading = false;
          });
        },
        error: (err) => {
          console.error('Errore caricamento tipi di assenza:', err);
          this.ngZone.run(() => {
            this.loading = false;
            this.showError('Errore nel caricamento dei tipi di assenza');
          });
        },
      });
  }

  onCreate(): void {
    const ref = this.dialog.open<
      AbsenceTypeFormDialogComponent,
      AbsenceTypeFormDialogData,
      AbsenceTypeFormDialogResult
    >(AbsenceTypeFormDialogComponent, {
      data: {},
      autoFocus: true,
    });

    ref
      .afterClosed()
      .pipe(
        filter((result): result is AbsenceTypeFormDialogResult => !!result),
        takeUntil(this.destroy$),
      )
      .subscribe((result) => {
        this.service
          .create({ name: result.name, description: result.description })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.showSuccess('Tipo di assenza creato');
              this.loadItems();
            },
            error: (err) => {
              console.error('Errore creazione:', err);
              this.showError(
                err?.graphQLErrors?.[0]?.message || 'Errore nella creazione',
              );
            },
          });
      });
  }

  onEdit(item: OperatorAbsenceType): void {
    const ref = this.dialog.open<
      AbsenceTypeFormDialogComponent,
      AbsenceTypeFormDialogData,
      AbsenceTypeFormDialogResult
    >(AbsenceTypeFormDialogComponent, {
      data: { absenceType: item },
      autoFocus: true,
    });

    ref
      .afterClosed()
      .pipe(
        filter((result): result is AbsenceTypeFormDialogResult => !!result),
        takeUntil(this.destroy$),
      )
      .subscribe((result) => {
        this.service
          .update(item.id, {
            name: result.name,
            description: result.description,
            isActive: result.isActive,
          })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.showSuccess('Tipo di assenza aggiornato');
              this.loadItems();
            },
            error: (err) => {
              console.error('Errore aggiornamento:', err);
              this.showError(
                err?.graphQLErrors?.[0]?.message || 'Errore nell\'aggiornamento',
              );
            },
          });
      });
  }

  onDelete(item: OperatorAbsenceType): void {
    const confirmed = confirm(
      `Eliminare il tipo di assenza "${item.name}"?\n\n` +
        `Le eccezioni storiche che lo referenziano mantengono uno snapshot del nome ` +
        `e della descrizione, quindi non verranno perse.`,
    );
    if (!confirmed) return;

    this.service
      .delete(item.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showSuccess('Tipo di assenza eliminato');
          this.loadItems();
        },
        error: (err) => {
          console.error('Errore eliminazione:', err);
          this.showError(
            err?.graphQLErrors?.[0]?.message || 'Errore nell\'eliminazione',
          );
        },
      });
  }

  private showSuccess(message: string): void {
    this.ngZone.run(() => {
      this.snackBar.open(message, 'OK', { duration: 3000 });
    });
  }

  private showError(message: string): void {
    this.ngZone.run(() => {
      this.snackBar.open(message, 'OK', { duration: 5000, panelClass: 'snack-error' });
    });
  }
}

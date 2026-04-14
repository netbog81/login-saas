import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subject, takeUntil, filter } from 'rxjs';

import {
  GymExceptionService,
  GymException,
  GymExceptionType,
} from '../../../../services/gym-exception.service';
import {
  GymExceptionDialogContainerComponent,
  GymExceptionDialogData,
} from '../../../../features/availability/gym-exceptions/containers/gym-exception-dialog.container';

@Component({
  selector: 'app-gym-exception-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './gym-exception-manager.component.html',
  styleUrls: ['./gym-exception-manager.component.scss'],
})
export class GymExceptionManagerComponent implements OnInit, OnDestroy, OnChanges {
  private destroy$ = new Subject<void>();

  @Input() gymRoom: { id: string; name: string } | null = null;

  // Data
  exceptions: GymException[] = [];
  loading = false;
  error: string | null = null;

  // Date range
  startDate: string = '';
  endDate: string = '';

  // Enum for template
  GymExceptionType = GymExceptionType;

  private dialog = inject(MatDialog);

  constructor(
    private exceptionService: GymExceptionService,
    private ngZone: NgZone,
  ) {
    // Inizializzato qui (non in ngOnInit) perché ngOnChanges può scattare
    // prima di ngOnInit al primo binding di @Input gymRoom, e loadExceptions
    // ha bisogno di startDate/endDate già popolati.
    this.initDateRange();
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
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

  loadExceptions() {
    if (!this.gymRoom) return;
    if (!this.startDate || !this.endDate) return;

    this.loading = true;
    this.error = null;

    this.exceptionService
      .getByDateRange(this.gymRoom.id, this.startDate, this.endDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (exceptions) => {
          this.exceptions = exceptions.sort(
            (a, b) =>
              new Date(a.exceptionDate).getTime() -
              new Date(b.exceptionDate).getTime(),
          );
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading exceptions:', err);
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

  openForm(exception?: GymException): void {
    this.ngZone.run(() => {
      const ref = this.dialog.open<
        GymExceptionDialogContainerComponent,
        GymExceptionDialogData,
        boolean
      >(GymExceptionDialogContainerComponent, {
        data: {
          gymRoom: this.gymRoom,
          exception,
        },
        autoFocus: true,
        // Dimensioni iniziali ampie: dialog leggibile di default
        width: '960px',
        maxWidth: '95vw',
        minWidth: '720px',
        height: '85vh',
        maxHeight: '95vh',
        // panelClass abilita resize nativo via CSS globale (vedi styles.scss)
        panelClass: 'gym-exception-dialog-panel',
        // Posizione iniziale leggermente spostata così il drag si nota
        position: { top: '40px' },
        hasBackdrop: true,
      });

      ref
        .afterClosed()
        .pipe(
          filter((changed): changed is boolean => changed === true),
          takeUntil(this.destroy$),
        )
        .subscribe(() => {
          this.loadExceptions();
        });
    });
  }

  deleteException(exception: GymException) {
    this.ngZone.run(() => {
      if (!this.gymRoom) return;
      if (!confirm('Sei sicuro di voler eliminare questa eccezione?')) return;

      this.loading = true;
      this.exceptionService
        .delete(exception.id, this.gymRoom.id, exception.exceptionDate)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadExceptions();
          },
          error: (err) => {
            console.error('Error deleting exception:', err);
            this.error = "Errore nell'eliminazione dell'eccezione";
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

  /**
   * True se l'eccezione è operator-wide (gymRoomId NULL).
   */
  isOperatorWide(exception: GymException): boolean {
    return !exception.gymRoomId;
  }

  /**
   * Conta gli slot coperti di un'eccezione (substitutes con sostituto valorizzato).
   */
  countCoveredSlots(exception: GymException): number {
    return (exception.substitutes || []).filter((s) => !!s.substituteOperatorId).length;
  }

  /**
   * Conta gli slot scoperti di un'eccezione (substitutes con sostituto NULL).
   */
  countUncoveredSlots(exception: GymException): number {
    return (exception.substitutes || []).filter((s) => !s.substituteOperatorId).length;
  }

  /**
   * Totale degli slot tracciati da un'eccezione.
   */
  totalSlots(exception: GymException): number {
    return exception.substitutes?.length || 0;
  }

  /**
   * Etichetta del tipo di assenza (snapshot persistito o fallback).
   */
  getAbsenceTypeLabel(exception: GymException): string | null {
    if (exception.absenceTypeSnapshot?.name) return exception.absenceTypeSnapshot.name;
    return null;
  }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { RecurringScopePanelComponent, RecurringScopeSelection } from './recurring-scope-panel.component';

export interface RecurringDeleteDialogData {
  appointmentId: string;
  /** Data (YYYY-MM-DD) dell'occorrenza da cui è partita l'eliminazione. */
  appointmentDate: string;
  recurringGroupId: string;
  clientName?: string;
}

export interface RecurringDeleteDialogResult {
  /** Numero di occorrenze eliminate (0 = nessuna modifica). */
  deletedCount: number;
}

/**
 * Dialog di eliminazione per un appuntamento RICORRENTE quando il flusso di
 * cancellazione non passa dal dialog di modifica (es. riepilogo slot palestra):
 * ospita il pannello scope in sola-eliminazione (solo questo / questo e
 * successivi / intera serie / intervallo date).
 */
@Component({
  selector: 'app-recurring-delete-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, RecurringScopePanelComponent],
  template: `
    <h2 mat-dialog-title class="delete-title">
      <mat-icon>delete</mat-icon>
      Elimina prenotazione ricorrente
    </h2>
    <mat-dialog-content>
      <p class="intro">
        La prenotazione{{ data.clientName ? ' di ' + data.clientName : '' }} fa parte di una
        serie ricorrente: scegli a quali occorrenze applicare l'eliminazione.
      </p>
      <app-recurring-scope-panel
        [futureCount]="loadingSeriesInfo ? null : futureSeriesCount"
        [currentDate]="data.appointmentDate"
        [showEditButton]="false"
        (applyDelete)="onApplyDelete($event)">
      </app-recurring-scope-panel>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="ref.close()" [disabled]="deleting">Annulla</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .delete-title { display: flex; align-items: center; gap: 8px; color: #b91c1c; }
    .intro { font-size: 0.85rem; color: #475569; margin: 0 0 10px; }
    mat-dialog-content { min-width: 460px; max-width: 560px; }
  `],
})
export class RecurringDeleteDialogComponent implements OnInit {
  private recurringAppointmentService = inject(AvailabilityAppointmentService);
  private cdr = inject(ChangeDetectorRef);

  loadingSeriesInfo = false;
  futureSeriesCount: number | null = null;
  deleting = false;

  constructor(
    public ref: MatDialogRef<RecurringDeleteDialogComponent, RecurringDeleteDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: RecurringDeleteDialogData,
  ) {}

  ngOnInit(): void {
    this.loadingSeriesInfo = true;
    this.recurringAppointmentService.getRecurringSeries(this.data.recurringGroupId).subscribe({
      next: (series) => {
        this.futureSeriesCount = series.filter(a =>
          String(a.appointmentDate).slice(0, 10) > this.data.appointmentDate &&
          !['cancelled', 'cancelled_early', 'cancelled_late'].includes((a.bookingStatus || '').toLowerCase())
        ).length;
        this.loadingSeriesInfo = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loadingSeriesInfo = false; this.cdr.markForCheck(); },
    });
  }

  async onApplyDelete(sel: RecurringScopeSelection): Promise<void> {
    if (this.deleting) return;
    this.deleting = true;
    this.cdr.markForCheck();
    try {
      const count = await firstValueFrom(this.recurringAppointmentService.deleteRecurringSeries(
        this.data.appointmentId, this.data.appointmentDate, sel.scope,
        { rangeFrom: sel.rangeFrom, rangeTo: sel.rangeTo, includeCurrent: sel.includeCurrent },
      ));
      this.ref.close({ deletedCount: count });
    } catch {
      alert('Errore nell\'eliminazione della serie');
      this.deleting = false;
      this.cdr.markForCheck();
    }
  }
}

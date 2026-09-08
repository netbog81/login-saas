/**
 * Conflict Resolve Dialog Container
 * Layer 2: Smart Component (orchestratore del dialog)
 *
 * Il dialog unico di risoluzione conflitto, aperto da tutti e tre i punti di
 * consumo: calendario operatori, calendario palestra, pagina /conflicts.
 * Prima esisteva solo dentro la pagina conflitti, scritto a mano in HTML e
 * CSS: averne uno solo significa che "Accetta" fa la stessa cosa ovunque, e
 * che la prossima azione si aggiunge in un posto solo.
 *
 * Lo spostamento NON viene eseguito qui. Il dialog si chiude con
 * `outcome: 'move'` e chi l'ha aperto apre il proprio pannello di ricerca
 * slot: per operatore nella vista operatori, per sala e orario in palestra.
 * È l'unico punto in cui le due viste divergono davvero, e tenerlo fuori da
 * qui è ciò che permette al resto di essere condiviso.
 */

import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

import {
  ConflictResolveFormComponent,
  ConflictResolveSubmit,
} from '../components/conflict-resolve-form/conflict-resolve-form.component';
import { ConflictService } from '../services/conflict.service';
import {
  ConflictedAppointment,
  ConflictOrigin,
  ConflictResolutionResult,
} from '../models/conflict.model';

export interface ConflictResolveDialogData {
  appointment: ConflictedAppointment;
  origin: ConflictOrigin;
  /** Falso dove non esiste un pannello di ricerca slot da aprire. */
  canMove?: boolean;
  moveTooltip?: string;
}

@Component({
  selector: 'app-conflict-resolve-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ConflictResolveFormComponent,
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon class="title-icon">warning</mat-icon>
      Risolvi conflitto
    </h2>

    <mat-dialog-content>
      <app-conflict-resolve-form
        [appointment]="data.appointment"
        [origin]="data.origin"
        [busy]="saving"
        [canMove]="data.canMove !== false"
        [moveTooltip]="data.moveTooltip || 'Cerca uno slot libero e spostalo lì'"
        (submitResolution)="onSubmit($event)"
        (move)="onMove()">
      </app-conflict-resolve-form>

      <div class="server-error" *ngIf="error">
        <mat-icon color="warn">error</mat-icon>
        <span>{{ error }}</span>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <mat-spinner *ngIf="saving" diameter="20"></mat-spinner>
      <button mat-stroked-button type="button" [disabled]="saving" (click)="onClose()">
        Chiudi
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .title-icon { color: #dc2626; }

    mat-dialog-content {
      /* Il dialog è aperto sopra il calendario: senza un tetto all'altezza,
         su portatili bassi le azioni finiscono sotto il bordo dello schermo. */
      max-height: 68vh;
      min-width: min(560px, 88vw);
    }

    .server-error {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      background: #fef2f2;
      color: #b91c1c;
      font-size: 0.875rem;
    }

    mat-dialog-actions {
      gap: 8px;
    }
  `],
})
export class ConflictResolveDialogContainer {
  private readonly conflictService = inject(ConflictService);
  private readonly dialogRef =
    inject<MatDialogRef<ConflictResolveDialogContainer, ConflictResolutionResult>>(MatDialogRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly data = inject<ConflictResolveDialogData>(MAT_DIALOG_DATA);

  saving = false;
  error: string | null = null;

  onSubmit(payload: ConflictResolveSubmit): void {
    if (this.saving) return;
    this.saving = true;
    this.error = null;
    this.cdr.markForCheck();

    this.conflictService
      .resolveConflict(this.data.appointment.id, payload.action, undefined, {
        newDate: payload.newDate,
        newStartTime: payload.newStartTime,
        newEndTime: payload.newEndTime,
        notes: payload.notes,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.dialogRef.close({
            outcome: 'resolved',
            action: payload.action,
            appointmentId: this.data.appointment.id,
          });
        },
        error: (err) => {
          this.saving = false;
          this.error =
            'Impossibile risolvere il conflitto' +
            (err?.message ? `: ${err.message}` : '.');
          this.cdr.markForCheck();
        },
      });
  }

  onMove(): void {
    this.dialogRef.close({
      outcome: 'move',
      appointmentId: this.data.appointment.id,
    });
  }

  onClose(): void {
    this.dialogRef.close({
      outcome: 'cancelled',
      appointmentId: this.data.appointment.id,
    });
  }
}

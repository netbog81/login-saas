/**
 * Path Dialog Container
 * Layer 2: Smart Component
 *
 * Responsabilità:
 * - Gestire apertura/chiusura dialog
 * - Caricare operatori da OperatorService
 * - Chiamare TherapeuticPathService per create/update
 * - Gestire loading states e errori
 * - Emettere eventi pathCreated/pathUpdated al parent
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Operator } from '../../../graphql/generated/types';
import { TherapeuticPath } from '../../../models/therapeutic-path.model';
import { OperatorService } from '../../../services/operator.service';
import { TherapeuticPathService } from '../../../services/therapeutic-path.service';

import { PathDialogComponent } from '../components/path-dialog/path-dialog.component';
import { PathDialogData, PathDialogFormResult } from '../models/path-dialog.model';

@Component({
  selector: 'app-path-dialog-container',
  standalone: true,
  imports: [
    CommonModule,
    PathDialogComponent
  ],
  template: `
    <app-path-dialog
      [data]="data"
      [operators]="operators"
      [loadingOperators]="loadingOperators"
      [saving]="saving"
      (save)="onSave($event)"
      (cancel)="onCancel()">
    </app-path-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PathDialogContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() data!: PathDialogData;

  @Output() pathCreated = new EventEmitter<TherapeuticPath>();
  @Output() pathUpdated = new EventEmitter<TherapeuticPath>();
  @Output() close = new EventEmitter<void>();

  operators: Operator[] = [];
  loadingOperators = false;
  saving = false;
  error: string | null = null;

  constructor(
    private operatorService: OperatorService,
    private therapeuticPathService: TherapeuticPathService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadOperators();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadOperators(): void {
    this.loadingOperators = true;
    this.cdr.markForCheck();

    this.operatorService.getOperators()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (operators) => {
          this.ngZone.run(() => {
            this.operators = operators;
            this.loadingOperators = false;
            this.cdr.markForCheck();
          });
        },
        error: (error) => {
          this.ngZone.run(() => {
            console.error('[PathDialogContainer] Error loading operators:', error);
            this.loadingOperators = false;
            this.error = 'Errore nel caricamento degli operatori';
            this.cdr.markForCheck();
          });
        }
      });
  }

  onSave(result: PathDialogFormResult): void {
    if (this.data.mode === 'create') {
      this.createPath(result);
    } else {
      this.updatePath(result);
    }
  }

  private createPath(result: PathDialogFormResult): void {
    this.saving = true;
    this.cdr.markForCheck();

    const input = {
      patientId: this.data.patientId,
      primaryOperatorId: result.primaryOperatorId,
      name: result.name,
      diagnosis: result.diagnosis,
      icdCode: result.icdCode,
      externalDoctorName: result.externalDoctorName,
      externalPrescriptionRef: result.externalPrescriptionRef,
      notes: result.notes
    };

    this.therapeuticPathService.createPath(input)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newPath) => {
          this.ngZone.run(() => {
            this.saving = false;
            this.pathCreated.emit(newPath);
            this.close.emit();
            this.cdr.markForCheck();
          });
        },
        error: (error) => {
          this.ngZone.run(() => {
            console.error('[PathDialogContainer] Error creating path:', error);
            this.saving = false;
            this.error = 'Errore nella creazione del percorso';
            this.cdr.markForCheck();
          });
        }
      });
  }

  private updatePath(result: PathDialogFormResult): void {
    if (!this.data.path) return;

    this.saving = true;
    this.cdr.markForCheck();

    const input = {
      name: result.name,
      diagnosis: result.diagnosis,
      icdCode: result.icdCode,
      externalDoctorName: result.externalDoctorName,
      externalPrescriptionRef: result.externalPrescriptionRef,
      notes: result.notes,
      status: result.status
    };

    this.therapeuticPathService.updatePath(this.data.path.id, input)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedPath) => {
          this.ngZone.run(() => {
            console.log('[PathDialogContainer] Path updated:', updatedPath);
            this.saving = false;
            this.pathUpdated.emit(updatedPath);
            this.close.emit();
            this.cdr.markForCheck();
          });
        },
        error: (error) => {
          this.ngZone.run(() => {
            console.error('[PathDialogContainer] Error updating path:', error);
            this.saving = false;
            this.error = 'Errore nell\'aggiornamento del percorso';
            this.cdr.markForCheck();
          });
        }
      });
  }

  onCancel(): void {
    this.close.emit();
  }
}

import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  NgZone,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, forkJoin, of, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  GymException,
  GymExceptionType,
  GymExceptionService,
  OperatorSlotOnDate,
  AvailableOperator,
  GymExceptionSubstituteInput,
  CreateGymExceptionInput,
  UpdateGymExceptionInput,
} from '../../../../services/gym-exception.service';
import { OperatorAbsenceTypeService } from '../../operator-absence-types/services/operator-absence-type.service';
import { OperatorAbsenceType } from '../../operator-absence-types/models/operator-absence-type.model';
import { OperatorService } from '../../../../services/operator.service';
import { Operator, OperatorMacroCategory } from '../../../../graphql/generated/types';
import {
  SlotGridComponent,
  slotKey,
  CLOSED_SLOT_VALUE,
} from '../components/slot-grid/slot-grid.component';

export interface GymExceptionDialogData {
  gymRoom: { id: string; name: string } | null;
  exception?: GymException;
}

type ExceptionTypeOption = {
  value: GymExceptionType;
  label: string;
};

/**
 * Container smart per la creazione/modifica di una GymException.
 *
 * Flusso principale:
 *  1. Carica i tipi di assenza attivi e la lista operatori gym_instructor.
 *  2. Quando l'utente seleziona data + tipo OPERATOR_ABSENT + operatore,
 *     chiede al backend gli slot del pattern dell'operatore in quel giorno.
 *  3. Modalità semplice (default): un unico sostituto, propagato a tutti gli slot.
 *  4. Modalità "mostra operatori disponibili": per ciascuno slot, fa la query
 *     availableOperatorsForSlot e mostra i candidati nella griglia.
 *  5. Al submit costruisce `substitutes[]` e chiama create/update.
 */
@Component({
  selector: 'app-gym-exception-dialog-container',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    DragDropModule,
    SlotGridComponent,
  ],
  template: `
    <div class="dialog-wrapper" cdkDrag cdkDragRootElement=".cdk-overlay-pane">
      <div class="dialog-header" cdkDragHandle>
        <div class="header-title">
          <mat-icon>event_busy</mat-icon>
          <span>
            {{ isEditMode ? 'Modifica eccezione palestra' : 'Nuova eccezione palestra' }}
          </span>
        </div>
        <div class="header-actions">
          <button mat-icon-button (click)="onCancel()" aria-label="Chiudi">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <div class="dialog-body">
        <!-- Form base -->
      <div class="form-row">
        <mat-form-field appearance="outline" class="flex-1">
          <mat-label>Data</mat-label>
          <input
            matInput
            [matDatepicker]="picker"
            [(ngModel)]="exceptionDate"
            (ngModelChange)="onDateOrOperatorChanged()"
          />
          <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline" class="flex-1">
          <mat-label>Tipo eccezione</mat-label>
          <mat-select
            [(ngModel)]="exceptionType"
            (selectionChange)="onExceptionTypeChanged()"
          >
            <mat-option *ngFor="let opt of exceptionTypeOptions" [value]="opt.value">
              {{ opt.label }}
            </mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Campi condizionali per OPERATOR_ABSENT -->
      <ng-container *ngIf="isOperatorAbsent()">
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Operatore assente</mat-label>
            <mat-select
              [(ngModel)]="operatorId"
              (selectionChange)="onDateOrOperatorChanged()"
            >
              <mat-option *ngFor="let op of operators" [value]="op.id">
                {{ op.name }} {{ op.surname }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Tipo di assenza</mat-label>
            <mat-select [(ngModel)]="absenceTypeId">
              <mat-option [value]="null">— Nessuno —</mat-option>
              <mat-option *ngFor="let t of absenceTypes" [value]="t.id">
                {{ t.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Toggle modalità -->
        <div class="mode-toggle">
          <mat-slide-toggle
            [(ngModel)]="slotModeEnabled"
            (change)="onSlotModeChanged($event.checked)"
          >
            Mostra operatori disponibili (sostituto diverso per slot)
          </mat-slide-toggle>
          <p class="mode-hint">
            <ng-container *ngIf="!slotModeEnabled">
              Modalità semplice: un unico sostituto per tutti gli slot.
            </ng-container>
            <ng-container *ngIf="slotModeEnabled">
              Clicca sui candidati per assegnarli ai rispettivi slot.
            </ng-container>
          </p>
        </div>

        <!-- Sostituto unico (solo in modalità semplice) -->
        <div *ngIf="!slotModeEnabled" class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Sostituto (applicato a tutti gli slot)</mat-label>
            <mat-select [(ngModel)]="simpleSubstituteId" (selectionChange)="onSimpleSubstituteChanged()">
              <mat-option [value]="null">— Nessuno (slot scoperti) —</mat-option>
              <mat-option [value]="CLOSED_VALUE">
                <mat-icon class="closed-option-icon">lock</mat-icon>
                Palestra chiusa
              </mat-option>
              <mat-option *ngFor="let op of operators" [value]="op.id">
                {{ op.name }} {{ op.surname }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Riepilogo: slot derivati dal pattern -->
        <div *ngIf="operatorId" class="slots-section">
          <div class="slots-header">
            <h3>
              Slot dell'operatore
              <span class="slot-count">
                ({{ displaySlots.length }}
                {{ slotModeEnabled ? 'slot da 1h' : 'slot' }})
              </span>
            </h3>
            <div *ngIf="loadingSlots" class="loading-inline">
              <mat-spinner diameter="20"></mat-spinner>
              Calcolo slot...
            </div>
          </div>

          <p *ngIf="!loadingSlots && displaySlots.length === 0" class="empty-hint">
            L'operatore selezionato non ha pattern di disponibilità in questa
            data. Nessuno slot da coprire.
          </p>

          <app-slot-grid
            *ngIf="displaySlots.length > 0"
            [slots]="displaySlots"
            [assignments]="assignments"
            [candidatesBySlot]="candidatesBySlot"
            [loadingSlots]="loadingCandidateSlots"
            [operatorLabels]="operatorLabels"
            [simpleMode]="!slotModeEnabled"
            (assignmentChange)="onAssignmentChange($event)"
          ></app-slot-grid>
        </div>
      </ng-container>

      <!-- Palestra (solo per CLOSED/MODIFIED_HOURS) -->
      <ng-container *ngIf="!isOperatorAbsent() && gymRoom">
        <div class="info-box">
          <mat-icon>info</mat-icon>
          Eccezione applicata alla palestra: <strong>{{ gymRoom.name }}</strong>
        </div>

        <div class="form-row" *ngIf="exceptionType === ExceptionType.MODIFIED_HOURS">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Ora inizio</mat-label>
            <input matInput type="time" [(ngModel)]="startTime" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Ora fine</mat-label>
            <input matInput type="time" [(ngModel)]="endTime" />
          </mat-form-field>
        </div>
      </ng-container>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Motivo (opzionale)</mat-label>
        <textarea matInput rows="2" [(ngModel)]="reason"></textarea>
      </mat-form-field>

        <div *ngIf="errorMessage" class="error-box">
          <mat-icon>error</mat-icon>
          {{ errorMessage }}
        </div>
      </div>

      <div class="dialog-footer">
        <button mat-button (click)="onCancel()">Annulla</button>
        <button
          mat-flat-button
          color="primary"
          [disabled]="saving || !canSubmit()"
          (click)="onSave()"
        >
          <mat-spinner *ngIf="saving" diameter="18"></mat-spinner>
          {{ isEditMode ? 'Salva modifiche' : 'Crea eccezione' }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .dialog-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-height: 100%;
      }
      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #2c3e50;
        color: white;
        cursor: move;
        border-radius: 4px 4px 0 0;
        flex-shrink: 0;
      }
      .header-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 500;
      }
      .header-actions {
        display: flex;
        gap: 0;
      }
      .header-actions button {
        color: white;
      }
      .dialog-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
      }
      .dialog-footer {
        flex-shrink: 0;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        background: #fafafa;
      }
      .closed-option-icon {
        font-size: 16px;
        height: 16px;
        width: 16px;
        margin-right: 6px;
        vertical-align: middle;
        color: #607d8b;
      }
      .form-row {
        display: flex;
        gap: 16px;
      }
      .flex-1 {
        flex: 1;
      }
      .full-width {
        width: 100%;
      }
      .mode-toggle {
        margin: 8px 0 16px;
        padding: 12px;
        background: #f5f5f5;
        border-radius: 4px;
      }
      .mode-hint {
        margin: 4px 0 0;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.54);
      }
      .slots-section {
        margin-top: 16px;
      }
      .slots-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .slots-header h3 {
        margin: 0;
      }
      .slot-count {
        color: rgba(0, 0, 0, 0.54);
        font-weight: normal;
        font-size: 14px;
      }
      .loading-inline {
        display: flex;
        align-items: center;
        gap: 8px;
        color: rgba(0, 0, 0, 0.54);
      }
      .empty-hint {
        padding: 16px;
        background: #fafafa;
        border-radius: 4px;
        color: rgba(0, 0, 0, 0.54);
      }
      .info-box {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: #e3f2fd;
        border-radius: 4px;
        margin: 8px 0;
      }
      .error-box {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: #ffebee;
        color: #c62828;
        border-radius: 4px;
        margin-top: 12px;
      }
    `,
  ],
})
export class GymExceptionDialogContainerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private dialogRef = inject<
    MatDialogRef<GymExceptionDialogContainerComponent, boolean>
  >(MatDialogRef);
  private gymExceptionService = inject(GymExceptionService);
  private absenceTypeService = inject(OperatorAbsenceTypeService);
  private operatorService = inject(OperatorService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  readonly ExceptionType = GymExceptionType;

  // Input context
  gymRoom: { id: string; name: string } | null;
  isEditMode: boolean;
  editingId?: string;

  // Form state
  exceptionDate: Date = new Date();
  exceptionType: GymExceptionType = GymExceptionType.OPERATOR_ABSENT;
  operatorId: string | null = null;
  absenceTypeId: string | null = null;
  /**
   * In modalità semplice, valore del select sostituto. Tre stati:
   *  - <uuid operatore> = sostituto unico per tutti gli slot
   *  - CLOSED_SLOT_VALUE = palestra chiusa per tutti gli slot
   *  - null = nessun sostituto (slot scoperti)
   */
  simpleSubstituteId: string | null = null;
  /** Esposto al template per il binding del select. */
  readonly CLOSED_VALUE = CLOSED_SLOT_VALUE;
  slotModeEnabled = false;
  startTime = '';
  endTime = '';
  reason = '';

  // Caricamenti
  operators: Operator[] = [];
  absenceTypes: OperatorAbsenceType[] = [];
  /** Slot-pattern originali dell'operatore (1 entry per GymTemplatePattern). */
  slots: OperatorSlotOnDate[] = [];
  /**
   * Slot effettivamente mostrati in UI:
   *  - modalità semplice (slotModeEnabled=false): === slots (pattern interi)
   *  - modalità avanzata (slotModeEnabled=true): pattern splittati in slot da 1h
   */
  displaySlots: OperatorSlotOnDate[] = [];
  loadingSlots = false;
  candidatesBySlot: Record<string, AvailableOperator[]> = {};
  loadingCandidateSlots: Record<string, boolean> = {};
  operatorLabels: Record<string, string> = {};

  // Assegnazioni per slot (slotKey → substituteOperatorId|null)
  assignments: Record<string, string | null> = {};

  saving = false;
  errorMessage: string | null = null;

  exceptionTypeOptions: ExceptionTypeOption[] = [
    { value: GymExceptionType.CLOSED, label: 'Chiusura' },
    { value: GymExceptionType.OPERATOR_ABSENT, label: 'Operatore assente' },
    { value: GymExceptionType.MODIFIED_HOURS, label: 'Orari modificati' },
  ];

  constructor(@Inject(MAT_DIALOG_DATA) data: GymExceptionDialogData) {
    this.gymRoom = data.gymRoom;
    this.isEditMode = !!data.exception;
    if (data.exception) {
      this.editingId = data.exception.id;
      this.exceptionDate = new Date(data.exception.exceptionDate);
      this.exceptionType = data.exception.exceptionType;
      this.operatorId = data.exception.operatorId || null;
      this.absenceTypeId =
        data.exception.absenceTypeId || data.exception.absenceTypeSnapshot?.id || null;
      this.simpleSubstituteId = data.exception.substituteOperatorId || null;
      this.startTime = data.exception.startTime || '';
      this.endTime = data.exception.endTime || '';
      this.reason = data.exception.reason || '';
      // Se l'eccezione ha substitutes, popola le assegnazioni subito.
      // La scelta di slotModeEnabled in edit-mode viene decisa in loadSlots()
      // confrontando il numero di substitutes con quello dei pattern originali:
      // se il count differisce, l'eccezione era in modalità avanzata (split).
      if (data.exception.substitutes && data.exception.substitutes.length > 0) {
        for (const sub of data.exception.substitutes) {
          const key = slotKey({
            gymRoomId: sub.gymRoomId,
            startTime: sub.startTime,
            endTime: sub.endTime,
          });
          // Tre stati: sostituto attivo | palestra chiusa esplicita | scoperto
          if (sub.substituteOperatorId) {
            this.assignments[key] = sub.substituteOperatorId;
          } else if (sub.isClosed) {
            this.assignments[key] = CLOSED_SLOT_VALUE;
          } else {
            this.assignments[key] = null;
          }
          if (sub.substituteOperator) {
            this.operatorLabels[sub.substituteOperator.id] =
              `${sub.substituteOperator.name} ${sub.substituteOperator.surname}`;
          }
        }
      }
    }
  }

  ngOnInit(): void {
    this.loadAbsenceTypes();
    this.loadOperators();
    if (this.operatorId) {
      this.loadSlots();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== LOADERS ====================

  private loadAbsenceTypes(): void {
    this.absenceTypeService
      .list(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (types) => this.ngZone.run(() => (this.absenceTypes = types)),
        error: (err) => console.error('Errore caricamento tipi di assenza:', err),
      });
  }

  private loadOperators(): void {
    this.operatorService
      .getOperators(OperatorMacroCategory.GymInstructor, undefined, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ops) => {
          this.ngZone.run(() => {
            this.operators = ops;
            for (const op of ops) {
              this.operatorLabels[op.id] = `${op.name} ${op.surname}`;
            }
          });
        },
        error: (err) => console.error('Errore caricamento operatori:', err),
      });
  }

  private loadSlots(): void {
    if (!this.operatorId || !this.isOperatorAbsent()) {
      this.slots = [];
      this.displaySlots = [];
      this.assignments = {};
      return;
    }
    const dateStr = this.dateToIso(this.exceptionDate);
    this.loadingSlots = true;
    // Conserva le assegnazioni pre-popolate dal costruttore in edit-mode
    // per rilevare se l'eccezione originale era in modalità split
    const preloadedAssignments = { ...this.assignments };
    this.gymExceptionService
      .getOperatorPatternsOnDate(this.operatorId, dateStr)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (slots) => {
          this.ngZone.run(() => {
            this.slots = slots;
            this.loadingSlots = false;

            // Edit-mode: se ci sono assegnazioni pre-popolate dall'eccezione
            // esistente, confrontiamo il numero con quello dei pattern originali
            // ricevuti dal backend. Se è maggiore → era uno split → attiva mode.
            if (this.isEditMode && Object.keys(preloadedAssignments).length > 0) {
              const preloadedCount = Object.keys(preloadedAssignments).length;
              if (preloadedCount > slots.length) {
                this.slotModeEnabled = true;
              }
            }

            this.recomputeDisplaySlots();

            if (this.slotModeEnabled && this.isEditMode && Object.keys(preloadedAssignments).length > 0) {
              // Mantieni le assegnazioni esistenti (sono già splittate nel DB)
              this.assignments = preloadedAssignments;
              this.loadCandidatesForAllSlots();
            } else if (this.slotModeEnabled) {
              // Modalità avanzata nuova: reset assignments e carica candidati
              const emptyAssignments: Record<string, string | null> = {};
              for (const slot of this.displaySlots) {
                const key = slotKey({
                  gymRoomId: slot.gymRoom.id,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                });
                emptyAssignments[key] = null;
              }
              this.assignments = emptyAssignments;
              this.loadCandidatesForAllSlots();
            } else {
              // Modalità semplice: se edit-mode con substitute legacy già in
              // preloadedAssignments, mantienile; altrimenti rigenera dal
              // simpleSubstituteId corrente.
              if (this.isEditMode && Object.keys(preloadedAssignments).length > 0) {
                this.assignments = preloadedAssignments;
              } else {
                this.refreshAssignmentsFromSimpleSubstitute();
              }
            }
          });
        },
        error: (err) => {
          console.error('Errore caricamento slot operatore:', err);
          this.ngZone.run(() => {
            this.loadingSlots = false;
            this.errorMessage = 'Errore nel caricamento degli slot dell\'operatore';
          });
        },
      });
  }

  /**
   * Aggiorna `displaySlots` in base a `slotModeEnabled`:
   *  - modalità semplice: pattern interi
   *  - modalità avanzata: pattern splittati in slot da 1h
   */
  private recomputeDisplaySlots(): void {
    if (this.slotModeEnabled) {
      const split: OperatorSlotOnDate[] = [];
      for (const slot of this.slots) {
        split.push(...this.splitSlotIntoHours(slot));
      }
      this.displaySlots = split;
    } else {
      this.displaySlots = [...this.slots];
    }
  }

  /**
   * Decompone uno slot-pattern in sotto-slot da 1 ora consecutivi.
   *
   * Esempio: 07:00-13:00 → [07:00-08:00, 08:00-09:00, ..., 12:00-13:00]
   *
   * Se lo slot-pattern non è multiplo di 1h (es. 07:30-13:00), l'ultima
   * fascia contiene il residuo (es. 12:30-13:00). Se il pattern ha durata
   * <= 60 minuti viene restituito così com'è.
   */
  private splitSlotIntoHours(slot: OperatorSlotOnDate): OperatorSlotOnDate[] {
    const startMin = this.timeToMinutes(slot.startTime);
    const endMin = this.timeToMinutes(slot.endTime);
    if (endMin - startMin <= 60) {
      return [slot];
    }
    const result: OperatorSlotOnDate[] = [];
    let cursor = startMin;
    while (cursor < endMin) {
      const nextBoundary = Math.min(cursor + 60, endMin);
      result.push({
        gymRoom: slot.gymRoom,
        startTime: this.minutesToTime(cursor),
        endTime: this.minutesToTime(nextBoundary),
      });
      cursor = nextBoundary;
    }
    return result;
  }

  private timeToMinutes(hhmm: string): number {
    // Accetta sia "HH:mm" sia "HH:mm:ss"
    const parts = hhmm.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private loadCandidatesForAllSlots(): void {
    if (!this.operatorId || this.displaySlots.length === 0) return;
    const dateStr = this.dateToIso(this.exceptionDate);
    const opId = this.operatorId;

    // Marca tutti i display-slot come "in loading" in modo immutabile
    const initialLoading: Record<string, boolean> = {};
    for (const slot of this.displaySlots) {
      const key = slotKey({
        gymRoomId: slot.gymRoom.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
      initialLoading[key] = true;
    }
    this.loadingCandidateSlots = initialLoading;
    this.candidatesBySlot = {};

    const requests = this.displaySlots.map((slot) => {
      const key = slotKey({
        gymRoomId: slot.gymRoom.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
      return this.gymExceptionService
        .getAvailableOperatorsForSlot(
          slot.gymRoom.id,
          dateStr,
          slot.startTime,
          slot.endTime,
          opId,
        )
        .pipe(
          catchError((err) => {
            console.error(`Errore caricamento candidati slot ${key}:`, err);
            return of([] as AvailableOperator[]);
          }),
        );
    });

    forkJoin(requests)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          this.ngZone.run(() => {
            // Ricostruisci le mappe come NUOVI oggetti, così OnPush sul child
            // vede il change-detection sugli @Input() objects.
            const nextCandidates: Record<string, AvailableOperator[]> = {
              ...this.candidatesBySlot,
            };
            const nextLoading: Record<string, boolean> = { ...this.loadingCandidateSlots };
            const nextLabels: Record<string, string> = { ...this.operatorLabels };

            results.forEach((candidates, i) => {
              const slot = this.displaySlots[i];
              const key = slotKey({
                gymRoomId: slot.gymRoom.id,
                startTime: slot.startTime,
                endTime: slot.endTime,
              });
              nextCandidates[key] = candidates;
              nextLoading[key] = false;
              for (const op of candidates) {
                nextLabels[op.id] = `${op.name} ${op.surname}`;
              }
            });

            this.candidatesBySlot = nextCandidates;
            this.loadingCandidateSlots = nextLoading;
            this.operatorLabels = nextLabels;
            this.cdr.markForCheck();
          });
        },
      });
  }

  // ==================== EVENT HANDLERS ====================

  onExceptionTypeChanged(): void {
    if (!this.isOperatorAbsent()) {
      this.slots = [];
      this.displaySlots = [];
      this.assignments = {};
    } else if (this.operatorId) {
      this.loadSlots();
    }
  }

  onDateOrOperatorChanged(): void {
    if (this.isOperatorAbsent() && this.operatorId) {
      this.loadSlots();
    }
  }

  onSlotModeChanged(enabled: boolean): void {
    this.slotModeEnabled = enabled;
    // Ricomputa displaySlots (split vs pattern interi) e resetta lo stato
    // derivato: assignments e candidati sono legati alla granularità corrente
    // quindi vanno azzerati quando si passa da pattern interi a slot-ora e
    // viceversa.
    this.recomputeDisplaySlots();
    this.candidatesBySlot = {};
    this.loadingCandidateSlots = {};

    if (enabled && this.displaySlots.length > 0) {
      // In modalità avanzata: azzera le assegnazioni (nessuno split
      // preesistente), poi carica i candidati per ciascuna slot-ora.
      const emptyAssignments: Record<string, string | null> = {};
      for (const slot of this.displaySlots) {
        const key = slotKey({
          gymRoomId: slot.gymRoom.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
        emptyAssignments[key] = null;
      }
      this.assignments = emptyAssignments;
      this.loadCandidatesForAllSlots();
    } else if (!enabled) {
      // Torna alla modalità semplice: rigenera assignments dal sostituto unico
      this.refreshAssignmentsFromSimpleSubstitute();
    }
  }

  onSimpleSubstituteChanged(): void {
    this.refreshAssignmentsFromSimpleSubstitute();
  }

  onAssignmentChange(event: { slotKey: string; substituteOperatorId: string | null }): void {
    this.assignments = {
      ...this.assignments,
      [event.slotKey]: event.substituteOperatorId,
    };
  }

  /**
   * Rigenera la mappa `assignments` usando il `simpleSubstituteId` come
   * valore per tutti gli slot attualmente mostrati (`displaySlots`).
   * Usato in modalità semplice quando cambia il sostituto unico.
   */
  private refreshAssignmentsFromSimpleSubstitute(): void {
    const next: Record<string, string | null> = {};
    for (const slot of this.displaySlots) {
      const key = slotKey({
        gymRoomId: slot.gymRoom.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
      next[key] = this.simpleSubstituteId;
    }
    this.assignments = next;
  }

  // ==================== SUBMIT ====================

  isOperatorAbsent(): boolean {
    return this.exceptionType === GymExceptionType.OPERATOR_ABSENT;
  }

  canSubmit(): boolean {
    if (!this.exceptionDate) return false;
    if (this.isOperatorAbsent()) {
      if (!this.operatorId) return false;
      return true;
    }
    // Per CLOSED/MODIFIED_HOURS serve la palestra
    return !!this.gymRoom;
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onSave(): void {
    if (this.saving || !this.canSubmit()) return;
    this.saving = true;
    this.errorMessage = null;

    const substitutes = this.buildSubstitutesPayload();
    const dateStr = this.dateToIso(this.exceptionDate);

    if (this.isEditMode && this.editingId) {
      const input: UpdateGymExceptionInput = {
        exceptionDate: dateStr,
        exceptionType: this.exceptionType,
        operatorId: this.operatorId || undefined,
        absenceTypeId: this.absenceTypeId || undefined,
        substituteOperatorId: this.simpleSubstituteId || undefined,
        substitutes: substitutes,
        reason: this.reason || undefined,
        startTime: this.startTime || undefined,
        endTime: this.endTime || undefined,
      };
      this.gymExceptionService
        .update(this.editingId, input)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.ngZone.run(() => {
              this.saving = false;
              this.dialogRef.close(true);
            });
          },
          error: (err) => this.handleSubmitError(err),
        });
      return;
    }

    const input: CreateGymExceptionInput = {
      exceptionDate: dateStr,
      exceptionType: this.exceptionType,
      operatorId: this.operatorId || undefined,
      // Se OPERATOR_ABSENT → operator-wide (gymRoomId undefined)
      // Se CLOSED/MODIFIED_HOURS → scoped alla gymRoom del manager
      gymRoomId: this.isOperatorAbsent() ? undefined : this.gymRoom?.id,
      absenceTypeId: this.absenceTypeId || undefined,
      substituteOperatorId: this.simpleSubstituteId || undefined,
      substitutes: substitutes,
      reason: this.reason || undefined,
      startTime: this.startTime || undefined,
      endTime: this.endTime || undefined,
    };

    this.gymExceptionService
      .create(input)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.saving = false;
            this.dialogRef.close(true);
          });
        },
        error: (err) => this.handleSubmitError(err),
      });
  }

  private buildSubstitutesPayload(): GymExceptionSubstituteInput[] | undefined {
    if (!this.isOperatorAbsent() || this.displaySlots.length === 0) return undefined;
    // In modalità semplice `displaySlots === slots` (pattern interi),
    // in modalità avanzata è lo split in slot da 1h. In entrambi i casi
    // inviamo la stessa struttura al backend.
    //
    // Tre stati possibili per ogni slot:
    //  - assignments[key] === <uuid operatore>     → sostituto attivo
    //  - assignments[key] === CLOSED_SLOT_VALUE    → palestra chiusa esplicita
    //  - assignments[key] === null/undefined       → slot scoperto
    return this.displaySlots.map((slot) => {
      const key = slotKey({
        gymRoomId: slot.gymRoom.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
      const value = this.assignments[key];
      const isClosed = value === CLOSED_SLOT_VALUE;
      const substituteOperatorId =
        value && value !== CLOSED_SLOT_VALUE ? value : undefined;
      return {
        gymRoomId: slot.gymRoom.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        substituteOperatorId,
        isClosed,
      };
    });
  }

  private handleSubmitError(err: any): void {
    console.error('Errore salvataggio eccezione:', err);
    this.ngZone.run(() => {
      this.saving = false;
      this.errorMessage =
        err?.graphQLErrors?.[0]?.message ||
        err?.message ||
        'Errore nel salvataggio dell\'eccezione';
    });
  }

  private dateToIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

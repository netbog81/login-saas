/**
 * Appuntamenti Dialog Container — Calendario V3
 * Layer 2: Smart Component
 *
 * Coordinatore della finestra "Appuntamenti": ricerca paziente, lista
 * appuntamenti del paziente, riprenotazione con ricerca slot.
 *
 * Tiene SOLO lo UI state; business logic e GraphQL nei service
 * (PatientService, AvailabilityAppointmentService, RebookingService),
 * tutti basati su BaseGraphQLService (NgZone).
 *
 * APPROACH foreign keys: GraphQL Fragments — gli appuntamenti arrivano
 * con operator/service/instruments gia' popolati; la riprenotazione
 * (update) invia solo ID.
 *
 * Apertura form di modifica e navigazione al calendario sono delegate
 * al container calendario via callback nei MAT_DIALOG_DATA (quel
 * container possiede gia' MatDialog, operatori e pazienti).
 */

import {
  Component, Inject, ChangeDetectionStrategy, ChangeDetectorRef, inject,
  OnInit, OnDestroy, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule, CdkDrag } from '@angular/cdk/drag-drop';
import { Subject, firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { V3PatientSearchComponent } from '../components/patient-search/patient-search.component';
import { V3PatientAppointmentsListComponent } from '../components/patient-appointments-list/patient-appointments-list.component';
import { V3RebookingPanelComponent } from '../components/rebooking-panel/rebooking-panel.component';

import { PatientService } from '../../../services/patient.service';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { RebookingService } from '../services/rebooking.service';
import { Patient, getPatientDisplayName } from '../../../models/patient.model';
import { AvailabilityAppointment } from '../../../graphql/generated/types';
import {
  RebookingSlot, RebookingOperatorOption, RebookingSlotsByDay,
  RebookingOperatorInput,
} from '../models/rebooking.model';

/**
 * Dati passati al dialog.
 * - goToCalendar: naviga il calendario a un appuntamento (data + operatore).
 * - editAppointment: apre il form di modifica standard; risolve true se
 *   l'appuntamento e' stato modificato.
 * - operators: operatori del calendario, con macroCategory per il filtro.
 */
export interface AppuntamentiDialogData {
  goToCalendar?: (appointment: AvailabilityAppointment) => void;
  editAppointment?: (appointment: AvailabilityAppointment) => Promise<boolean>;
  operators?: RebookingOperatorInput[];
}

type LayoutMode = 'panels' | 'wizard';
type WizardStep = 'search' | 'appointments' | 'rebooking';

@Component({
  selector: 'app-appuntamenti-dialog-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatButtonToggleModule,
    MatIconModule, MatTooltipModule, DragDropModule,
    V3PatientSearchComponent, V3PatientAppointmentsListComponent,
    V3RebookingPanelComponent,
  ],
  template: `
    <div class="dialog-root" [class.minimized]="minimized">
      <!-- Title bar: trascinabile su tutta l'area (cdkDrag senza handle).
           La zona toggle/chiudi a destra blocca il drag via stopPropagation
           sul mousedown. -->
      <div class="dialog-title-bar"
           cdkDrag
           #titleDrag="cdkDrag"
           cdkDragRootElement=".appuntamenti-dialog-pane"
           cdkDragBoundary=".cdk-overlay-container"
           (dblclick)="toggleMinimized()">
        <div class="title-left">
          <mat-icon>drag_indicator</mat-icon>
          <span class="title-text">Appuntamenti</span>
        </div>

        <!-- Nome paziente selezionato, centrato -->
        <div class="title-center">
          @if (selectedPatient) {
            <mat-icon class="pat-ic">person</mat-icon>
            <span class="pat-name">{{ patientName(selectedPatient) }}</span>
          }
        </div>

        <!-- Zona non trascinabile: toggle layout + chiudi.
             stopPropagation sul mousedown impedisce a cdkDrag di catturare
             il gesto; sul dblclick impedisce la minimizzazione. -->
        <div class="title-actions"
             (mousedown)="$event.stopPropagation()"
             (dblclick)="$event.stopPropagation()">
          <mat-button-toggle-group [value]="layout"
                                   (change)="layout = $event.value"
                                   hideSingleSelectionIndicator>
            <mat-button-toggle value="panels" matTooltip="Vista a pannelli affiancati">
              <mat-icon>view_column</mat-icon>
            </mat-button-toggle>
            <mat-button-toggle value="wizard" matTooltip="Vista guidata passo-passo">
              <mat-icon>linear_scale</mat-icon>
            </mat-button-toggle>
          </mat-button-toggle-group>
          <button mat-icon-button (click)="close()"
                  matTooltip="Chiudi" aria-label="Chiudi">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Corpo: nascosto quando la finestra e' minimizzata -->
      @if (!minimized) {
        <!-- ===== LAYOUT PANNELLI =====
             Paziente e appuntamenti hanno larghezza fissa (sempre
             leggibili). Il pannello spostamento e' stretto di default e
             si allarga quando ci si clicca dentro. -->
        @if (layout === 'panels') {
          <div class="dialog-body panels">
            <div class="panel panel-search">
              <app-v3-patient-search
                [patients]="patients"
                [loading]="patientsLoading"
                [searched]="patientsSearched"
                [selectedPatientId]="selectedPatient?.id ?? null"
                (termChange)="onSearchTerm($event)"
                (selectPatient)="onSelectPatient($event)">
              </app-v3-patient-search>
            </div>
            <div class="panel panel-appts">
              <app-v3-patient-appointments-list
                [appointments]="appointments"
                [loading]="appointmentsLoading"
                [patientSelected]="!!selectedPatient"
                [selectedAppointmentId]="rebookingAppointment?.id ?? null"
                (goToCalendar)="onGoToCalendar($event)"
                (editAppointment)="onEditAppointment($event)"
                (moveAppointment)="onMoveAppointment($event)">
              </app-v3-patient-appointments-list>
            </div>
            <div class="panel panel-rebooking"
                 [class.expanded]="rebookingExpanded"
                 (click)="rebookingExpanded = true">
              <ng-container *ngTemplateOutlet="rebookingTpl"></ng-container>
            </div>
          </div>
        }

        <!-- ===== LAYOUT WIZARD ===== -->
        @if (layout === 'wizard') {
          <div class="dialog-body wizard">
            <div class="wizard-steps">
              <button class="step" [class.active]="wizardStep === 'search'"
                      (click)="wizardStep = 'search'">1. Paziente</button>
              <button class="step" [class.active]="wizardStep === 'appointments'"
                      [disabled]="!selectedPatient"
                      (click)="wizardStep = 'appointments'">2. Appuntamenti</button>
              <button class="step" [class.active]="wizardStep === 'rebooking'"
                      [disabled]="!rebookingAppointment"
                      (click)="wizardStep = 'rebooking'">3. Spostamento</button>
            </div>
            <div class="wizard-content">
              @if (wizardStep === 'search') {
                <app-v3-patient-search
                  [patients]="patients"
                  [loading]="patientsLoading"
                  [searched]="patientsSearched"
                  [selectedPatientId]="selectedPatient?.id ?? null"
                  (termChange)="onSearchTerm($event)"
                  (selectPatient)="onSelectPatient($event)">
                </app-v3-patient-search>
              }
              @if (wizardStep === 'appointments') {
                <app-v3-patient-appointments-list
                  [appointments]="appointments"
                  [loading]="appointmentsLoading"
                  [patientSelected]="!!selectedPatient"
                  [selectedAppointmentId]="rebookingAppointment?.id ?? null"
                  (goToCalendar)="onGoToCalendar($event)"
                  (editAppointment)="onEditAppointment($event)"
                  (moveAppointment)="onMoveAppointment($event)">
                </app-v3-patient-appointments-list>
              }
              @if (wizardStep === 'rebooking') {
                <ng-container *ngTemplateOutlet="rebookingTpl"></ng-container>
              }
            </div>
          </div>
        }
      }
    </div>

    <!-- Pannello riprenotazione: condiviso tra i due layout -->
    <ng-template #rebookingTpl>
      <app-v3-rebooking-panel
        [appointment]="rebookingAppointment"
        [originalOperatorName]="originalOperatorName"
        [operatorOptions]="visibleOperatorOptions"
        [categories]="categories"
        [activeCategory]="activeCategory"
        [rangeStart]="rangeStart"
        [rangeEnd]="rangeEnd"
        [durationMinutes]="durationMinutes"
        [slotsByDay]="slotsByDay"
        [selectedSlot]="selectedSlot"
        [loading]="slotsLoading"
        [saving]="saving"
        [searched]="slotsSearched"
        [canPageBack]="canPageBack"
        (toggleOperator)="onToggleOperator($event)"
        (categoryChange)="onCategoryChange($event)"
        (rangeStartChange)="rangeStart = $event"
        (rangeEndChange)="rangeEnd = $event"
        (durationChange)="durationMinutes = $event"
        (search)="onSearchSlots()"
        (pageWeeks)="onPageWeeks($event)"
        (editAppointment)="onEditRebookingAppointment()"
        (selectSlot)="selectedSlot = $event"
        (confirm)="onConfirmRebooking()">
      </app-v3-rebooking-panel>
    </ng-template>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .dialog-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 420px;
      min-width: 680px;
    }
    /* Minimizzata: solo la barra blu visibile. */
    .dialog-root.minimized {
      height: auto;
      min-height: 0;
    }
    .dialog-title-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 10px;
      background: #1976d2;
      color: white;
      cursor: move;
      border-radius: 4px 4px 0 0;
      flex: 0 0 auto;
      user-select: none;
    }
    .title-left {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      flex: 0 0 auto;
    }
    .title-center {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 0;
    }
    .pat-ic { font-size: 18px; width: 18px; height: 18px; }
    .pat-name {
      font-weight: 600;
      font-size: 0.92rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .title-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
      cursor: default;
    }
    ::ng-deep .dialog-title-bar .mat-button-toggle-group {
      height: 28px;
      background: rgba(255,255,255,0.15);
      border: none;
    }
    ::ng-deep .dialog-title-bar .mat-button-toggle { color: white; }
    .dialog-body {
      flex: 1;
      overflow: hidden;
      padding: 12px;
      min-height: 0;
    }
    /* Pannelli affiancati.
       Paziente e appuntamenti hanno larghezza fissa (sempre leggibili).
       Lo spostamento e' stretto di default e si allarga col click. */
    .dialog-body.panels {
      display: flex;
      gap: 12px;
    }
    .panel {
      display: flex;
      flex-direction: column;
      min-height: 0;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      background: #fff;
      overflow: hidden;
    }
    .panel-search {
      flex: 0 0 250px;
    }
    .panel-appts {
      flex: 0 0 340px;
    }
    .panel-rebooking {
      flex: 1 1 auto;
      min-width: 360px;
      transition: flex-basis 0.25s ease;
      cursor: pointer;
    }
    /* Allargato: lo spostamento prende lo spazio, gli altri restano fissi. */
    .panel-rebooking.expanded {
      border-color: #93c5fd;
      box-shadow: 0 0 0 1px #bfdbfe inset;
      cursor: default;
    }
    /* Wizard */
    .dialog-body.wizard {
      display: flex;
      flex-direction: column;
    }
    .wizard-steps {
      display: flex;
      gap: 6px;
      margin-bottom: 10px;
      flex: 0 0 auto;
    }
    .step {
      flex: 1;
      padding: 8px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #f8fafc;
      font-size: 0.82rem;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
    }
    .step.active {
      background: #1976d2;
      color: white;
      border-color: #1976d2;
    }
    .step:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .wizard-content {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      background: #fff;
      display: flex;
      flex-direction: column;
    }
  `],
})
export class AppuntamentiDialogContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchTerm$ = new Subject<string>();
  private cdr = inject(ChangeDetectorRef);
  private patientService = inject(PatientService);
  private appointmentService = inject(AvailabilityAppointmentService);
  private rebookingService = inject(RebookingService);

  /** Quante settimane copre una "pagina" di navigazione slot. */
  private static readonly PAGE_WEEKS = 2;

  // ── UI state: layout / finestra ──
  layout: LayoutMode = 'panels';
  wizardStep: WizardStep = 'search';
  /** Layout 'panels': true → il pannello spostamento e' allargato. */
  rebookingExpanded = false;
  minimized = false;

  // ── UI state: ricerca paziente ──
  patients: Patient[] = [];
  patientsLoading = false;
  patientsSearched = false;
  selectedPatient: Patient | null = null;

  // ── UI state: appuntamenti del paziente ──
  appointments: AvailabilityAppointment[] = [];
  appointmentsLoading = false;

  // ── UI state: riprenotazione ──
  rebookingAppointment: AvailabilityAppointment | null = null;
  originalOperatorName = '';
  /** Tutte le opzioni operatore (tutte le categorie). */
  allOperatorOptions: RebookingOperatorOption[] = [];
  /** Operatori visibili = allOperatorOptions filtrati per categoria. */
  visibleOperatorOptions: RebookingOperatorOption[] = [];
  /** Categorie disponibili, per il filtro. */
  categories: string[] = [];
  /** Categoria attualmente filtrata; '' = tutte. */
  activeCategory = '';
  rangeStart = '';
  rangeEnd = '';
  durationMinutes = 45;
  slotsByDay: RebookingSlotsByDay[] = [];
  selectedSlot: RebookingSlot | null = null;
  slotsLoading = false;
  slotsSearched = false;
  saving = false;

  /** Direttiva cdkDrag della title bar, per leggere/correggere la posizione. */
  @ViewChild('titleDrag') titleDrag?: CdkDrag;

  constructor(
    private dialogRef: MatDialogRef<AppuntamentiDialogContainer>,
    @Inject(MAT_DIALOG_DATA) public data: AppuntamentiDialogData,
  ) {}

  ngOnInit(): void {
    this.searchTerm$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(term => this.runPatientSearch(term));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== TITLE BAR ====================

  /**
   * Riduce/espande la finestra alla sola barra blu. Oltre a nascondere il
   * corpo, agisce sul pane dell'overlay per annullarne i vincoli di
   * altezza minima (definiti in .appuntamenti-dialog-pane).
   *
   * Al ripristino, se la finestra minimizzata era stata trascinata in
   * alto, l'espansione potrebbe portare la barra del titolo fuori
   * dall'area visibile: ensureTitleBarVisible la riporta dentro.
   */
  toggleMinimized(): void {
    this.minimized = !this.minimized;
    if (this.minimized) {
      this.dialogRef.addPanelClass('minimized');
    } else {
      this.dialogRef.removePanelClass('minimized');
      // Dopo che il DOM ha applicato l'altezza espansa.
      setTimeout(() => this.ensureTitleBarVisible(), 0);
    }
  }

  /**
   * Se il pane dell'overlay e' (parzialmente) sopra il bordo superiore o
   * sinistro della viewport, corregge la posizione del cdkDrag per
   * riportare la barra del titolo dentro l'area visibile. Senza questo,
   * espandendo una finestra minimizzata posizionata in alto, la barra
   * finirebbe fuori schermo e diventerebbe irraggiungibile.
   *
   * Usa l'API di CdkDrag (get/setFreeDragPosition) cosi' lo stato interno
   * del drag resta coerente: il trascinamento successivo riparte dalla
   * posizione corretta, senza salti.
   */
  private ensureTitleBarVisible(): void {
    const pane = document.querySelector<HTMLElement>('.appuntamenti-dialog-pane');
    if (!pane || !this.titleDrag) return;

    const rect = pane.getBoundingClientRect();
    const margin = 8;
    const overflowTop = margin - rect.top;
    const overflowLeft = margin - rect.left;
    if (overflowTop <= 0 && overflowLeft <= 0) return;

    const pos = this.titleDrag.getFreeDragPosition();
    this.titleDrag.setFreeDragPosition({
      x: pos.x + Math.max(0, overflowLeft),
      y: pos.y + Math.max(0, overflowTop),
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  // ==================== RICERCA PAZIENTE ====================

  onSearchTerm(term: string): void {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      this.patients = [];
      this.patientsSearched = false;
      return;
    }
    this.searchTerm$.next(trimmed);
  }

  private runPatientSearch(term: string): void {
    this.patientsLoading = true;
    this.cdr.markForCheck();
    this.patientService.searchPatients(term)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (patients) => {
          this.patients = patients;
          this.patientsLoading = false;
          this.patientsSearched = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.patients = [];
          this.patientsLoading = false;
          this.patientsSearched = true;
          this.cdr.markForCheck();
        },
      });
  }

  onSelectPatient(patient: Patient): void {
    this.selectedPatient = patient;
    this.rebookingAppointment = null;
    this.selectedSlot = null;
    this.slotsByDay = [];
    this.slotsSearched = false;
    this.rebookingExpanded = false;
    this.loadAppointments(patient.id);
    if (this.layout === 'wizard') this.wizardStep = 'appointments';
  }

  // ==================== APPUNTAMENTI PAZIENTE ====================

  private loadAppointments(patientId: string): void {
    this.appointmentsLoading = true;
    this.cdr.markForCheck();
    const today = new Date().toISOString().split('T')[0];
    this.appointmentService.getAppointmentsByPatient(patientId, today)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (appts) => {
          this.appointments = appts;
          this.appointmentsLoading = false;
          this.refreshRebookingAppointmentFromList();
          this.cdr.markForCheck();
        },
        error: () => {
          this.appointments = [];
          this.appointmentsLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  /** Riallinea rebookingAppointment con la versione fresca dalla lista. */
  private refreshRebookingAppointmentFromList(): void {
    if (!this.rebookingAppointment) return;
    const fresh = this.appointments.find(a => a.id === this.rebookingAppointment!.id);
    this.rebookingAppointment = fresh ?? null;
  }

  onGoToCalendar(appointment: AvailabilityAppointment): void {
    this.data.goToCalendar?.(appointment);
  }

  /** Apre il form standard di modifica appuntamento (dalla lista). */
  async onEditAppointment(appointment: AvailabilityAppointment): Promise<void> {
    const changed = await this.data.editAppointment?.(appointment);
    if (changed && this.selectedPatient) {
      this.loadAppointments(this.selectedPatient.id);
    }
  }

  // ==================== RIPRENOTAZIONE ====================

  onMoveAppointment(appointment: AvailabilityAppointment): void {
    this.rebookingAppointment = appointment;
    this.selectedSlot = null;
    this.slotsByDay = [];
    this.slotsSearched = false;
    // Premendo "Sposta" il pannello riprenotazione si allarga.
    this.rebookingExpanded = true;

    const op = appointment.operator;
    this.originalOperatorName = op
      ? `${op.name ?? ''} ${op.surname ?? ''}`.trim()
      : '—';

    this.buildOperatorOptions(appointment);

    // Durata di default = durata dell'appuntamento corrente.
    this.durationMinutes = this.minutesBetween(
      appointment.startTime, appointment.endTime,
    );

    // Range di default: da oggi (o dalla data appuntamento se futura), +14gg.
    this.rangeStart = this.maxDate(this.todayStr(), appointment.appointmentDate);
    this.rangeEnd = this.addDaysStr(this.rangeStart, 14);

    if (this.layout === 'wizard') this.wizardStep = 'rebooking';
    this.cdr.markForCheck();
  }

  /**
   * Costruisce le opzioni operatore e imposta il filtro categoria sulla
   * categoria dell'operatore dell'appuntamento. L'operatore originale e'
   * selezionato; gli altri sono solo visibili (selezione a discrezione).
   */
  private buildOperatorOptions(appointment: AvailabilityAppointment): void {
    const all = this.data.operators ?? [];
    this.allOperatorOptions = all.map(o => ({
      operatorId: o.id,
      name: o.name,
      macroCategory: o.macroCategory,
      isOriginal: o.id === appointment.operatorId,
      selected: o.id === appointment.operatorId,
    }));

    // Operatore originale assente dalla lista calendario → aggiungilo.
    if (!this.allOperatorOptions.some(o => o.isOriginal) && appointment.operatorId) {
      const origCat = appointment.operator?.macroCategory ?? '';
      this.allOperatorOptions.unshift({
        operatorId: appointment.operatorId,
        name: this.originalOperatorName,
        macroCategory: origCat,
        isOriginal: true,
        selected: true,
      });
    }

    // Categorie disponibili.
    this.categories = Array.from(
      new Set(this.allOperatorOptions.map(o => o.macroCategory).filter(c => !!c)),
    ).sort();

    // Filtro preimpostato sulla categoria dell'operatore originale.
    const original = this.allOperatorOptions.find(o => o.isOriginal);
    this.activeCategory = original?.macroCategory ?? '';
    this.recomputeVisibleOperators();
  }

  /**
   * Ricalcola l'elenco operatori visibili (filtrato per categoria).
   * Campo STABILE invece di getter: un getter che ritorna un array nuovo
   * a ogni chiamata, legato a un @Input OnPush, causa re-render continui.
   */
  private recomputeVisibleOperators(): void {
    this.visibleOperatorOptions = this.activeCategory
      ? this.allOperatorOptions.filter(o => o.macroCategory === this.activeCategory)
      : this.allOperatorOptions;
  }

  onCategoryChange(category: string): void {
    this.activeCategory = category;
    this.recomputeVisibleOperators();
  }

  onToggleOperator(operatorId: string): void {
    this.allOperatorOptions = this.allOperatorOptions.map(o =>
      o.operatorId === operatorId ? { ...o, selected: !o.selected } : o,
    );
    this.recomputeVisibleOperators();
  }

  /** Apre il form di modifica per l'appuntamento in riprenotazione. */
  async onEditRebookingAppointment(): Promise<void> {
    if (!this.rebookingAppointment) return;
    const changed = await this.data.editAppointment?.(this.rebookingAppointment);
    if (changed && this.selectedPatient) {
      // loadAppointments riallinea rebookingAppointment con i dati freschi;
      // la ricerca slot va rilanciata dall'utente coi nuovi dati.
      this.slotsByDay = [];
      this.slotsSearched = false;
      this.selectedSlot = null;
      this.loadAppointments(this.selectedPatient.id);
    }
  }

  onSearchSlots(): void {
    if (!this.rebookingAppointment) return;
    const operatorIds = this.allOperatorOptions
      .filter(o => o.selected)
      .map(o => o.operatorId);
    if (operatorIds.length === 0 || !this.rangeStart || !this.rangeEnd) return;

    const dates = this.datesInRange(this.rangeStart, this.rangeEnd);
    const serviceId = this.rebookingAppointment.serviceId ?? undefined;

    this.slotsLoading = true;
    this.slotsSearched = false;
    this.selectedSlot = null;
    this.cdr.markForCheck();

    this.rebookingService.findAvailableSlots(
      operatorIds, dates, this.durationMinutes, serviceId,
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (slots) => {
        this.slotsByDay = this.groupByDay(slots);
        this.slotsLoading = false;
        this.slotsSearched = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.slotsByDay = [];
        this.slotsLoading = false;
        this.slotsSearched = true;
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Scorre la finestra di ricerca di +/- PAGE_WEEKS settimane.
   * Indietro non si va mai prima di oggi.
   */
  onPageWeeks(direction: 'prev' | 'next'): void {
    const deltaDays = AppuntamentiDialogContainer.PAGE_WEEKS * 7
      * (direction === 'next' ? 1 : -1);
    let newStart = this.addDaysStr(this.rangeStart, deltaDays);
    let newEnd = this.addDaysStr(this.rangeEnd, deltaDays);

    // Clamp al passato: la data inizio non puo' precedere oggi.
    const today = this.todayStr();
    if (newStart < today) {
      const span = this.daysBetween(this.rangeStart, this.rangeEnd);
      newStart = today;
      newEnd = this.addDaysStr(today, span);
    }
    this.rangeStart = newStart;
    this.rangeEnd = newEnd;
    this.onSearchSlots();
  }

  /** true se si puo' ancora scorrere indietro (rangeStart oltre oggi). */
  get canPageBack(): boolean {
    return this.rangeStart > this.todayStr();
  }

  async onConfirmRebooking(): Promise<void> {
    if (!this.rebookingAppointment || !this.selectedSlot) return;
    const appt = this.rebookingAppointment;
    const slot = this.selectedSlot;

    this.saving = true;
    this.cdr.markForCheck();

    try {
      await firstValueFrom(this.rebookingService.rebook({
        appointmentId: appt.id,
        appointmentDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        operatorId: slot.operatorId !== appt.operatorId ? slot.operatorId : undefined,
      }));
      if (this.selectedPatient) this.loadAppointments(this.selectedPatient.id);
      this.rebookingAppointment = null;
      this.selectedSlot = null;
      this.slotsByDay = [];
      this.slotsSearched = false;
      this.rebookingExpanded = false;
      if (this.layout === 'wizard') this.wizardStep = 'appointments';
    } catch (err: unknown) {
      alert(this.extractError(err));
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  // ==================== UTILITIES ====================

  patientName(p: Patient): string {
    return getPatientDisplayName(p);
  }

  private todayStr(): string {
    return new Date().toISOString().split('T')[0];
  }

  private maxDate(a: string, b: string): string {
    return a > b ? a : b;
  }

  private addDaysStr(date: string, days: number): string {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  private daysBetween(start: string, end: string): number {
    const a = new Date(start + 'T00:00:00').getTime();
    const b = new Date(end + 'T00:00:00').getTime();
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  }

  private minutesBetween(start: string, end: string): number {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    };
    return Math.max(5, toMin(end) - toMin(start));
  }

  private datesInRange(start: string, end: string): string[] {
    const result: string[] = [];
    const d = new Date(start + 'T00:00:00');
    const last = new Date(end + 'T00:00:00');
    while (d <= last) {
      result.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
    return result;
  }

  private groupByDay(slots: RebookingSlot[]): RebookingSlotsByDay[] {
    const byDate = new Map<string, RebookingSlot[]>();
    for (const s of slots) {
      if (!byDate.has(s.date)) byDate.set(s.date, []);
      byDate.get(s.date)!.push(s);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, daySlots]) => ({
        date,
        slots: daySlots.sort((x, y) => x.startTime.localeCompare(y.startTime)),
      }));
  }

  private extractError(err: unknown): string {
    const e = err as { graphQLErrors?: { message: string }[]; message?: string };
    const raw = e?.graphQLErrors?.[0]?.message || e?.message || '';
    if (raw.includes('APPOINTMENT_OUTSIDE_AVAILABILITY')) {
      return 'L\'orario selezionato è fuori dalla disponibilità dell\'operatore.';
    }
    return raw || 'Errore durante lo spostamento dell\'appuntamento';
  }
}

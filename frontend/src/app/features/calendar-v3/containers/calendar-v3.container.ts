/**
 * Calendar V3 Container
 * Layer 2: Smart Component (Orchestratore)
 *
 * Variante di CalendarV2Container con layout compatto: header e toolbar
 * accorpati in un'unica barra (CalendarV3ToolbarComponent), per ridurre
 * l'ingombro verticale e mostrare piu' celle senza scroll.
 *
 * Riusa servizi e componenti (sidebar, griglie) da features/calendar-v2:
 * sono singleton/dumb condivisibili, niente duplicazione di logica.
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, combineLatest, forkJoin, firstValueFrom } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

// Angular Material
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// Componente nuovo v3
import { CalendarV3ToolbarComponent } from '../components/calendar-toolbar/calendar-v3-toolbar.component';

// Componente nuovo v3
import { OperatorGridV3Component } from '../components/operator-grid/operator-grid-v3.component';

// Copia/incolla appuntamento (v3)
import { AppointmentPasteBarComponent } from '../components/appointment-paste-bar/appointment-paste-bar.component';
import { AppointmentClipboardService, PasteTargetSlot } from '../services/appointment-clipboard.service';

// Componenti riusati da calendar-v2 (Layer 1 - Dumb)
import { CalendarV2SidebarComponent } from '../../calendar-v2/components/calendar-sidebar/calendar-v2-sidebar.component';
import { GymGridComponent, GymRoom, GymSlotClickEvent, GymAppointmentClickEvent } from '../../calendar-v2/components/gym-grid/gym-grid.component';
import { GymRoomService, GymAppointment } from '../../../services/gym-room.service';
import { GymSlotSummaryV3Component, GymSlotSummaryV3Action } from '../components/gym-slot-summary/gym-slot-summary-v3.component';

// Dialog Material esistenti
import { MatDialog } from '@angular/material/dialog';
import { EventMatDialogComponent, EventMatDialogData, EventMatDialogResult } from '../../../shared/components/event-mat-dialog';
import { RecurringConflictsDialogComponent } from '../../../shared/components/recurring-scope-panel/recurring-conflicts-dialog.component';
import { GymAppointmentMatDialogComponent, GymAppointmentMatDialogData, GymAppointmentMatDialogResult } from '../../../shared/components/gym-appointment-mat-dialog';
import { Patient } from '../../../models/patient.model';
import { User } from '../../../models/user.model';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { InstrumentService } from '../../../services/instrument.service';
import { SseService } from '../../../services/sse.service';

// Services riusati da calendar-v2
import { CalendarV2StateService } from '../../calendar-v2/services/calendar-v2-state.service';
import { CalendarV2DataService } from '../../calendar-v2/services/calendar-v2-data.service';
import { CalendarV2GridService } from '../../calendar-v2/services/calendar-v2-grid.service';
// Service specifico v3 (disponibilita' free-block)
import { CalendarV3DataService } from '../services/calendar-v3-data.service';
// Vista Studi: container smart dedicato (sidebar + griglia + dati)
import { RoomsViewContainer } from './rooms-view.container';
import { OperatorService } from '../../../services/operator.service';
import { SettingsService, AppointmentClickAction } from '../../../services/settings.service';
import {
  AppointmentSummaryComponent,
  SummaryAction,
} from '../../../components/calendar-cdk/appointment-summary/appointment-summary.component';
import { WhatsappChatStateService } from '../../whatsapp-chat/services/whatsapp-chat-state.service';
import { PermissionsService } from '../../../core/services/permissions.service';
import { OidcAuthService } from '../../../core/auth/oidc-auth.service';
import { OperatorWorkspaceStateService } from '../../operators-new/services/operator-workspace-state.service';
import { InstructorWorkspaceStateService } from '../../instructors/services/instructor-workspace-state.service';

// Models e util riusati da calendar-v2
import { CalendarV2Config, CalendarOperator, OperatorGridData, CellClickEvent, EventClickEvent, DragMoveEvent, AvailableSlotPosition, SearchFilters } from '../../calendar-v2/models/calendar-v2.model';
import { isAppointmentWithinAvailability } from '../../calendar-v2/services/availability-check.util';
import { ConfirmMatDialogComponent, ConfirmMatDialogData } from '../../../shared/components/confirm-mat-dialog';
import { RecurringDeleteDialogComponent, RecurringDeleteDialogData, RecurringDeleteDialogResult } from '../../../shared/components/recurring-scope-panel/recurring-delete-dialog.component';
import { Appointment } from '../../../models/appointment.model';
import { AvailabilityAppointment } from '../../../graphql/generated/types';
import { mapAvailabilityAppointmentToAppointment } from '../../../utils/appointment.mapper';
import { Treatment } from '../../../models/treatment.model';
import { TreatmentService } from '../../../services/treatment.service';
import {
  NewChatDialogComponent,
  NewChatDialogResult,
} from '../../whatsapp-chat/components/new-chat-dialog/new-chat-dialog.component';

@Component({
  selector: 'app-calendar-v3-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    CalendarV3ToolbarComponent,
    CalendarV2SidebarComponent,
    OperatorGridV3Component,
    GymGridComponent,
    RoomsViewContainer,
    AppointmentPasteBarComponent,
  ],
  template: `
    <div class="calendar-v3">
      <!-- Barra unica: navigazione date + controlli + toggle vista -->
      <app-calendar-v3-toolbar
        [readOnly]="readOnly"
        [dateLabel]="currentDateLabel"
        [currentDate]="stateService.currentDate"
        [viewMode]="config.viewMode"
        [viewType]="config.viewType"
        [slotDuration]="config.slotDuration"
        [zoom]="config.zoom"
        [showWorkingHoursOnly]="config.showWorkingHoursOnly"
        [showWeekend]="config.showWeekend"
        [compactMode]="config.compactMode"
        [copyMode]="clipboard.isActive"
        (toggleCopyMode)="onToggleCopyMode()"
        (prev)="onNavigatePrev()"
        (next)="onNavigateNext()"
        (today)="onNavigateToday()"
        (dateChange)="onDatePicked($event)"
        (viewTypeChange)="onViewTypeChange($event)"
        (viewModeChange)="onViewModeChange($event)"
        (slotDurationChange)="onSlotDurationChange($event)"
        (zoomChange)="onZoomChange($event)"
        (showWorkingHoursOnlyChange)="onShowWorkingHoursOnlyChange($event)"
        (showWeekendChange)="onShowWeekendChange($event)"
        (compactModeChange)="onCompactModeChange($event)"
        (openWaitingList)="onOpenWaitingList()"
        (openTreatments)="onOpenTreatments()"
        (openAppuntamenti)="onOpenAppuntamenti()">
      </app-calendar-v3-toolbar>

      <!-- Content -->
      <div class="calendar-v3-body">
        @if (loading) {
          <div class="loading-overlay">
            <mat-spinner diameter="48"></mat-spinner>
            <span>Caricamento...</span>
          </div>
        }

        <!-- Sidebar operatori: nascosta in sola lettura (l'utente è bloccato
             sul proprio calendario, niente selezione operatori). -->
        @if (config.viewMode === 'operators' && !readOnly) {
          <app-calendar-v2-sidebar
            [operators]="stateService.operators"
            [treatments]="treatments"
            [instrumentCategories]="instrumentCategories"
            [collapsed]="sidebarCollapsed"
            [showGymInstructors]="showGymInstructorsInOperators"
            [initialCategory]="initialSelectedCategory"
            [weekly]="config.viewType === 'weekly'"
            [visibleDates]="visibleDates"
            [selectedDate]="selectedTreatmentDay"
            [parkedChats]="chatState.panelConversations()"
            (toggleOperator)="stateService.toggleOperator($event)"
            (setOperatorSelection)="stateService.setOperatorSelection($event.operatorIds, $event.selected)"
            (toggleCollapsed)="sidebarCollapsed = !sidebarCollapsed"
            (slotSearchToggle)="onSlotSearchToggle($event)"
            (searchFiltersChange)="onSearchFiltersChange($event)"
            (openParkedChat)="chatState.openConversation($event)"
            (removeParkedChat)="onRemoveChatFromPanel($event)"
            (newParkedChat)="onNewChat()"
            (clearParkedChats)="onClearChatPanel()">
          </app-calendar-v2-sidebar>
        }


        <!-- Main grid area -->
        <div class="calendar-v3-main">
          @if (config.viewMode === 'operators' && operatorGridData) {
            <app-operator-grid-v3
              #operatorGrid
              [readOnly]="readOnly"
              [gridData]="operatorGridData"
              [columnWidth]="config.compactMode ? 0 : (config.viewType === 'weekly' ? 120 : 180)"
              [showDateInHeader]="config.viewType === 'weekly'"
              [selectedDate]="selectedTreatmentDay"
              (dateHeaderClick)="onDateHeaderClick($event)"
              [currentTimeTop]="currentTimeTop"
              [compactMode]="config.compactMode"
              [availableSlots]="availableSlots"
              [highlightedAppointmentId]="highlightedAppointmentId"
              [showUnavailablePattern]="showUnavailableCellsBackground"
              [selectionMode]="clipboard.isSelecting"
              [pasteMode]="clipboard.isPasting"
              (cellDblClick)="onCellDblClick($event)"
              (availableSlotClick)="onAvailableSlotDblClick($event)"
              (availableSlotDblClick)="onAvailableSlotDblClick($event)"
              (eventClick)="onEventClick($event)"
              (eventDblClick)="onEventDblClick($event)"
              (dragMove)="onDragMove($event)"
              (resizeEnd)="onResizeEnd($event)"
              (pasteOnSlot)="onPasteOnSlot($event)">
            </app-operator-grid-v3>
          }

          <!-- Banner copia/incolla: visibile durante selezione o incollo. -->
          @if (clipboard.isActive) {
            <app-appointment-paste-bar
              [phase]="clipboard.phase"
              [summary]="clipboard.getSummary()"
              (cancel)="onCancelCopy()"
              (dragStarted)="onPasteDragStarted()"
              (dragEnded)="onPasteDragEnded($event)">
            </app-appointment-paste-bar>
          }

          @if (config.viewMode === 'gyms') {
            <app-gym-grid-v2
              [timeSlots]="gymTimeSlots"
              [gymRooms]="gymRooms"
              [dates]="visibleDates"
              [allSlotsInfo]="gymSlotsData"
              [allAppointments]="gymAppointmentsData"
              [slotHeight]="60 * config.zoom"
              [columnWidth]="config.compactMode ? 0 : 200"
              [compactMode]="config.compactMode"
              [isWeekly]="config.viewType === 'weekly'"
              (slotClick)="onGymSlotClick($event)"
              (slotDblClick)="onGymSlotDblClick($event)"
              (appointmentClick)="onGymAppointmentClick($event)">
            </app-gym-grid-v2>
          }

          @if (config.viewMode === 'rooms') {
            <app-rooms-view-container
              [dates]="visibleDates"
              [viewType]="config.viewType"
              [compactMode]="config.compactMode"
              [zoom]="config.zoom"
              [showWeekend]="config.showWeekend"
              [showWorkingHoursOnly]="config.showWorkingHoursOnly">
            </app-rooms-view-container>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .calendar-v3 {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #f8fafc;
    }

    .calendar-v3-body {
      flex: 1;
      display: flex;
      overflow: hidden;
      position: relative;
    }

    .calendar-v3-main {
      flex: 1;
      // Senza min-width:0 il flex item si allarga al min-content del
      // contenuto (vista Studi espansa) e sfonda il body che ha overflow
      // hidden: lo scroll orizzontale deve avvenire QUI o più in basso.
      min-width: 0;
      overflow: auto;
      padding: 16px;
    }

    .loading-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: rgba(248, 250, 252, 0.8);
      z-index: 10;
      color: #64748b;
    }
  `],
})
export class CalendarV3Container implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);

  stateService = inject(CalendarV2StateService);
  private dataService = inject(CalendarV2DataService);
  private v3DataService = inject(CalendarV3DataService);
  private gridService = inject(CalendarV2GridService);
  private operatorService = inject(OperatorService);
  private settingsService = inject(SettingsService);
  private dialog = inject(MatDialog);
  private appointmentService = inject(AvailabilityAppointmentService);
  private sseService = inject(SseService);
  private treatmentService = inject(TreatmentService);
  private instrumentService = inject(InstrumentService);
  private gymRoomService = inject(GymRoomService);
  private overlay = inject(Overlay);
  private snackBar = inject(MatSnackBar);
  private permissions = inject(PermissionsService);
  private oidcAuth = inject(OidcAuthService);
  private router = inject(Router);
  private operatorWorkspaceState = inject(OperatorWorkspaceStateService);
  private instructorWorkspaceState = inject(InstructorWorkspaceStateService);
  /** Stato del flusso copia/incolla appuntamento (pubblico: usato nel template). */
  clipboard = inject(AppointmentClipboardService);
  /** Chat WhatsApp: pannello "Chat in corso" in sidebar e apertura riquadri. */
  chatState = inject(WhatsappChatStateService);

  /** Riferimento alla griglia operatori, per l'hit-test del drop in pasteMode. */
  @ViewChild('operatorGrid') operatorGrid?: OperatorGridV3Component;

  // State
  loading = false;

  /**
   * Modalità SOLA LETTURA del proprio calendario. Attiva per operatore /
   * medico / istruttore: vedono solo il proprio calendario, senza poter
   * creare/spostare/modificare appuntamenti. Segreteria/admin → false (uso pieno).
   */
  readOnly = false;
  /** operatorId del proprio record Operator (read-only): calendario bloccato su di lui. */
  private selfOperatorId: string | null = null;
  /** true se l'utente read-only è un istruttore palestra (vista 'gyms' forzata). */
  private selfIsGymInstructor = false;
  /** Route della scheda appuntamenti su cui rimbalzare al doppio click (read-only). */
  private appointmentsRoute = '/operatori-new/appuntamenti';

  config: CalendarV2Config = this.stateService.config;
  visibleDates: string[] = [];
  appointmentCount = 0;
  treatments: Treatment[] = [];
  currentDateLabel = '';
  sidebarCollapsed = false;
  /** Da calendar settings: blocca appuntamenti fuori disponibilita' operatore. */
  blockOutsideAvailability = false;
  /** Da calendar settings: trama tratteggiata sulle celle non disponibili. */
  showUnavailableCellsBackground = false;
  /** Da calendar settings: operatori tutti selezionati all'apertura. */
  operatorsSelectedOnLoad = false;
  /** Da calendar settings: mostra categoria/operatori "Istruttori palestra". */
  showGymInstructorsInOperators = true;
  /** Da calendar settings: categoria operatori di default in sidebar (all|doctor|physiotherapist|gym_instructor). */
  defaultOperatorCategory = 'all';
  /**
   * Da calendar settings: cosa fa il click su un appuntamento nella vista
   * operatori. 'edit-first' (default) = click modifica, doppio click riepilogo;
   * 'summary-first' = il contrario.
   */
  appointmentClickAction: AppointmentClickAction = 'edit-first';
  /** Categoria iniziale da riflettere nel dropdown della sidebar ('' = Tutte). */
  initialSelectedCategory = '';
  /**
   * Giorno (YYYY-MM-DD) selezionato cliccando una colonna nella griglia in
   * vista settimanale: filtra/espande i trattamenti di quel giorno in sidebar.
   */
  selectedTreatmentDay: string | null = null;
  operatorGridData: OperatorGridData | null = null;
  currentTimeTop = -1;
  private currentTimeInterval: any;

  /** Chiave sessionStorage per lo snapshot delle impostazioni /settings. */
  private static readonly SETTINGS_SNAPSHOT_KEY = 'calendar-v3-settings-snapshot';
  /** Chiave sessionStorage per la selezione operatori (id selezionati). */
  private static readonly OPERATOR_SELECTION_KEY = 'calendar-v3-operator-selection';
  /** true quando il caricamento ha gia' applicato lo stato iniziale operatori. */
  private operatorSelectionRestored = false;

  // Search slot state
  // "Mostra slot disponibili" abilitato di default (deve combaciare con la
  // sidebar v2 riusata, che lo mostra spuntato all'avvio).
  slotSearchEnabled = true;
  searchFilters: SearchFilters = {
    duration: 45, withInstrument: false, instrumentCount: 1,
    instrumentPosition: 'first', instrumentOrderMatters: false,
    instrumentCategoryId: null, instrument2CategoryId: null,
  };
  availableSlots: AvailableSlotPosition[] = [];
  instrumentCategories: any[] = [];

  // Shared data for dialogs
  patients: Patient[] = [];
  allUsers: User[] = [];

  // Gym state
  gymRooms: GymRoom[] = [];
  gymTimeSlots: any[] = [];
  gymSlotsData: Map<string, Map<string, any[]>> = new Map();
  gymAppointmentsData: Map<string, Map<string, any[]>> = new Map();

  // Gym slot summary overlay (doppio click) + debounce per distinguere
  // dal click singolo (prenotazione). Vedi onGymSlotClick/onGymSlotDblClick.
  private gymSlotClickTimer: ReturnType<typeof setTimeout> | null = null;
  private gymSummaryOverlayRef: OverlayRef | null = null;
  private gymSummaryEvent: GymSlotClickEvent | null = null;
  private static readonly GYM_CLICK_DEBOUNCE_MS = 250;

  // Arbitro click/doppio click sul chip appuntamento (vista operatori): la
  // griglia emette sia `click` sia `dblclick`, quindi senza debounce il primo
  // click scatterebbe sempre e il doppio click non sarebbe raggiungibile.
  private eventClickTimer: ReturnType<typeof setTimeout> | null = null;
  /** Overlay CDK del riquadro riassunto appuntamento. */
  private appointmentSummaryOverlayRef: OverlayRef | null = null;

  async ngOnInit(): Promise<void> {
    await this.resolveReadOnlyMode();
    this.loadInitialData();
    this.subscribeToState();
    this.startCurrentTimeUpdates();
    this.subscribeToSse();
  }

  /**
   * Decide se il calendario va in modalità sola lettura "proprio calendario".
   * Operatore/medico/istruttore → read-only sul proprio operatore; gli
   * istruttori in vista palestra. Segreteria/admin → uso pieno.
   *
   * Carica il profilo (myProfile.operatorId) per sapere QUALE operatore è
   * l'utente. Se manca l'operatorId, resta in modalità piena per non lasciare
   * un calendario vuoto (il backend resta comunque la fonte di verità).
   */
  private async resolveReadOnlyMode(): Promise<void> {
    const fullAccess = this.oidcAuth.hasRole([
      'segreteria', 'admin', 'amministratore', 'superadmin',
    ]);
    if (fullAccess) {
      this.readOnly = false;
      return;
    }

    const selfRole = this.oidcAuth.hasRole(['operatore', 'medico', 'istruttore']);
    if (!selfRole) {
      this.readOnly = false;
      return;
    }

    const profile = await this.permissions.ensureLoaded().catch(() => null);
    this.selfOperatorId = profile?.operatorId ?? null;

    // Senza operatorId non possiamo filtrare il "proprio" calendario: meglio
    // non attivare il read-only (evita una vista vuota e fuorviante).
    if (!this.selfOperatorId) {
      this.readOnly = false;
      return;
    }

    this.readOnly = true;
    this.selfIsGymInstructor = this.oidcAuth.hasRole(['istruttore']);
    this.appointmentsRoute = this.selfIsGymInstructor
      ? '/istruttori/appuntamenti'
      : '/operatori-new/appuntamenti';

    // L'istruttore vede il proprio calendario in modalità palestra.
    if (this.selfIsGymInstructor) {
      this.stateService.updateConfig({ viewMode: 'gyms' });
      this.config = this.stateService.config;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.currentTimeInterval) clearInterval(this.currentTimeInterval);
    if (this.gymSlotClickTimer) clearTimeout(this.gymSlotClickTimer);
    if (this.eventClickTimer) clearTimeout(this.eventClickTimer);
    this.closeGymSummary();
    this.closeAppointmentSummary();
    // Non lasciare un flusso copia/incolla pendente uscendo dalla pagina.
    this.clipboard.clear();
  }

  // ==================== INITIALIZATION ====================

  private async loadInitialData(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();

    // true se le impostazioni /settings sono cambiate (o primo caricamento):
    // in tal caso la selezione operatori salvata va scartata e si riparte
    // dal default.
    let settingsChanged = false;

    try {
      try {
        const settings = await this.settingsService.getCalendarSettings().toPromise();
        if (settings) {
          this.blockOutsideAvailability = settings.blockAppointmentsOutsideAvailability;
          this.showUnavailableCellsBackground = settings.showUnavailableCellsBackground;
          this.operatorsSelectedOnLoad = settings.operatorsSelectedOnLoad;
          this.showGymInstructorsInOperators = settings.showGymInstructorsInOperators;
          this.defaultOperatorCategory = settings.defaultOperatorCategory || 'all';
          this.appointmentClickAction =
            settings.appointmentClickAction === 'summary-first' ? 'summary-first' : 'edit-first';

          // Le impostazioni di /settings (durata slot, vista, orari,
          // weekend) sono il default iniziale, ma vanno RIAPPLICATE se
          // l'admin le ha cambiate dall'ultimo caricamento. Confronto uno
          // snapshot in sessionStorage: se diverso (o assente), riapplico.
          // Zoom/data/compatto restano gestiti dallo stato di sessione.
          const snapshot = JSON.stringify({
            slotDuration: settings.slotDuration,
            showWorkingHoursOnly: settings.showWorkingHoursOnly,
            showWeekend: settings.showWeekend,
            defaultView: settings.defaultView,
            // Anche le impostazioni che pilotano la selezione iniziale operatori
            // devono invalidare lo snapshot, così cambiarle riapplica il default
            // (altrimenti resterebbe la selezione salvata stantia → lista vuota).
            operatorsSelectedOnLoad: settings.operatorsSelectedOnLoad,
            showGymInstructorsInOperators: settings.showGymInstructorsInOperators,
            defaultOperatorCategory: settings.defaultOperatorCategory,
          });
          const prevSnapshot = sessionStorage.getItem(CalendarV3Container.SETTINGS_SNAPSHOT_KEY);
          const hasStoredState = sessionStorage.getItem('calendar-v2-state') !== null;
          // Riapplica al primo caricamento (niente stato salvato) o se le
          // impostazioni globali sono cambiate.
          const shouldApplySettings = !hasStoredState || prevSnapshot !== snapshot;
          settingsChanged = shouldApplySettings;

          this.stateService.updateConfig({
            workingHoursStart: settings.startHour,
            workingHoursEnd: settings.endHour,
            ...(shouldApplySettings ? {
              slotDuration: settings.slotDuration,
              showWorkingHoursOnly: settings.showWorkingHoursOnly,
              showWeekend: settings.showWeekend,
              viewType: settings.defaultView as any,
            } : {}),
          });
          sessionStorage.setItem(CalendarV3Container.SETTINGS_SNAPSHOT_KEY, snapshot);
        }
      } catch { /* usa defaults */ }

      const operators = await this.operatorService.getOperators(undefined, undefined, true)
        .toPromise() || [];

      // Selezione iniziale operatori:
      // - se le impostazioni sono cambiate (o primo caricamento) → default
      //   dall'impostazione operatorsSelectedOnLoad;
      // - altrimenti, se c'e' una selezione salvata in sessione, la
      //   ripristina (l'utente l'ha modificata e va mantenuta).
      const savedSelection = settingsChanged
        ? null
        : this.loadOperatorSelection();

      // Categoria di default effettiva: se è "gym_instructor" ma gli istruttori
      // sono nascosti, oppure se nessun operatore ha quella categoria, si ricade
      // su "all". Usata solo al primo caricamento (nessuna selezione salvata).
      const effectiveDefaultCategory = this.resolveDefaultOperatorCategory(operators);
      this.initialSelectedCategory = effectiveDefaultCategory === 'all' ? '' : effectiveDefaultCategory;

      const matchesDefaultCategory = (op: any): boolean => {
        if (effectiveDefaultCategory === 'all') return true;
        return String(op.macroCategory).toLowerCase() === effectiveDefaultCategory;
      };

      const calendarOperators: CalendarOperator[] = operators.map(op => {
        // Istruttori palestra nascosti dalle impostazioni: mai selezionati,
        // così non compaiono né in sidebar né nella griglia.
        const gymHidden = !this.showGymInstructorsInOperators
          && String(op.macroCategory).toLowerCase() === 'gym_instructor';
        // Selezione iniziale (nessuna selezione salvata):
        // - "Seleziona tutti all'apertura" decide SE partono selezionati;
        // - la categoria di default è solo un filtro di VISUALIZZAZIONE, non
        //   forza la selezione. Se "seleziona tutti" è ON e c'è una categoria,
        //   si selezionano solo gli operatori di quella categoria.
        const freshSelected = this.operatorsSelectedOnLoad && matchesDefaultCategory(op);
        // Read-only: il calendario è bloccato sul PROPRIO operatore — solo lui
        // selezionato, ignorando default/selezione salvata.
        const selected = this.readOnly
          ? op.id === this.selfOperatorId
          : (gymHidden ? false : (savedSelection ? savedSelection.has(op.id) : freshSelected));
        return {
          id: op.id,
          operatorId: op.id,
          name: `${op.name}${op.surname ? ' ' + op.surname : ''}`,
          color: op.color || '#667eea',
          active: true,
          selected,
          hasTemplate: true,
          macroCategory: op.macroCategory,
        };
      });

      this.stateService.setOperators(calendarOperators);
      // Persiste subito lo stato iniziale (e ripulisce un'eventuale
      // selezione stantia se le impostazioni erano cambiate). In read-only la
      // selezione è forzata sul proprio operatore: non la persistiamo, così
      // non inquina lo stato di sessione di un eventuale account pieno.
      if (!this.readOnly) {
        this.saveOperatorSelection(calendarOperators);
      }
      this.operatorSelectionRestored = true;

      this.allUsers = operators.map(op => ({
        id: op.id,
        name: `${op.name}${op.surname ? ' ' + op.surname : ''}`,
        type: 'operator',
        color: op.color || '#667eea',
        active: true,
        operatorId: op.id,
        hasTemplate: true,
        macroCategory: op.macroCategory,
      }));

      this.dataService.loadPatients().pipe(takeUntil(this.destroy$)).subscribe({
        next: (patients) => { this.patients = patients; },
      });

      this.instrumentService.getInstrumentCategories().pipe(takeUntil(this.destroy$)).subscribe({
        next: (cats) => {
          this.instrumentCategories = cats.filter((c: any) => c.isActive !== false);
          this.cdr.markForCheck();
        },
      });
    } catch (error) {
      console.error('[CalendarV3] Error loading initial data:', error);
    }

    this.loading = false;
    this.cdr.markForCheck();
  }

  // ==================== STATE SUBSCRIPTIONS ====================

  private subscribeToState(): void {
    combineLatest([
      this.stateService.config$,
      this.stateService.visibleDates$,
      this.stateService.selectedOperators$,
    ]).pipe(
      debounceTime(300),
      takeUntil(this.destroy$),
    ).subscribe(([config, dates, operators]) => {
      this.config = config;
      this.visibleDates = dates;
      // Se il giorno selezionato per i trattamenti non e' piu' nel range
      // visibile (cambio settimana o passaggio a vista giornaliera), azzeralo.
      if (this.selectedTreatmentDay && !dates.includes(this.selectedTreatmentDay)) {
        this.selectedTreatmentDay = null;
      }
      this.updateDateLabel();
      this.loadData(config, dates, operators);
    });

    // Persiste la selezione operatori ad ogni cambio (toggle, seleziona/
    // deseleziona tutti). Cosi' un soft reload o un cambio pagina la
    // mantiene. Si salta finche' il caricamento iniziale non ha applicato
    // lo stato di partenza, per non sovrascriverlo con lista vuota.
    this.stateService.operators$
      .pipe(takeUntil(this.destroy$))
      .subscribe(operators => {
        if (this.operatorSelectionRestored && operators.length > 0) {
          this.saveOperatorSelection(operators);
        }
      });
  }

  /** Salva in sessionStorage gli id degli operatori attualmente selezionati. */
  private saveOperatorSelection(operators: CalendarOperator[]): void {
    try {
      const selectedIds = operators.filter(o => o.selected).map(o => o.operatorId);
      sessionStorage.setItem(
        CalendarV3Container.OPERATOR_SELECTION_KEY,
        JSON.stringify(selectedIds),
      );
    } catch { /* ignore */ }
  }

  /**
   * Determina la categoria di default effettiva da applicare alla sidebar:
   * - 'gym_instructor' ma istruttori nascosti → fallback 'all'
   * - categoria specifica senza operatori corrispondenti → fallback 'all'
   */
  private resolveDefaultOperatorCategory(operators: any[]): string {
    let cat = (this.defaultOperatorCategory || 'all').toLowerCase();
    if (cat === 'all') return 'all';
    if (cat === 'gym_instructor' && !this.showGymInstructorsInOperators) return 'all';
    const hasAny = operators.some(o => String(o.macroCategory).toLowerCase() === cat);
    return hasAny ? cat : 'all';
  }

  /**
   * Legge la selezione operatori da sessionStorage. Ritorna null se non
   * presente (→ si usera' il default dell'impostazione).
   */
  private loadOperatorSelection(): Set<string> | null {
    try {
      const raw = sessionStorage.getItem(CalendarV3Container.OPERATOR_SELECTION_KEY);
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        return new Set(ids);
      }
    } catch { /* ignore */ }
    return null;
  }

  private loadData(
    config: CalendarV2Config,
    dates: string[],
    operators: CalendarOperator[],
  ): void {
    if (dates.length === 0) return;

    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    this.loading = true;
    this.cdr.markForCheck();

    if (config.viewMode === 'operators') {
      const operatorIds = operators.map(o => o.operatorId);
      const withTemplate = operators.filter(o => o.hasTemplate).map(o => o.operatorId);
      const today = this.stateService.formatDate(new Date());

      // Appuntamenti + trattamenti dal data service condiviso; la
      // disponibilita' invece dal data service V3 (free-block reali).
      forkJoin({
        operatorData: this.dataService.loadOperatorData(
          operatorIds, withTemplate, startDate, endDate, today,
        ),
        availabilityV3: this.v3DataService.loadOperatorsAvailability(
          withTemplate, startDate, endDate,
        ),
      })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: ({ operatorData, availabilityV3 }) => {
            this.appointmentCount = this.countAppointments(operatorData.appointments);
            this.treatments = operatorData.treatments;

            // computeOperatorGrid riceve la disponibilita' V3 al posto di
            // operatorData.availabilities: stessa struttura, dati corretti.
            this.operatorGridData = this.gridService.computeOperatorGrid(
              config, dates, operators, operatorData.appointments, availabilityV3,
            );
            this.updateCurrentTimeTop();

            if (this.slotSearchEnabled) {
              this.searchAvailableSlots();
            }

            this.loading = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.loading = false;
            this.cdr.markForCheck();
          },
        });
    } else if (config.viewMode === 'gyms') {
      this.loadGymData(dates);
    } else if (config.viewMode === 'rooms') {
      // La vista Studi si carica da sola (RoomsViewContainer reagisce alle date)
      this.loading = false;
      this.cdr.markForCheck();
    }
  }


  // ==================== ACTIONS ====================

  onNavigatePrev(): void { this.stateService.navigatePrev(); }
  onNavigateNext(): void { this.stateService.navigateNext(); }
  onNavigateToday(): void { this.stateService.navigateToday(); }

  /**
   * Scorciatoie da tastiera:
   * - Alt+A → apre la finestra Appuntamenti
   * - Alt+T → apre la finestra Trattamenti
   *
   * Ignorate mentre si scrive in un campo di testo, per non interferire
   * con l'input (es. ricerca paziente nel dialog).
   */
  @HostListener('document:keydown', ['$event'])
  onKeyboardShortcut(event: KeyboardEvent): void {
    // ESC annulla il flusso copia/incolla in corso (selezione o incollo).
    if (event.key === 'Escape' && this.clipboard.isActive) {
      event.preventDefault();
      this.onCancelCopy();
      return;
    }

    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
    if (isTyping) return;

    const key = event.key.toLowerCase();
    if (key === 'a') {
      event.preventDefault();
      this.onOpenAppuntamenti();
    } else if (key === 't') {
      event.preventDefault();
      this.onOpenTreatments();
    }
  }

  /** Salto diretto alla data scelta dal datepicker. */
  onDatePicked(date: Date): void {
    this.stateService.setCurrentDate(date);
  }

  onViewTypeChange(viewType: 'daily' | 'weekly'): void {
    this.stateService.updateConfig({ viewType });
  }

  /** Flag da ripristinare quando si esce dalla vista Studi. */
  private flagsBeforeRooms: { showWeekend: boolean; showWorkingHoursOnly: boolean } | null = null;

  onViewModeChange(viewMode: CalendarV2Config['viewMode']): void {
    const wasRooms = this.config.viewMode === 'rooms';

    // Vista Studi: default orario lavoro ON e weekend OFF; i toggle in
    // toolbar restano utilizzabili. All'uscita si ripristinano i valori
    // precedenti per non alterare la vista operatori.
    const restored = wasRooms && viewMode !== 'rooms' && this.flagsBeforeRooms
      ? { ...this.flagsBeforeRooms }
      : {};
    if (wasRooms && viewMode !== 'rooms') this.flagsBeforeRooms = null;

    if (viewMode === 'rooms' && !wasRooms) {
      this.flagsBeforeRooms = {
        showWeekend: this.config.showWeekend,
        showWorkingHoursOnly: this.config.showWorkingHoursOnly,
      };
      this.stateService.updateConfig({
        viewMode,
        showWorkingHoursOnly: true,
        showWeekend: false,
      });
    } else if (viewMode === 'gyms') {
      this.stateService.updateConfig({ viewMode, slotDuration: 60, ...restored });
    } else {
      this.stateService.updateConfig({ viewMode, ...restored });
    }
  }

  onSlotDurationChange(slotDuration: number): void {
    this.stateService.updateConfig({ slotDuration });
  }

  onZoomChange(zoom: number): void {
    this.stateService.updateConfig({ zoom });
  }

  onShowWorkingHoursOnlyChange(showWorkingHoursOnly: boolean): void {
    this.stateService.updateConfig({ showWorkingHoursOnly });
  }

  onShowWeekendChange(showWeekend: boolean): void {
    this.stateService.updateConfig({ showWeekend });
  }

  onCompactModeChange(compactMode: boolean): void {
    this.stateService.updateConfig({ compactMode });
  }

  private waitingListDialogRef: any = null;
  private treatmentsDialogRef: any = null;
  /** Lock anti doppia-apertura: il dialog si apre in modo async (import
   *  dinamico), nel frattempo il ref e' ancora null. */
  private treatmentsOpening = false;
  private appuntamentiOpening = false;

  onOpenWaitingList(): void {
    if (this.waitingListDialogRef) return;
    import('../../../shared/components/waiting-list/waiting-list-dialog/waiting-list-dialog.container').then(m => {
      this.waitingListDialogRef = this.dialog.open(m.WaitingListDialogContainer, {
        width: '650px',
        height: '80vh',
        hasBackdrop: false,
        panelClass: 'waiting-list-dialog-panel',
        disableClose: false,
      });
      this.waitingListDialogRef.afterClosed().subscribe(() => {
        this.waitingListDialogRef = null;
      });
    });
  }

  /**
   * Apre la finestra Trattamenti, o la chiude se gia' aperta (toggle):
   * sia il pulsante in barra sia la scorciatoia Alt+T agiscono cosi'.
   */
  onOpenTreatments(): void {
    if (this.treatmentsDialogRef) {
      this.treatmentsDialogRef.close();
      return;
    }
    if (this.treatmentsOpening) return;
    this.treatmentsOpening = true;
    const today = this.stateService.formatDate(this.stateService.currentDate);
    import('../../trattamenti/containers/trattamenti-dialog.container').then(m => {
      this.treatmentsDialogRef = this.dialog.open(m.TrattamentiDialogContainer, {
        data: {
          initialFilters: { dateFrom: today, dateTo: today },
          initialViewMode: 'flat',
        },
        width: '1100px',
        maxWidth: '95vw',
        height: '80vh',
        maxHeight: '90vh',
        hasBackdrop: false,
        panelClass: 'trattamenti-dialog-pane',
        disableClose: false,
        autoFocus: false,
      });
      this.treatmentsOpening = false;
      this.treatmentsDialogRef.afterClosed().subscribe(() => {
        this.treatmentsDialogRef = null;
      });
    }).catch(() => { this.treatmentsOpening = false; });
  }

  private appuntamentiDialogRef: any = null;

  /**
   * Apre la finestra "Appuntamenti" (ricerca paziente, lista appuntamenti,
   * riprenotazione), o la chiude se gia' aperta (toggle): sia il pulsante
   * in barra sia la scorciatoia Alt+A agiscono cosi'.
   * Passa al dialog le callback goToCalendar/editAppointment e gli operatori.
   */
  onOpenAppuntamenti(): void {
    if (this.appuntamentiDialogRef) {
      this.appuntamentiDialogRef.close();
      return;
    }
    if (this.appuntamentiOpening) return;
    this.appuntamentiOpening = true;
    import('./appuntamenti-dialog.container').then(m => {
      this.appuntamentiDialogRef = this.dialog.open(m.AppuntamentiDialogContainer, {
        width: '1150px',
        maxWidth: '97vw',
        height: '82vh',
        maxHeight: '92vh',
        hasBackdrop: false,
        panelClass: 'appuntamenti-dialog-pane',
        disableClose: false,
        autoFocus: false,
        data: {
          operators: this.stateService.operators.map(o => ({
            id: o.operatorId,
            name: o.name,
            macroCategory: o.macroCategory ?? '',
          })),
          goToCalendar: (appt: any) => this.navigateToAppointment(appt),
          editAppointment: (appt: any) => this.editAppointmentFromDialog(appt),
        },
      });
      this.appuntamentiOpening = false;
      this.appuntamentiDialogRef.afterClosed().subscribe(() => {
        this.appuntamentiDialogRef = null;
      });
    }).catch(() => { this.appuntamentiOpening = false; });
  }

  /** ID dell'appuntamento da evidenziare brevemente sul calendario. */
  highlightedAppointmentId: string | null = null;

  /**
   * Naviga il calendario alla data dell'appuntamento, assicura che il suo
   * operatore sia selezionato, ed evidenzia il chip per qualche secondo.
   */
  private navigateToAppointment(appt: { appointmentDate: string; operatorId: string; id: string }): void {
    this.stateService.setCurrentDate(new Date(appt.appointmentDate + 'T00:00:00'));
    // Assicura che l'operatore dell'appuntamento sia tra quelli selezionati.
    const op = this.stateService.operators.find(o => o.operatorId === appt.operatorId);
    if (op && !op.selected) {
      this.stateService.setOperatorSelection([appt.operatorId], true);
    }
    this.highlightedAppointmentId = appt.id;
    this.cdr.markForCheck();
    // Rimuove l'evidenziazione dopo qualche secondo.
    setTimeout(() => {
      this.highlightedAppointmentId = null;
      this.cdr.markForCheck();
    }, 4000);
  }

  /**
   * Apre il form standard di modifica appuntamento (usato dalla finestra
   * Appuntamenti). Riceve un AvailabilityAppointment, lo mappa al model
   * Appointment, apre EventMatDialogComponent e attende la chiusura.
   * Ritorna true se l'appuntamento e' stato modificato/eliminato.
   */
  private async editAppointmentFromDialog(aa: AvailabilityAppointment): Promise<boolean> {
    const appointment = mapAvailabilityAppointmentToAppointment(aa);
    const dialogData: EventMatDialogData = {
      appointment,
      users: this.allUsers,
      patients: this.patients,
      instrumentCategories: this.instrumentCategories,
    };
    const ref = this.dialog.open(EventMatDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      disableClose: false,
      data: dialogData,
    });
    const result: EventMatDialogResult | undefined =
      await firstValueFrom(ref.afterClosed());

    if (!result || result.action === 'cancel') return false;

    if (result.action === 'save' && result.appointment) {
      await this.saveAppointment(result);
      this.reloadCurrentView();
      return true;
    }
    if (result.action === 'delete' && result.appointment) {
      try {
        await firstValueFrom(
          this.appointmentService.deleteAppointment(String(result.appointment.id)),
        );
      } catch (err: any) {
        alert(err?.graphQLErrors?.[0]?.message || 'Errore nell\'eliminazione');
      }
      this.reloadCurrentView();
      return true;
    }
    return false;
  }

  // ==================== AVAILABILITY GUARD ====================

  /**
   * Verifica se un appuntamento [start,end] per operatore/data e' dentro la
   * disponibilita'. Se il flag di blocco e' attivo e l'orario e' fuori,
   * chiede conferma all'utente.
   *
   * Ritorna:
   * - 'proceed': procedi senza forzatura (dentro disponibilita', o flag off)
   * - 'force': l'utente ha confermato la forzatura → passare forceOutsideAvailability
   * - 'cancel': l'utente ha annullato → non procedere
   */
  private async checkAvailabilityGuard(
    operatorId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeRange?: { startTime: string; endTime: string },
  ): Promise<'proceed' | 'force' | 'cancel'> {
    if (!this.blockOutsideAvailability) return 'proceed';

    const within = isAppointmentWithinAvailability(
      this.operatorGridData, operatorId, date, startTime, endTime, excludeRange,
    );
    if (within) return 'proceed';

    const data: ConfirmMatDialogData = {
      title: 'Orario fuori disponibilità',
      message:
        `L'orario ${startTime} - ${endTime} è fuori dalla disponibilità ` +
        `dell'operatore.\nVuoi procedere comunque?`,
      confirmText: 'Procedi comunque',
      cancelText: 'Annulla',
      confirmColor: 'warn',
      icon: 'warning',
    };
    const confirmed = await firstValueFrom(
      this.dialog.open(ConfirmMatDialogComponent, { width: '440px', data }).afterClosed(),
    );
    return confirmed ? 'force' : 'cancel';
  }

  // ==================== UTILITIES ====================

  private updateDateLabel(): void {
    const date = this.stateService.currentDate;
    if (this.config.viewType === 'daily') {
      this.currentDateLabel = date.toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
    } else {
      const start = new Date(this.visibleDates[0] + 'T00:00:00');
      const end = new Date(this.visibleDates[this.visibleDates.length - 1] + 'T00:00:00');
      this.currentDateLabel = `${start.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
  }

  private countAppointments(map: Map<string, Map<string, Appointment[]>>): number {
    let count = 0;
    for (const dateMap of map.values()) {
      for (const apts of dateMap.values()) {
        count += apts.length;
      }
    }
    return count;
  }

  // ==================== TRATTAMENTI: FILTRO PER GIORNO ====================

  /**
   * Click su un'intestazione giorno/colonna nella griglia (vista settimanale):
   * seleziona quel giorno per filtrare/espandere i trattamenti in sidebar.
   * Ri-cliccare lo stesso giorno deseleziona (torna a tutta la settimana).
   */
  onDateHeaderClick(date: string): void {
    this.selectedTreatmentDay = this.selectedTreatmentDay === date ? null : date;
    this.cdr.markForCheck();
  }

  // ==================== SLOT SEARCH ====================

  onSlotSearchToggle(enabled: boolean): void {
    this.slotSearchEnabled = enabled;
    if (enabled) {
      this.searchAvailableSlots();
    } else {
      this.availableSlots = [];
      this.cdr.markForCheck();
    }
  }

  onSearchFiltersChange(filters: SearchFilters): void {
    this.searchFilters = filters;
    if (this.slotSearchEnabled) {
      this.searchAvailableSlots();
    }
  }

  onAvailableSlotDblClick(slot: AvailableSlotPosition): void {
    if (this.readOnly) return; // sola lettura: niente prenotazione su slot libero
    const endMinutes = this.timeToMinutes(slot.startTime) + this.searchFilters.duration;
    this.openEventDialog({
      defaultDate: slot.date,
      defaultStartTime: slot.startTime,
      defaultEndTime: this.minutesToTime(endMinutes),
      defaultOperatorId: slot.operatorId,
      users: this.allUsers,
      patients: this.patients,
      searchFilters: {
        duration: this.searchFilters.duration,
        withInstrument: this.searchFilters.withInstrument,
        instrumentCount: this.searchFilters.instrumentCount,
        instrumentCategoryId: this.searchFilters.instrumentCategoryId,
        instrument2CategoryId: this.searchFilters.instrument2CategoryId,
        instrumentPosition: this.searchFilters.instrumentPosition,
        instrumentOrderMatters: this.searchFilters.instrumentOrderMatters,
        suggestedInstruments: slot.availableInstruments,
      },
    });
  }

  // ==================== COPIA / INCOLLA APPUNTAMENTO ====================

  /** Pulsante toolbar: avvia il flusso copia (o lo annulla se gia' attivo). */
  onToggleCopyMode(): void {
    if (this.readOnly) return; // sola lettura: copia/incolla disabilitato
    if (this.clipboard.isActive) {
      this.onCancelCopy();
    } else {
      this.clipboard.startSelecting();
      this.snackBar.open('Clicca l\'appuntamento da copiare', 'Annulla', { duration: 4000 })
        .onAction().pipe(takeUntil(this.destroy$)).subscribe(() => this.onCancelCopy());
      this.cdr.markForCheck();
    }
  }

  /** Annulla il flusso copia/incolla e ripristina gli slot normali. */
  onCancelCopy(): void {
    if (!this.clipboard.isActive) return;
    this.clipboard.clear();
    this.refreshSlotsAfterCopyChange();
    this.cdr.markForCheck();
  }

  /**
   * Copia l'appuntamento ed entra in fase incollo: ricalcola gli slot
   * compatibili (durata + strumenti) su tutti i fisioterapisti idonei.
   * Usato sia dal click in modalita' selezione, sia dal pulsante "Copia" del
   * dialog di modifica.
   */
  private startPaste(appointment: Appointment): void {
    this.clipboard.copy(appointment);
    this.refreshSlotsAfterCopyChange();
    this.cdr.markForCheck();
  }

  /**
   * Click su uno slot (o drop della chip) in fase incollo: crea il nuovo
   * appuntamento copiando tutto tranne data/ora/operatore, con snackbar Undo.
   */
  async onPasteOnSlot(slot: PasteTargetSlot): Promise<void> {
    const input = this.clipboard.buildCreateInput(slot);
    if (!input) return;

    // Esci dalla modalita' incollo subito: evita doppi incolli accidentali.
    this.clipboard.clear();
    this.refreshSlotsAfterCopyChange();

    try {
      const created = await firstValueFrom(this.appointmentService.createAppointment(input));
      this.reloadCurrentView();
      this.offerUndo(String(created.id));
    } catch (err: any) {
      const msg = err?.graphQLErrors?.[0]?.message || err?.message || 'Errore durante la duplicazione';
      if (typeof msg === 'string' && msg.includes('APPOINTMENT_OUTSIDE_AVAILABILITY')) {
        this.snackBar.open('Lo slot scelto non è più disponibile.', 'OK', { duration: 4000 });
      } else {
        this.snackBar.open(msg, 'OK', { duration: 5000 });
      }
      this.reloadCurrentView();
    }
  }

  /** Snackbar "Appuntamento duplicato" con azione Annulla (hard delete). */
  private offerUndo(newAppointmentId: string): void {
    this.snackBar.open('Appuntamento duplicato', 'Annulla', { duration: 6000 })
      .onAction().pipe(takeUntil(this.destroy$)).subscribe(async () => {
        try {
          await firstValueFrom(this.appointmentService.deleteAppointment(newAppointmentId));
          this.reloadCurrentView();
        } catch {
          this.snackBar.open('Impossibile annullare la duplicazione', 'OK', { duration: 4000 });
        }
      });
  }

  /** Inizio drag della chip dal banner: nessuna azione (gli slot sono gia' evidenziati). */
  onPasteDragStarted(): void {
    // no-op: gli slot bersaglio sono gia' evidenziati in pasteMode.
  }

  /** Fine drag della chip: hit-test dello slot sotto il punto di rilascio. */
  onPasteDragEnded(point: { x: number; y: number }): void {
    if (!this.clipboard.isPasting) return;
    const slot = this.operatorGrid?.resolveSlotAtPoint(point.x, point.y);
    if (slot) {
      this.onPasteOnSlot(slot);
    }
    // Drop fuori da uno slot valido → non fa nulla, il banner resta aperto.
  }

  /**
   * Ricalcola gli slot dopo un cambio di fase copia/incolla.
   * - In pasteMode: cerca con i vincoli dell'appuntamento copiato.
   * - Altrimenti: ripristina la ricerca normale (se abilitata) o svuota.
   */
  private refreshSlotsAfterCopyChange(): void {
    if (this.clipboard.isPasting || this.slotSearchEnabled) {
      this.searchAvailableSlots();
    } else {
      this.availableSlots = [];
      this.cdr.markForCheck();
    }
  }

  private searchAvailableSlots(): void {
    if (!this.operatorGridData) return;

    const operators = this.stateService.selectedOperators.filter(o => o.hasTemplate);
    if (operators.length === 0) {
      this.availableSlots = [];
      this.cdr.markForCheck();
      return;
    }

    const operatorIds = operators.map(o => o.operatorId);
    const operatorMap = new Map(operators.map(o => [o.operatorId, o]));

    // In modalita' incollo i vincoli vengono dall'appuntamento copiato
    // (durata + strumenti con offset), non dai filtri sidebar: cosi' restano
    // evidenziati solo gli slot dove l'appuntamento entra davvero, su QUALSIASI
    // fisioterapista compatibile.
    let duration: number;
    let customInstrumentSlots: { instrumentCategoryId: string; startOffsetMinutes: number; endOffsetMinutes: number }[] | undefined;
    let instrumentOrderMatters: boolean | undefined;
    if (this.clipboard.isPasting) {
      duration = this.clipboard.getDurationMinutes();
      const slots = this.clipboard.getInstrumentSlots();
      customInstrumentSlots = slots.length ? slots : undefined;
      instrumentOrderMatters = this.clipboard.getInstrumentOrderMatters();
    } else {
      duration = this.searchFilters.duration;
      const built = this.buildInstrumentSlotsFromFilters();
      customInstrumentSlots = built.customInstrumentSlots;
      instrumentOrderMatters = built.instrumentOrderMatters;
    }

    this.operatorService.getPhysiotherapistAvailableSlotsBatch(
      operatorIds,
      this.visibleDates,
      duration,
      customInstrumentSlots,
      instrumentOrderMatters,
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (slots) => {
        this.availableSlots = slots
          .filter(s => s.available)
          .map(s => {
            const op = operatorMap.get(s.operatorId);
            return this.buildSlotPosition(
              op || { operatorId: s.operatorId, color: '#667eea' } as any,
              s.date,
              s,
            );
          });
        this.cdr.markForCheck();
      },
      error: () => {
        this.availableSlots = [];
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Costruisce i customInstrumentSlots per la ricerca batch a partire dai
   * filtri della sidebar. Replica la logica di offset del dialog appuntamento
   * (event-mat-dialog buildInstrumentData):
   * - 1 strumento: 'first' → [0,30], 'second' → [durata-30, durata]
   * - 2 strumenti durata 45 → [0,30] + [15,45]; altrimenti metà/metà
   *
   * Ritorna slot vuoti quando il filtro strumenti è disattivo o quando la
   * categoria è "Qualsiasi" (null): senza una categoria concreta il backend
   * non può validare lo strumento, quindi si ricade sul solo filtro durata.
   */
  private buildInstrumentSlotsFromFilters(): {
    customInstrumentSlots?: { instrumentCategoryId: string; startOffsetMinutes: number; endOffsetMinutes: number }[];
    instrumentOrderMatters?: boolean;
  } {
    const f = this.searchFilters;
    if (!f.withInstrument || !f.instrumentCategoryId) {
      return {};
    }

    const duration = f.duration;
    const slots: { instrumentCategoryId: string; startOffsetMinutes: number; endOffsetMinutes: number }[] = [];

    if (f.instrumentCount === 2 && f.instrument2CategoryId) {
      if (duration === 45) {
        slots.push({ instrumentCategoryId: f.instrumentCategoryId, startOffsetMinutes: 0, endOffsetMinutes: 30 });
        slots.push({ instrumentCategoryId: f.instrument2CategoryId, startOffsetMinutes: 15, endOffsetMinutes: 45 });
      } else {
        const half = Math.floor(duration / 2);
        slots.push({ instrumentCategoryId: f.instrumentCategoryId, startOffsetMinutes: 0, endOffsetMinutes: half });
        slots.push({ instrumentCategoryId: f.instrument2CategoryId, startOffsetMinutes: half, endOffsetMinutes: duration });
      }
      return { customInstrumentSlots: slots, instrumentOrderMatters: f.instrumentOrderMatters };
    }

    // 1 strumento
    if (duration === 30 || f.instrumentPosition === 'first') {
      slots.push({ instrumentCategoryId: f.instrumentCategoryId, startOffsetMinutes: 0, endOffsetMinutes: 30 });
    } else {
      slots.push({ instrumentCategoryId: f.instrumentCategoryId, startOffsetMinutes: duration - 30, endOffsetMinutes: duration });
    }
    return { customInstrumentSlots: slots };
  }

  private buildSlotPosition(op: CalendarOperator, date: string, slot: any): AvailableSlotPosition {
    const gridData = this.operatorGridData!;
    const gridStartMinutes = gridData.timeSlots.length > 0
      ? this.timeToMinutes(gridData.timeSlots[0].time) : 0;
    const slotDuration = gridData.timeSlots.length > 1
      ? this.timeToMinutes(gridData.timeSlots[1].time) - gridStartMinutes : 45;
    const pxPerMinute = gridData.slotHeightPx / slotDuration;

    const startMin = this.timeToMinutes(slot.startTime);
    const endMin = this.timeToMinutes(slot.endTime);

    return {
      operatorId: op.operatorId,
      date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      topPx: (startMin - gridStartMinutes) * pxPerMinute,
      heightPx: (endMin - startMin) * pxPerMinute,
      color: op.color,
      availableInstruments: slot.suggestedInstruments?.map((i: any) => ({
        id: i.instrumentId, name: i.categoryName, categoryId: i.instrumentCategoryId,
      })),
    };
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // ==================== SSE ====================

  private subscribeToSse(): void {
    this.sseService.getAppointmentEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event: any) => {
          // Appuntamenti: cambi di stato (auto-attendance, conferme) e
          // creazione/modifica/cancellazione fatte da altri utenti
          // (appointment_changed, 2026-07-29). Ricarica in ENTRAMBE le
          // modalità: la griglia palestra mostra gli stessi appuntamenti.
          if (['appointment_status_changed', 'appointment_changed'].includes(event.type)) {
            this.reloadCurrentView();
          }
          // Cambio di stato di un trattamento gia' in lista: refetch mirato del
          // singolo trattamento, cosi' la sidebar (badge stato + dettagli) si
          // aggiorna senza ricaricare la griglia ne' resettare ricerca/popup.
          if (event.type === 'treatment_status_changed' && event.treatmentId
              && this.treatments.some(t => t.id === event.treatmentId)) {
            this.refreshSingleTreatment(event.treatmentId);
            return;
          }
          // Creazione/eliminazione (o status_changed di un trattamento non in
          // lista, che potrebbe doverci entrare): reload completo.
          if (['treatment_created', 'treatment_status_changed', 'treatment_deleted'].includes(event.type)) {
            this.reloadCurrentView();
          }
          // Struttura orari cambiata da un altro utente (template, eccezioni,
          // assenze, festività, palestra): la griglia disponibilità è stale.
          if (event.type === 'availability_changed') {
            this.reloadCurrentView();
          }
        },
      });
  }

  /**
   * Refetch mirato di un singolo trattamento (su evento SSE di cambio stato) e
   * sostituzione in-place nell'array, mantenendo l'ordine. Riassegna l'array
   * per far girare l'OnPush change-detection. Se non torna piu' (es. uscito dai
   * filtri lato server) ricarica la vista.
   */
  private refreshSingleTreatment(treatmentId: string): void {
    this.treatmentService.getTreatment(treatmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (fresh) => {
          if (!fresh) {
            this.reloadCurrentView();
            return;
          }
          this.treatments = this.treatments.map(t => t.id === treatmentId ? fresh : t);
          // Mantieni allineato il popup dettagli se stava mostrando questo trattamento.
          this.cdr.markForCheck();
        },
        error: () => this.reloadCurrentView(),
      });
  }

  // ==================== GYM DATA ====================

  private async loadGymData(dates: string[]): Promise<void> {
    if (this.gymRooms.length === 0) {
      try {
        const rooms = await this.dataService.loadGymRooms().toPromise() || [];
        this.gymRooms = rooms.map(r => ({
          id: r.id,
          name: r.name,
          color: r.color || '#10b981',
          maxCapacity: r.maxCapacity,
        }));
      } catch { this.gymRooms = []; }
    }

    if (this.gymRooms.length === 0) {
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.gymTimeSlots = this.stateService.computeTimeSlotsPublic(this.config);

    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const roomIds = this.gymRooms.map(r => r.id);

    this.dataService.loadGymData(roomIds, startDate, endDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.gymSlotsData = new Map();
          this.gymAppointmentsData = new Map();

          for (const date of dates) {
            const dateSlots = new Map<string, any[]>();
            const dateApts = new Map<string, any[]>();

            for (const roomId of roomIds) {
              const allSlots = result.slotsInfo.get(date) || [];
              dateSlots.set(roomId, allSlots.filter((s: any) => s.gymRoomId === roomId));

              const allApts = result.appointments.get(date) || [];
              dateApts.set(roomId, allApts.filter((a: any) => a.gymRoomId === roomId));
            }

            this.gymSlotsData.set(date, dateSlots);
            this.gymAppointmentsData.set(date, dateApts);
          }

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  getGymSlotsForDate(date: string): Map<string, any[]> {
    return this.gymSlotsData.get(date) || new Map();
  }

  getGymAppointmentsForDate(date: string): Map<string, any[]> {
    return this.gymAppointmentsData.get(date) || new Map();
  }

  // ==================== GYM INTERACTIONS ====================

  /**
   * Click singolo su uno slot palestra = PRENOTA.
   * Debounce per evitare lo scatto se l'utente sta facendo doppio click
   * (che invece apre il riquadro riassunto).
   */
  onGymSlotClick(event: GymSlotClickEvent): void {
    // Read-only (istruttore): singolo click → riepilogo slot in sola lettura;
    // doppio click → scheda appuntamenti istruttore sul giorno cliccato.
    // Nessuna prenotazione possibile.
    if (this.readOnly) {
      if (this.gymSlotClickTimer) {
        clearTimeout(this.gymSlotClickTimer);
        this.gymSlotClickTimer = null;
        const day = this.parseDateString(event.date);
        if (day) this.instructorWorkspaceState.setSelectedDate(day);
        this.router.navigateByUrl(this.appointmentsRoute);
        return;
      }
      this.gymSlotClickTimer = setTimeout(() => {
        this.gymSlotClickTimer = null;
        this.openGymSlotSummaryOverlay(event);
      }, CalendarV3Container.GYM_CLICK_DEBOUNCE_MS);
      return;
    }
    // Discriminazione singolo/doppio click sul SOLO stream `slotClick`, che la
    // griglia emette per QUALSIASI slot (anche pieno/non disponibile). Lo stream
    // `slotDblClick` invece e' filtrato dalla griglia (`!isAvailable`), quindi
    // non scatterebbe sugli slot pieni: per questo non lo usiamo.
    //   - secondo click entro la finestra di debounce  → doppio click = riepilogo
    //   - nessun secondo click                         → singolo click = prenota
    if (this.gymSlotClickTimer) {
      clearTimeout(this.gymSlotClickTimer);
      this.gymSlotClickTimer = null;
      this.openGymSlotSummaryOverlay(event);
      return;
    }
    this.gymSlotClickTimer = setTimeout(() => {
      this.gymSlotClickTimer = null;
      // Blocco inserimento sugli slot non prenotabili: palestra chiusa
      // (`isClosed`, sfondo grigio) o nessun operatore disponibile (slot
      // scoperto da eccezione "modifica orari": `operator` assente). La griglia
      // emette `slotClick` per QUALSIASI slot, quindi il filtro va qui.
      // Lo slot PIENO (operatore presente, capienza esaurita) resta cliccabile
      // come prima — l'eventuale overbooking lo gestisce il dialog.
      const info = event.slotInfo;
      if (!info || info.isClosed || !info.operator) {
        this.snackBar.open(
          info?.isClosed
            ? 'Palestra chiusa in questo orario: impossibile prenotare.'
            : 'Nessun operatore disponibile in questo slot: impossibile prenotare.',
          'OK',
          { duration: 3500 },
        );
        return;
      }
      this.openGymAppointmentDialog(event);
    }, CalendarV3Container.GYM_CLICK_DEBOUNCE_MS);
  }

  /** Parsa una data 'YYYY-MM-DD' a mezzanotte locale, o null se invalida. */
  private parseDateString(dateStr: string | undefined): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /**
   * No-op intenzionale: la discriminazione singolo/doppio click avviene in
   * `onGymSlotClick` sul solo stream `slotClick` (vedi commento li'). `slotDblClick`
   * non e' affidabile perche' la griglia non lo emette per gli slot pieni.
   */
  onGymSlotDblClick(_event: GymSlotClickEvent): void {
    /* vedi onGymSlotClick */
  }

  /**
   * Click sul mini-chip di un appuntamento dentro uno slot palestra.
   *
   * La griglia ferma la propagazione allo slot (che significherebbe "prenota"),
   * quindi qui l'intento e' inequivocabile: aprire QUELL'appuntamento in
   * modifica. Si condivide il timer di `onGymSlotClick` cosi' il doppio click
   * sul chip resta coerente col resto della palestra (= riepilogo dello slot).
   */
  onGymAppointmentClick(event: GymAppointmentClickEvent): void {
    const slotEvent: GymSlotClickEvent = {
      gymRoom: event.gymRoom,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      slotInfo: event.slotInfo,
      mouseEvent: event.mouseEvent,
    };

    // Sola lettura (istruttore): nessuna modifica possibile, si ricade sul
    // comportamento dello slot (singolo → riepilogo, doppio → scheda del giorno).
    if (this.readOnly) {
      this.onGymSlotClick(slotEvent);
      return;
    }

    // In modalita' selezione (flusso copia) il chip non apre nulla: la palestra
    // non partecipa al copia/incolla, che vive sulla griglia operatori.
    if (this.clipboard.isSelecting) return;

    if (this.gymSlotClickTimer) {
      clearTimeout(this.gymSlotClickTimer);
      this.gymSlotClickTimer = null;
      this.openGymSlotSummaryOverlay(slotEvent);
      return;
    }
    this.gymSlotClickTimer = setTimeout(() => {
      this.gymSlotClickTimer = null;
      this.openGymAppointmentDialog(slotEvent, event.appointment);
    }, CalendarV3Container.GYM_CLICK_DEBOUNCE_MS);
  }

  /**
   * Apre il dialog Material per creare (o, se `appointment` valorizzato,
   * modificare) un appuntamento palestra.
   */
  private openGymAppointmentDialog(event: GymSlotClickEvent, appointment?: GymAppointment): void {
    const dialogRef = this.dialog.open(GymAppointmentMatDialogComponent, {
      width: '600px',
      disableClose: false,
      data: {
        gymRoom: event.gymRoom,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        slotInfo: event.slotInfo,
        patients: this.patients,
        appointment,
      } as GymAppointmentMatDialogData,
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: GymAppointmentMatDialogResult | undefined) => {
      if (result?.created) {
        this.reloadCurrentView();
      }
    });
  }

  /**
   * Appuntamenti che insistono sullo slot cliccato (stessa room, overlap
   * orario), ricavati dai dati gia' caricati per la griglia.
   */
  private getAppointmentsForSlot(event: GymSlotClickEvent): GymAppointment[] {
    // Match sullo startTime dello slot, normalizzato a HH:MM: gli appuntamenti
    // arrivano dal backend come "HH:MM:SS" mentre lo slot e' "HH:MM", quindi un
    // confronto stretto fallirebbe. Il match sullo START (non sull'overlap)
    // evita di includere gli appuntamenti degli slot adiacenti.
    const hhmm = (t: string | undefined): string => (t ?? '').slice(0, 5);
    const slotStart = hhmm(event.startTime);
    const roomApts = (this.gymAppointmentsData.get(event.date)?.get(event.gymRoom.id) ?? []) as GymAppointment[];
    return roomApts.filter((a) => hhmm(a.startTime) === slotStart);
  }

  /**
   * Crea e mostra l'overlay CDK con il riquadro riassunto (Layer 1 dumb).
   */
  private openGymSlotSummaryOverlay(event: GymSlotClickEvent): void {
    this.closeGymSummary();
    this.gymSummaryEvent = event;

    const origin = { x: event.mouseEvent.clientX, y: event.mouseEvent.clientY };
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(origin)
      .withFlexibleDimensions(false)
      .withPush(true)
      .withPositions([
        { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX: 8 },
        { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top', offsetX: -8 },
        { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
        { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
      ]);

    const overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
    });
    this.gymSummaryOverlayRef = overlayRef;

    overlayRef.backdropClick().pipe(takeUntil(this.destroy$)).subscribe(() => this.closeGymSummary());
    overlayRef.keydownEvents().pipe(takeUntil(this.destroy$)).subscribe((e) => {
      if (e.key === 'Escape') this.closeGymSummary();
    });

    const ref = overlayRef.attach(new ComponentPortal(GymSlotSummaryV3Component));
    ref.instance.gymRoom = event.gymRoom;
    ref.instance.slotInfo = event.slotInfo;
    ref.instance.date = event.date;
    ref.instance.appointments = this.getAppointmentsForSlot(event);
    ref.instance.action
      .pipe(takeUntil(this.destroy$))
      .subscribe((action) => this.handleGymSummaryAction(action));
    ref.changeDetectorRef.detectChanges();
  }

  /** Gestisce le azioni emesse dal riquadro riassunto. */
  private handleGymSummaryAction(action: GymSlotSummaryV3Action): void {
    const event = this.gymSummaryEvent;
    // Sola lettura: nessuna azione mutante dal riepilogo, solo chiusura.
    if (this.readOnly && action.type !== 'close') {
      this.closeGymSummary();
      return;
    }
    switch (action.type) {
      case 'add':
        this.closeGymSummary();
        if (event) this.openGymAppointmentDialog(event);
        break;
      case 'edit':
        this.closeGymSummary();
        if (event && action.appointment) {
          this.openGymAppointmentDialog(event, action.appointment);
        }
        break;
      case 'delete':
        this.closeGymSummary();
        if (action.appointment) this.confirmDeleteGymAppointment(action.appointment);
        break;
      case 'close':
        this.closeGymSummary();
        break;
    }
  }

  /** Conferma + elimina una prenotazione palestra. */
  private confirmDeleteGymAppointment(appointment: GymAppointment): void {
    // Prenotazione ricorrente: la conferma passa dal dialog con scelta scope
    // (solo questa / questa e successive / intera serie / intervallo date).
    if (appointment.isRecurring && appointment.recurringGroupId) {
      const ref = this.dialog.open(RecurringDeleteDialogComponent, {
        width: '560px',
        data: {
          appointmentId: appointment.id,
          appointmentDate: String(appointment.appointmentDate).slice(0, 10),
          recurringGroupId: appointment.recurringGroupId,
          clientName: appointment.clientName,
        } as RecurringDeleteDialogData,
      });
      ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: RecurringDeleteDialogResult | undefined) => {
        if (result && result.deletedCount > 0) {
          this.reloadCurrentView();
        }
      });
      return;
    }

    const ref = this.dialog.open(ConfirmMatDialogComponent, {
      width: '400px',
      data: {
        title: 'Elimina prenotazione',
        message: `Confermi l'eliminazione della prenotazione di ${appointment.clientName || 'questo paziente'}?`,
        confirmText: 'Elimina',
        cancelText: 'Annulla',
        confirmColor: 'warn',
        icon: 'delete',
      } as ConfirmMatDialogData,
    });

    ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(async (confirmed) => {
      if (!confirmed) return;
      try {
        await firstValueFrom(this.gymRoomService.deleteAppointment(appointment.id));
        this.reloadCurrentView();
      } catch (err: any) {
        console.error('[CalendarV3] Error deleting gym appointment:', err);
        alert(err?.message || "Errore durante l'eliminazione della prenotazione");
      }
    });
  }

  /**
   * Conferma + elimina un appuntamento della vista operatori, richiesto dal
   * riquadro riassunto. Stessa scelta di scope della palestra sulle serie
   * ricorrenti.
   */
  private confirmDeleteAppointment(appointment: Appointment): void {
    if (appointment.isRecurring && appointment.recurringGroupId) {
      const ref = this.dialog.open(RecurringDeleteDialogComponent, {
        width: '560px',
        data: {
          appointmentId: String(appointment.id),
          appointmentDate: String(appointment.date).slice(0, 10),
          recurringGroupId: appointment.recurringGroupId,
          clientName: appointment.title,
        } as RecurringDeleteDialogData,
      });
      ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: RecurringDeleteDialogResult | undefined) => {
        if (result && result.deletedCount > 0) {
          this.reloadCurrentView();
        }
      });
      return;
    }

    const ref = this.dialog.open(ConfirmMatDialogComponent, {
      width: '400px',
      data: {
        title: 'Elimina appuntamento',
        message: `Confermi l'eliminazione dell'appuntamento di ${appointment.title || 'questo paziente'}?`,
        confirmText: 'Elimina',
        cancelText: 'Annulla',
        confirmColor: 'warn',
        icon: 'delete',
      } as ConfirmMatDialogData,
    });

    ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(async (confirmed) => {
      if (!confirmed) return;
      try {
        await firstValueFrom(this.appointmentService.deleteAppointment(String(appointment.id)));
        this.reloadCurrentView();
      } catch (err: any) {
        console.error('[CalendarV3] Error deleting appointment:', err);
        alert(err?.graphQLErrors?.[0]?.message || "Errore durante l'eliminazione dell'appuntamento");
      }
    });
  }

  /**
   * Condivisione del riepilogo appuntamento su WhatsApp o email. Apre il
   * client esterno con il testo precompilato: non passa dal gateway WhatsApp,
   * e' una scorciatoia per l'operatore.
   */
  private shareAppointment(appointment: Appointment, method?: 'email' | 'whatsapp'): void {
    // WhatsApp non è una condivisione di testo come l'email: manda al paziente
    // il recap vero, quello del sistema, che finisce nei log e negli stati di
    // consegna. Aprire wa.me con un testo precompilato lasciava l'invio a mano
    // dell'operatore e non lasciava traccia da nessuna parte.
    if (method === 'whatsapp') {
      this.sendAppointmentRecap(appointment);
      return;
    }

    const operatorId = String(appointment.operatorId);
    const user = this.allUsers.find((u) => String(u.operatorId ?? u.id) === operatorId);
    const dateLabel = new Date(appointment.date + 'T00:00:00').toLocaleDateString('it-IT', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const text =
      `Appuntamento: ${appointment.title}\n` +
      `Data: ${dateLabel}\n` +
      `Ora: ${appointment.startTime} - ${appointment.endTime}\n` +
      `Operatore: ${user?.name || 'N/A'}` +
      (appointment.notes ? `\nNote: ${appointment.notes}` : '');

    if (method === 'email') {
      const subject = `Appuntamento - ${appointment.title}`;
      window.location.href =
        `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    }
  }

  /**
   * Invia subito al paziente il recap dell'appuntamento.
   *
   * Il gateway lo manda senza passare dalla finestra di raggruppamento: chi
   * preme il pulsante si aspetta che parta ora, non fra qualche minuto.
   */
  private sendAppointmentRecap(appointment: Appointment): void {
    if (!appointment?.id) return;

    this.appointmentService.sendRecap(String(appointment.id)).subscribe({
      next: () =>
        this.snackBar.open('Recap WhatsApp inviato al paziente', 'OK', { duration: 3000 }),
      error: (err) =>
        this.snackBar.open(
          err?.message || 'Invio del recap non riuscito',
          'OK',
          { duration: 5000 },
        ),
    });
  }

  /** Chiude e distrugge l'overlay del riquadro riassunto. */
  private closeGymSummary(): void {
    if (this.gymSummaryOverlayRef) {
      this.gymSummaryOverlayRef.dispose();
      this.gymSummaryOverlayRef = null;
    }
    this.gymSummaryEvent = null;
  }

  // ==================== GRID INTERACTIONS ====================

  onCellDblClick(event: CellClickEvent): void {
    if (this.readOnly) return; // sola lettura: niente creazione su cella vuota
    const operator = this.stateService.operators.find(o => o.operatorId === event.operatorId);
    const isGymInstructor = operator?.macroCategory === 'gym_instructor';

    if (!isGymInstructor && this.operatorGridData) {
      const col = this.operatorGridData.columns.find(
        c => c.operatorId === event.operatorId && c.date === event.date
      );
      if (col) {
        const hasOverlap = col.events.some(e => {
          return e.originalStartTime < event.endTime && e.originalEndTime > event.startTime;
        });
        if (hasOverlap) {
          alert('Esiste già un appuntamento in questa fascia oraria per questo operatore.');
          return;
        }
      }
    }

    this.openEventDialog({
      defaultDate: event.date,
      defaultStartTime: event.startTime,
      defaultEndTime: event.endTime,
      defaultOperatorId: event.operatorId,
      users: this.allUsers,
      patients: this.patients,
    });
  }

  /**
   * Click sul chip di un appuntamento (vista operatori).
   *
   * Singolo e doppio click fanno cose diverse, ma il browser emette comunque
   * `click` prima di `dblclick`: la discriminazione avviene qui, sul solo
   * stream `click`, con la stessa finestra di debounce usata in palestra.
   *   - secondo click entro la finestra → azione "doppio click"
   *   - nessun secondo click            → azione "singolo click"
   * Quale sia l'una e quale l'altra lo decide l'impostazione
   * `calendar.appointmentClickAction`.
   */
  onEventClick(event: EventClickEvent): void {
    // In modalita' selezione (flusso copia avviato da toolbar) il click copia
    // l'appuntamento ed entra in fase incollo, invece di aprirne i dettagli:
    // nessuna ambiguita' da risolvere, quindi niente debounce.
    if (!this.readOnly && this.clipboard.isSelecting) {
      this.startPaste(event.appointment);
      return;
    }

    if (this.eventClickTimer) {
      clearTimeout(this.eventClickTimer);
      this.eventClickTimer = null;
      this.runEventAction(event, 'double');
      return;
    }
    this.eventClickTimer = setTimeout(() => {
      this.eventClickTimer = null;
      this.runEventAction(event, 'single');
    }, CalendarV3Container.GYM_CLICK_DEBOUNCE_MS);
  }

  /**
   * No-op intenzionale: la discriminazione avviene in `onEventClick` sul solo
   * stream `click` (vedi commento li'). Tenere anche `dblclick` collegato
   * farebbe scattare due volte l'azione di doppio click.
   */
  onEventDblClick(_event: EventClickEvent): void {
    /* vedi onEventClick */
  }

  /**
   * Esegue l'azione associata al gesto sul chip appuntamento.
   *
   * In sola lettura le due azioni sono fisse (dettaglio / scheda appuntamenti
   * del giorno) perche' l'operatore non puo' modificare nulla; in uso pieno
   * seguono l'impostazione `calendar.appointmentClickAction`.
   */
  private runEventAction(event: EventClickEvent, gesture: 'single' | 'double'): void {
    if (this.readOnly) {
      if (gesture === 'single') {
        this.openEventDialog({
          appointment: event.appointment,
          users: this.allUsers,
          patients: this.patients,
          readOnly: true,
        });
      } else {
        this.goToAppointmentsScheduleForDay(event.appointment);
      }
      return;
    }

    const wantsSummary =
      this.appointmentClickAction === 'summary-first' ? gesture === 'single' : gesture === 'double';

    if (wantsSummary) {
      this.openAppointmentSummaryOverlay(event);
      return;
    }
    this.openEventDialog({
      appointment: event.appointment,
      users: this.allUsers,
      patients: this.patients,
    });
  }

  /**
   * Riquadro riassunto dell'appuntamento, ancorato al punto cliccato.
   *
   * Backdrop trasparente invece del `clickOutside` del componente: il gesto che
   * apre l'overlay e' ancora in propagazione quando il portal viene creato, e
   * il listener `document:click` del riquadro lo richiuderebbe all'istante.
   */
  private openAppointmentSummaryOverlay(event: EventClickEvent): void {
    this.closeAppointmentSummary();

    const origin = { x: event.mouseEvent.clientX, y: event.mouseEvent.clientY };
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(origin)
      .withFlexibleDimensions(false)
      .withPush(true)
      .withPositions([
        { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX: 8 },
        { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top', offsetX: -8 },
        { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
        { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
      ]);

    const overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      panelClass: 'appointment-summary-overlay',
    });
    this.appointmentSummaryOverlayRef = overlayRef;

    overlayRef.backdropClick().pipe(takeUntil(this.destroy$))
      .subscribe(() => this.closeAppointmentSummary());
    overlayRef.keydownEvents().pipe(takeUntil(this.destroy$)).subscribe((e) => {
      if (e.key === 'Escape') this.closeAppointmentSummary();
    });

    const ref = overlayRef.attach(new ComponentPortal(AppointmentSummaryComponent));
    const operatorId = String(event.appointment.operatorId);
    ref.instance.appointment = event.appointment;
    ref.instance.user = this.allUsers.find(
      (u) => String(u.operatorId ?? u.id) === operatorId,
    );
    ref.instance.action
      .pipe(takeUntil(this.destroy$))
      .subscribe((action) => this.handleAppointmentSummaryAction(action));
    ref.changeDetectorRef.detectChanges();
  }

  /** Chiude il riquadro riassunto appuntamento, se aperto. */
  private closeAppointmentSummary(): void {
    if (this.appointmentSummaryOverlayRef) {
      this.appointmentSummaryOverlayRef.dispose();
      this.appointmentSummaryOverlayRef = null;
    }
  }

  /** Gestisce le azioni emesse dal riquadro riassunto appuntamento. */
  private handleAppointmentSummaryAction(action: SummaryAction): void {
    this.closeAppointmentSummary();
    switch (action.type) {
      case 'edit':
        this.openEventDialog({
          appointment: action.appointment,
          users: this.allUsers,
          patients: this.patients,
        });
        break;
      case 'delete':
        this.confirmDeleteAppointment(action.appointment);
        break;
      case 'chat':
        this.openWhatsappChat(action.appointment);
        break;
      case 'share':
        this.shareAppointment(action.appointment, action.shareMethod);
        break;
      case 'close':
        break;
    }
  }

  /**
   * Toglie una chat dal pannello "Chat in corso".
   *
   * Oltre a togliere il parcheggio la segna come letta: se restassero messaggi
   * non letti, il primo aggiornamento la rimetterebbe nel pannello e la X
   * sembrerebbe non funzionare. Un messaggio NUOVO la fa tornare, ed è giusto.
   */
  onRemoveChatFromPanel(conversation: { id: string; unreadCount?: number }): void {
    this.chatState.removeFromPanel(conversation);
  }

  /** Svuota le chat in corso, previa conferma: l'elenco non è recuperabile. */
  onClearChatPanel(): void {
    const count = this.chatState.panelConversations().length;
    if (count === 0) return;
    if (!confirm(`Vuoi togliere tutte le ${count} chat dall'elenco delle chat in corso?`)) return;
    this.chatState.clearPanel();
  }

  /** Apre la ricerca paziente e, scelto il paziente, ne apre la chat. */
  onNewChat(): void {
    this.dialog
      .open(NewChatDialogComponent, { autoFocus: false })
      .afterClosed()
      .subscribe((result: NewChatDialogResult | undefined) => {
        if (!result) return;
        this.chatState.openForPhone(result);
      });
  }

  /**
   * Apre il riquadro di chat WhatsApp col paziente dell'appuntamento. Il numero
   * arriva dall'appuntamento stesso (denormalizzato alla prenotazione), quindi
   * non serve caricare l'anagrafica.
   */
  private openWhatsappChat(appointment: Appointment): void {
    const phone = appointment.clientPhone || appointment.patient?.cellulare || appointment.patient?.telefono;
    if (!phone) {
      this.snackBar.open(
        'Nessun numero di telefono su questo appuntamento: impossibile aprire la chat.',
        'OK',
        { duration: 4000 },
      );
      return;
    }
    this.chatState.openForPhone({
      phone,
      patientId: appointment.patientId,
      patientName: appointment.title,
    });
  }

  /**
   * Read-only: porta l'utente alla propria scheda appuntamenti
   * (/operatori-new/appuntamenti o /istruttori/appuntamenti) posizionata sul
   * giorno dell'appuntamento. La data è propagata via lo state service del
   * workspace (singleton root), che il container di destinazione legge.
   */
  private goToAppointmentsScheduleForDay(appointment: Appointment): void {
    const day = this.parseAppointmentDay(appointment);
    if (day) {
      if (this.selfIsGymInstructor) {
        this.instructorWorkspaceState.setSelectedDate(day);
      } else {
        this.operatorWorkspaceState.setSelectedDate(day);
      }
    }
    this.router.navigateByUrl(this.appointmentsRoute);
  }

  /** Estrae la data (mezzanotte locale) da un appuntamento, se valorizzata. */
  private parseAppointmentDay(appointment: Appointment): Date | null {
    const raw = (appointment as any)?.date || (appointment as any)?.appointmentDate;
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  async onResizeEnd(event: { appointmentId: string; newEndTime: string }): Promise<void> {
    if (this.readOnly) { this.reloadCurrentView(); return; } // sola lettura: annulla il resize
    // Per il resize serve l'operatore/data/start: li recupero dall'evento in griglia.
    const posEvent = this.findPositionedEvent(event.appointmentId);
    if (posEvent) {
      const guard = await this.checkAvailabilityGuard(
        posEvent.operatorId, posEvent.date,
        posEvent.originalStartTime, event.newEndTime,
        // Escludi l'intervallo originale: l'appuntamento puo' espandersi
        // nello spazio che gia' occupava senza falso allarme.
        { startTime: posEvent.originalStartTime, endTime: posEvent.originalEndTime },
      );
      if (guard === 'cancel') {
        this.reloadCurrentView();
        return;
      }
      const force = guard === 'force';
      this.appointmentService.updateAppointment(event.appointmentId, {
        endTime: event.newEndTime,
        forceOutsideAvailability: force,
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => this.reloadCurrentView(),
        error: (err: any) => this.handleAppointmentError(err, 'ridimensionamento'),
      });
      return;
    }

    this.appointmentService.updateAppointment(event.appointmentId, {
      endTime: event.newEndTime,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.reloadCurrentView(),
      error: (err: any) => this.handleAppointmentError(err, 'ridimensionamento'),
    });
  }

  async onDragMove(event: DragMoveEvent): Promise<void> {
    if (this.readOnly) { this.reloadCurrentView(); return; } // sola lettura: annulla lo spostamento
    // Escludi l'intervallo originale dell'appuntamento dal calcolo
    // disponibilita': sta solo cambiando posizione, lo spazio che lasciava
    // libero non deve generare un falso positivo. Vale solo se resta sullo
    // stesso operatore e giorno: se cambia colonna lo spazio liberato e'
    // altrove e non va escluso nella colonna di destinazione.
    const posEvent = this.findPositionedEvent(event.appointmentId);
    const excludeRange =
      posEvent &&
      posEvent.date === event.newDate &&
      posEvent.operatorId === event.operatorId
        ? { startTime: posEvent.originalStartTime, endTime: posEvent.originalEndTime }
        : undefined;

    const guard = await this.checkAvailabilityGuard(
      event.operatorId, event.newDate, event.newStartTime, event.newEndTime,
      excludeRange,
    );
    if (guard === 'cancel') {
      this.reloadCurrentView();
      return;
    }

    this.appointmentService.updateAppointment(event.appointmentId, {
      appointmentDate: event.newDate,
      startTime: event.newStartTime,
      endTime: event.newEndTime,
      forceOutsideAvailability: guard === 'force',
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.reloadCurrentView(),
      error: (err: any) => this.handleAppointmentError(err, 'spostamento'),
    });
  }

  /** Cerca un PositionedEvent nella griglia corrente per appointmentId. */
  private findPositionedEvent(appointmentId: string) {
    for (const col of this.operatorGridData?.columns ?? []) {
      const found = col.events.find(e => String(e.appointment.id) === String(appointmentId));
      if (found) return found;
    }
    return null;
  }

  /**
   * Gestione errori comune per drag/resize. Riconosce l'errore backend
   * "fuori disponibilita'" e mostra un messaggio dedicato.
   */
  private handleAppointmentError(err: any, azione: string): void {
    const msg: string =
      err?.graphQLErrors?.[0]?.message || err?.message || '';
    if (msg.includes('APPOINTMENT_OUTSIDE_AVAILABILITY')) {
      alert('L\'orario selezionato è fuori dalla disponibilità dell\'operatore.');
    } else {
      console.error(`[CalendarV3] Error ${azione} appointment:`, err);
      alert(`Errore nello ${azione} dell'appuntamento`);
    }
    this.reloadCurrentView();
  }

  // ==================== DIALOG APERTURA ====================

  private openEventDialog(data: EventMatDialogData): void {
    const dialogData = { ...data, instrumentCategories: this.instrumentCategories };
    const dialogRef = this.dialog.open(EventMatDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      disableClose: false,
      data: dialogData,
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(async (result: EventMatDialogResult | undefined) => {
      if (!result || result.action === 'cancel') return;

      // "Copia appuntamento" dal dialog: chiude il dialog e avvia il flusso
      // incollo con l'appuntamento mostrato.
      if (result.action === 'copy' && result.appointment) {
        this.startPaste(result.appointment);
        return;
      }

      if (result.action === 'save' && result.appointment) {
        await this.saveAppointment(result);
      } else if (result.action === 'delete' && result.appointment) {
        try {
          await firstValueFrom(this.appointmentService.deleteAppointment(String(result.appointment.id)));
        } catch (err: any) {
          alert(err?.graphQLErrors?.[0]?.message || 'Errore nell\'eliminazione');
        }
      } else if (result.action === 'mark-attended' && result.appointmentId) {
        await this.handleStatusAction(
          () => this.appointmentService.markAsAttended(result.appointmentId!),
          'segnare come presentato',
        );
      } else if (result.action === 'mark-no-show' && result.appointmentId) {
        await this.handleStatusAction(
          () => this.appointmentService.markAsNoShow(result.appointmentId!),
          'segnare come non presentato',
        );
      } else if (result.action === 'revert-attended' && result.appointmentId) {
        await this.handleStatusAction(
          () => this.appointmentService.revertAttended(result.appointmentId!),
          'annullare lo stato presentato',
        );
      } else if (result.action === 'cancel-with-notice' && result.appointmentId) {
        await this.handleStatusAction(
          () => this.appointmentService.cancelWithNotice(result.appointmentId!, 'Annullato da segreteria', 'secretary'),
          'disdire l\'appuntamento',
        );
      }
      this.reloadCurrentView();
    });
  }

  private async handleStatusAction(
    op: () => import('rxjs').Observable<unknown>,
    azione: string,
  ): Promise<void> {
    try {
      await firstValueFrom(op());
    } catch (err: any) {
      alert(err?.graphQLErrors?.[0]?.message || `Errore nel ${azione}`);
    }
  }

  private async saveAppointment(result: EventMatDialogResult): Promise<void> {
    const apt = result.appointment!;
    const servicesWithOrder = result.services?.map((s, idx) => ({ ...s, orderPosition: idx }));

    try {
      const isUpdate = apt.id && typeof apt.id === 'string' && apt.id.length > 10;

      // Guard disponibilita': salta per nonRetribuito (pause & co. sono
      // legittimamente fuori orario). Per gli altri, se fuori disponibilita'
      // e flag attivo, chiede conferma di forzatura.
      let force = false;
      if (!result.nonRetribuito) {
        // In update: escludi l'intervallo originale dell'appuntamento dal
        // calcolo, cosi' modificarne l'orario non genera un falso positivo
        // per lo spazio che gia' occupava.
        let excludeRange: { startTime: string; endTime: string } | undefined;
        if (isUpdate) {
          const posEvent = this.findPositionedEvent(apt.id as string);
          if (posEvent && posEvent.date === apt.date) {
            excludeRange = {
              startTime: posEvent.originalStartTime,
              endTime: posEvent.originalEndTime,
            };
          }
        }
        const guard = await this.checkAvailabilityGuard(
          apt.operatorId, apt.date, apt.startTime, apt.endTime, excludeRange,
        );
        if (guard === 'cancel') return;
        force = guard === 'force';
      }

      if (isUpdate) {
        await firstValueFrom(this.appointmentService.updateAppointment(
          apt.id as string,
          {
            services: servicesWithOrder,
            clientName: apt.title,
            patientId: apt.patientId,
            appointmentDate: apt.date,
            startTime: apt.startTime,
            endTime: apt.endTime,
            notes: apt.notes,
            instrumentOrderMatters: result.instrumentOrderMatters,
            instruments: result.instruments,
            nonRetribuito: result.nonRetribuito,
            forceOutsideAvailability: force,
          },
        ));

        // "Rendi ricorrente" su un appuntamento singolo esistente: dopo
        // l'update diventa il master e il backend crea le occorrenze
        // successive. Un conflitto su una nuova occorrenza blocca tutto e
        // finisce nel dialog dei conflitti serie (catch sotto).
        if (result.repeatConfig) {
          await firstValueFrom(this.appointmentService.makeRecurring(
            apt.id as string,
            result.repeatConfig,
            force,
          ));
        }
      } else {
        await firstValueFrom(this.appointmentService.createAppointment({
          operatorId: apt.operatorId,
          services: servicesWithOrder,
          clientName: apt.title,
          patientId: apt.patientId,
          appointmentDate: apt.date,
          startTime: apt.startTime,
          endTime: apt.endTime,
          notes: apt.notes,
          instrumentOrderMatters: result.instrumentOrderMatters,
          instruments: result.instruments,
          repeatConfig: result.repeatConfig,
          nonRetribuito: result.nonRetribuito,
          forceOutsideAvailability: force,
        }));
      }
    } catch (error: any) {
      let msg = 'Errore durante il salvataggio';
      if (error?.graphQLErrors?.[0]?.message) {
        msg = error.graphQLErrors[0].message;
      } else if (error?.message?.includes('CombinedGraphQLErrors:')) {
        msg = error.message.replace('CombinedGraphQLErrors: ', '');
      } else if (error?.message) {
        msg = error.message;
      }

      // Conflitti su creazione serie ricorrente: il backend blocca e include
      // il JSON dei conflitti nel messaggio. Mostriamo il riepilogo dedicato.
      const conflicts = this.tryParseRecurringConflicts(msg);
      if (conflicts) {
        this.dialog.open(RecurringConflictsDialogComponent, {
          width: '520px', maxWidth: '95vw',
          data: { title: 'Creazione serie bloccata', conflicts },
        });
        return;
      }

      console.error('[CalendarV3] Save error:', error);
      alert(msg);
    }
  }

  /**
   * Estrae l'elenco conflitti dal messaggio d'errore backend
   * `RECURRING_SERIES_CONFLICT: [...]`. Ritorna null se non è quel tipo.
   */
  private tryParseRecurringConflicts(msg: string): any[] | null {
    const marker = 'RECURRING_SERIES_CONFLICT';
    const idx = msg.indexOf(marker);
    if (idx < 0) return null;
    const jsonStart = msg.indexOf('[', idx);
    if (jsonStart < 0) return null;
    try {
      const parsed = JSON.parse(msg.slice(jsonStart));
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private reloadCurrentView(): void {
    this.loadData(this.config, this.visibleDates, this.stateService.selectedOperators);
  }

  // ==================== CURRENT TIME INDICATOR ====================

  private startCurrentTimeUpdates(): void {
    this.updateCurrentTimeTop();
    this.currentTimeInterval = setInterval(() => {
      this.updateCurrentTimeTop();
      this.cdr.markForCheck();
    }, 60000);
  }

  private updateCurrentTimeTop(): void {
    if (!this.operatorGridData?.timeSlots?.length) {
      this.currentTimeTop = -1;
      return;
    }

    const today = this.stateService.formatDate(new Date());
    if (!this.visibleDates.includes(today)) {
      this.currentTimeTop = -1;
      return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const firstSlotMinutes = this.timeToMinutes(this.operatorGridData.timeSlots[0].time);
    const lastSlot = this.operatorGridData.timeSlots[this.operatorGridData.timeSlots.length - 1];
    const slotDuration = this.operatorGridData.timeSlots.length > 1
      ? this.timeToMinutes(this.operatorGridData.timeSlots[1].time) - firstSlotMinutes
      : 45;
    const lastSlotEndMinutes = this.timeToMinutes(lastSlot.time) + slotDuration;

    if (currentMinutes < firstSlotMinutes || currentMinutes > lastSlotEndMinutes) {
      this.currentTimeTop = -1;
      return;
    }

    const pxPerMinute = this.operatorGridData.slotHeightPx / slotDuration;
    // La linea ora vive dentro .grid-body (scrolla col contenuto), stesso
    // sistema di coordinate degli event-chip: nessun offset header.
    this.currentTimeTop = (currentMinutes - firstSlotMinutes) * pxPerMinute;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
}

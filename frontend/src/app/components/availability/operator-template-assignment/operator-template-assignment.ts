import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperatorService } from '../../../services/operator.service';
import { TemplateService } from '../../../services/template.service';
import { RoomService, Room, Chair } from '../../../services/room.service';
import {
  AssignmentRoomEditorComponent,
  EditorResult,
} from './assignment-room-editor.component';
import { Operator, OperatorMacroCategory } from '../../../graphql/generated/types';
import {
  TemplateAssignment,
  PatternGroup,
  getMacroCategoryLabel,
  AssignmentRoomOverrideInput,
  AssignTemplateToOperatorInput,
  RoomAvailabilityInfo,
  RoomBandBusyInfo,
  DAY_NAMES,
} from '../../../graphql/types';
import { catchError, finalize, forkJoin, Observable, of, Subject, switchMap, takeUntil } from 'rxjs';

/** Riga di override in modifica nel modal. */
interface OverrideDraft {
  dayInPattern: number;
  startTime: string; // '' = tutto il giorno
  endTime: string;
  roomId: string;
  chairId: string;
}

/** Opzione di una tendina studi/poltrone: disabilitata con motivo se non disponibile. */
interface RoomSelectOption {
  id: string;
  name: string;
  disabled: boolean;
  suffix: string;
}

type RowState = 'expired' | 'active' | 'future';

interface AssignmentRow {
  assignment: TemplateAssignment;
  patternGroupName: string;
  validFrom: string; // YYYY-MM-DD
  validUntil: string | null; // null = senza scadenza
  state: RowState;
  daysUntilExpiration: number | null;
}

interface OperatorWithAssignments {
  operator: Operator;
  rows: AssignmentRow[]; // timeline ordinata per validFrom crescente
  activeRow: AssignmentRow | null;
  status: 'active' | 'expiring' | 'future' | 'none';
}

@Component({
  selector: 'app-operator-template-assignment',
  imports: [CommonModule, FormsModule, AssignmentRoomEditorComponent],
  templateUrl: './operator-template-assignment.html',
  styleUrl: './operator-template-assignment.scss',
})
export class OperatorTemplateAssignment implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  operators: OperatorWithAssignments[] = [];
  filteredOperators: OperatorWithAssignments[] = [];
  patternGroups: PatternGroup[] = [];

  /**
   * Solo i gruppi assegnabili: attivi e con almeno una fascia oraria.
   * Un gruppo vuoto assegnato azzererebbe la disponibilità dell'operatore
   * (il backend lo rifiuta comunque); qui evitiamo proprio di offrirlo.
   */
  get assignablePatternGroups(): PatternGroup[] {
    return this.patternGroups.filter(
      (pg) => pg.isActive && (pg.patterns?.length || 0) > 0
    );
  }

  get hiddenPatternGroupsCount(): number {
    return this.patternGroups.length - this.assignablePatternGroups.length;
  }

  loading = false;
  error: string | null = null;

  searchTerm = '';

  // Modal (creazione nuova assegnazione o modifica di una esistente)
  showAssignModal = false;
  modalMode: 'create' | 'edit' = 'create';
  modalError: string | null = null;
  currentOperator: OperatorWithAssignments | null = null;
  editingRow: AssignmentRow | null = null;
  selectedPatternGroupId: string = '';
  assignPatternStartDate: string = '';
  assignValidFrom: string = '';
  assignValidUntil: string = '';
  truncatePrevious = true;

  // Studio/poltrona di default + override per giorno/fascia
  rooms: Room[] = [];
  selectedRoomId: string = '';
  selectedChairId: string = '';
  showOverrides = false;
  overridesDraft: OverrideDraft[] = [];

  // Pre-check conflitti studi/poltrone
  conflictWarnings: string[] = [];
  warningsAcknowledged = false;
  checkingConflicts = false;

  // Disponibilità studi/poltrone rispetto al template candidato
  roomAvailability: RoomAvailabilityInfo[] = [];
  availabilityLoading = false;
  private availabilityKey = '';

  // Editor grafico abbinamento studi
  showRoomEditor = false;

  // Overlay click tracking (per evitare chiusura durante click-and-drag)
  overlayMouseDownTarget: EventTarget | null = null;

  constructor(
    private operatorService: OperatorService,
    private templateService: TemplateService,
    private roomService: RoomService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData() {
    this.loading = true;
    this.error = null;

    forkJoin({
      operators: this.operatorService.getOperators(),
      patternGroups: this.templateService.getAllPatternGroups(),
      // onlyCurrent=true = tutte le assegnazioni non revocate: passate,
      // attive e future. La timeline le mostra tutte.
      assignments: this.templateService.getTemplateAssignments(undefined, true),
      rooms: this.roomService.getRooms(true),
    })
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          console.error('Errore nel caricamento dei dati:', err);
          this.error = 'Errore nel caricamento dei dati: ' + err.message;
          return of({ operators: [], patternGroups: [], assignments: [], rooms: [] });
        }),
        finalize(() => (this.loading = false))
      )
      .subscribe((data) => {
        this.patternGroups = data.patternGroups;
        this.rooms = data.rooms;
        this.buildOperatorList(data.operators, data.assignments);
        this.applyFilters();
      });
  }

  // ==================== Studio/poltrona helpers ====================

  /** Poltrone attive dello studio selezionato come default. */
  get availableChairs(): Chair[] {
    return this.chairsOfRoom(this.selectedRoomId);
  }

  chairsOfRoom(roomId: string): Chair[] {
    if (!roomId) return [];
    const room = this.rooms.find((r) => r.id === roomId);
    return (room?.chairs || []).filter((c) => c.isActive);
  }

  onRoomChange() {
    // La poltrona segue lo studio: se cambia studio, resetta la scelta
    if (
      this.selectedChairId &&
      !this.availableChairs.some((c) => c.id === this.selectedChairId)
    ) {
      this.selectedChairId = '';
    }
    this.invalidateConflictCheck();
  }

  onOverrideRoomChange(draft: OverrideDraft) {
    if (
      draft.chairId &&
      !this.chairsOfRoom(draft.roomId).some((c) => c.id === draft.chairId)
    ) {
      draft.chairId = '';
    }
    this.invalidateConflictCheck();
  }

  /** Giorni selezionabili per gli override, in base al template scelto. */
  get overrideDayOptions(): { value: number; label: string }[] {
    const pg =
      this.modalMode === 'edit'
        ? this.editingRow?.assignment.patternGroup
        : this.patternGroups.find((p) => p.id === this.selectedPatternGroupId);
    const duration = pg?.patternDuration || 7;
    const options: { value: number; label: string }[] = [];
    for (let i = 0; i < duration; i++) {
      const label =
        duration === 7
          ? DAY_NAMES[i]
          : `Sett. ${Math.floor(i / 7) + 1} - ${DAY_NAMES[i % 7]}`;
      options.push({ value: i, label });
    }
    return options;
  }

  addOverrideDraft() {
    this.overridesDraft.push({
      dayInPattern: 0,
      startTime: '',
      endTime: '',
      roomId: this.selectedRoomId || '',
      chairId: '',
    });
    this.showOverrides = true;
    this.invalidateConflictCheck();
  }

  removeOverrideDraft(index: number) {
    this.overridesDraft.splice(index, 1);
    this.invalidateConflictCheck();
  }

  /** Ogni modifica al form invalida l'esito del pre-check conflitti. */
  invalidateConflictCheck() {
    this.conflictWarnings = [];
    this.warningsAcknowledged = false;
  }

  /** Cambio di template o date: pre-check invalidato e disponibilità ricaricata. */
  onAssignFieldChange() {
    this.invalidateConflictCheck();
    this.fetchRoomAvailability();
  }

  // ==================== Disponibilità studi (tendine filtrate) ====================

  /**
   * Carica la disponibilità di studi/poltrone per il template candidato.
   * Richiede template, data inizio pattern e validFrom già scelti.
   */
  fetchRoomAvailability() {
    if (!this.currentOperator) return;
    const patternGroupId =
      this.modalMode === 'edit'
        ? this.editingRow!.assignment.patternGroupId
        : this.selectedPatternGroupId;

    if (!patternGroupId || !this.assignValidFrom || !this.assignPatternStartDate) {
      this.roomAvailability = [];
      this.availabilityKey = '';
      return;
    }

    const key = [
      patternGroupId,
      this.assignPatternStartDate,
      this.assignValidFrom,
      this.assignValidUntil,
    ].join('|');
    if (key === this.availabilityKey) return;
    this.availabilityKey = key;

    this.availabilityLoading = true;
    this.templateService
      .getAssignmentRoomAvailability(
        {
          operatorId: this.currentOperator.operator.id,
          patternGroupId,
          patternStartDate: this.assignPatternStartDate,
          validFrom: this.assignValidFrom,
          validUntil: this.assignValidUntil || undefined,
        },
        this.modalMode === 'edit' ? this.editingRow!.assignment.id : undefined
      )
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          console.error('Errore disponibilità studi:', err);
          return of([] as RoomAvailabilityInfo[]);
        }),
        finalize(() => (this.availabilityLoading = false))
      )
      .subscribe((rooms) => {
        this.ngZone.run(() => {
          this.roomAvailability = rooms;
        });
      });
  }

  /** Fasce occupate di uno studio che toccano il giorno/finestra di un override. */
  private busyEntriesForWindow(
    info: RoomAvailabilityInfo,
    ov: OverrideDraft
  ): RoomBandBusyInfo[] {
    return info.busy.filter((b) => {
      if (b.dayInPattern !== Number(ov.dayInPattern)) return false;
      if (!ov.startTime || !ov.endTime) return true; // tutto il giorno
      return b.startTime < ov.endTime && b.endTime > ov.startTime;
    });
  }

  /** Tendina studio di default: pieni disabilitati con motivo, condivisi con ⚠. */
  get defaultRoomOptions(): RoomSelectOption[] {
    if (this.roomAvailability.length > 0) {
      return this.roomAvailability.map((r) => ({
        id: r.roomId,
        name: r.roomName,
        disabled: r.full,
        suffix: r.full
          ? ` — ${r.unavailableReason}`
          : r.sharing
            ? ` ⚠ ${r.unavailableReason}`
            : '',
      }));
    }
    return this.rooms.map((r) => ({ id: r.id, name: r.name, disabled: false, suffix: '' }));
  }

  /** Tendina poltrona di default: occupate disabilitate con motivo. */
  get defaultChairOptions(): RoomSelectOption[] {
    const info = this.roomAvailability.find((r) => r.roomId === this.selectedRoomId);
    if (info) {
      return info.chairs.map((c) => ({
        id: c.chairId,
        name: c.name,
        disabled: !c.fullyFree,
        suffix: c.fullyFree ? '' : ` — ${c.firstConflict}`,
      }));
    }
    return this.chairsOfRoom(this.selectedRoomId).map((c) => ({
      id: c.id,
      name: c.name,
      disabled: false,
      suffix: '',
    }));
  }

  /** Tendina studio di una riga override, filtrata su giorno/fascia della riga. */
  overrideRoomOptions(ov: OverrideDraft): RoomSelectOption[] {
    if (this.roomAvailability.length > 0) {
      return this.roomAvailability.map((info) => {
        const entries = this.busyEntriesForWindow(info, ov);
        const fullEntry = entries.find((b) => b.freeSeats <= 0);
        const sharing = !fullEntry && entries.length > 0;
        return {
          id: info.roomId,
          name: info.roomName,
          disabled: !!fullEntry,
          suffix: fullEntry
            ? ` — pieno ${fullEntry.startTime}-${fullEntry.endTime} (${fullEntry.occupantNames.join(', ')})`
            : sharing
              ? ' ⚠ condiviso'
              : '',
        };
      });
    }
    return this.rooms.map((r) => ({ id: r.id, name: r.name, disabled: false, suffix: '' }));
  }

  /** Tendina poltrona di una riga override, filtrata su giorno/fascia della riga. */
  overrideChairOptions(ov: OverrideDraft): RoomSelectOption[] {
    const info = this.roomAvailability.find((r) => r.roomId === ov.roomId);
    if (info) {
      const entries = this.busyEntriesForWindow(info, ov);
      const busyChairs = new Set(entries.flatMap((b) => b.busyChairIds));
      return info.chairs.map((c) => ({
        id: c.chairId,
        name: c.name,
        disabled: busyChairs.has(c.chairId),
        suffix: busyChairs.has(c.chairId) ? ' — occupata in quella fascia' : '',
      }));
    }
    return this.chairsOfRoom(ov.roomId).map((c) => ({
      id: c.id,
      name: c.name,
      disabled: false,
      suffix: '',
    }));
  }

  private toDateOnly(value: Date | string): string {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }
    return new Date(value).toISOString().split('T')[0];
  }

  private getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private buildOperatorList(
    operators: Operator[],
    assignments: TemplateAssignment[]
  ) {
    const today = this.getTodayString();

    this.operators = operators.map((operator) => {
      const rows: AssignmentRow[] = assignments
        .filter((a) => a.operatorId === operator.id && a.isCurrent)
        .map((a) => {
          const validFrom = this.toDateOnly(a.validFrom);
          const validUntil = a.validUntil ? this.toDateOnly(a.validUntil) : null;

          let state: RowState;
          if (validUntil && validUntil < today) {
            state = 'expired';
          } else if (validFrom > today) {
            state = 'future';
          } else {
            state = 'active';
          }

          let daysUntilExpiration: number | null = null;
          if (state === 'active' && validUntil) {
            const diff =
              new Date(validUntil).getTime() - new Date(today).getTime();
            daysUntilExpiration = Math.round(diff / (1000 * 60 * 60 * 24));
          }

          return {
            assignment: a,
            patternGroupName: a.patternGroup?.name || 'Template',
            validFrom,
            validUntil,
            state,
            daysUntilExpiration,
          };
        })
        .sort((x, y) => x.validFrom.localeCompare(y.validFrom));

      const activeRow = rows.find((r) => r.state === 'active') || null;
      const futureRows = rows.filter((r) => r.state === 'future');

      let status: OperatorWithAssignments['status'] = 'none';
      if (activeRow) {
        status = 'active';
        if (
          activeRow.daysUntilExpiration !== null &&
          activeRow.daysUntilExpiration <= 15
        ) {
          // In scadenza solo se non c'è già una futura che riparte subito dopo
          const coveredByNext = futureRows.some(
            (f) =>
              f.validFrom <=
              this.addDays(activeRow.validUntil!, 1)
          );
          status = coveredByNext ? 'active' : 'expiring';
        }
      } else if (futureRows.length > 0) {
        status = 'future';
      }

      return { operator, rows, activeRow, status };
    });

    // Ordina: in scadenza, poi senza template, poi attivi, poi solo-futuri
    const statusOrder = { expiring: 0, none: 1, active: 2, future: 3 };
    this.operators.sort(
      (a, b) => statusOrder[a.status] - statusOrder[b.status]
    );
  }

  private addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  applyFilters() {
    if (!this.searchTerm.trim()) {
      this.filteredOperators = [...this.operators];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredOperators = this.operators.filter((op) =>
        `${op.operator.name} ${op.operator.surname || ''}`
          .toLowerCase()
          .includes(term)
      );
    }
  }

  onSearchChange() {
    this.applyFilters();
  }

  // ==================== Modal ====================

  openCreateModal(item: OperatorWithAssignments) {
    this.ngZone.run(() => {
      this.modalMode = 'create';
      this.modalError = null;
      this.currentOperator = item;
      this.editingRow = null;
      this.selectedPatternGroupId = '';
      // Default: si parte da dove finisce l'ultima assegnazione della timeline
      const lastRow = item.rows[item.rows.length - 1];
      const defaultFrom =
        lastRow && lastRow.validUntil
          ? this.addDays(lastRow.validUntil, 1)
          : this.getTodayString();
      this.assignValidFrom = defaultFrom;
      this.assignPatternStartDate = defaultFrom;
      this.assignValidUntil = '';
      this.truncatePrevious = true;
      // Studio/poltrona: precompila con l'ultima assegnazione della timeline
      this.selectedRoomId = lastRow?.assignment.roomId || '';
      this.selectedChairId = lastRow?.assignment.chairId || '';
      this.overridesDraft = [];
      this.showOverrides = false;
      this.invalidateConflictCheck();
      this.roomAvailability = [];
      this.availabilityKey = '';
      this.fetchRoomAvailability();
      this.showAssignModal = true;
    });
  }

  openEditModal(item: OperatorWithAssignments, row: AssignmentRow) {
    this.ngZone.run(() => {
      this.modalMode = 'edit';
      this.modalError = null;
      this.currentOperator = item;
      this.editingRow = row;
      this.selectedPatternGroupId = row.assignment.patternGroupId;
      this.assignPatternStartDate = this.toDateOnly(
        row.assignment.patternStartDate
      );
      this.assignValidFrom = row.validFrom;
      this.assignValidUntil = row.validUntil || '';
      this.selectedRoomId = row.assignment.roomId || '';
      this.selectedChairId = row.assignment.chairId || '';
      this.overridesDraft = (row.assignment.roomOverrides || []).map((o) => ({
        dayInPattern: o.dayInPattern,
        startTime: o.startTime ? String(o.startTime).slice(0, 5) : '',
        endTime: o.endTime ? String(o.endTime).slice(0, 5) : '',
        roomId: o.roomId,
        chairId: o.chairId || '',
      }));
      this.showOverrides = this.overridesDraft.length > 0;
      this.invalidateConflictCheck();
      this.roomAvailability = [];
      this.availabilityKey = '';
      this.fetchRoomAvailability();
      this.showAssignModal = true;
    });
  }

  /**
   * Assegnazione già in corso (iniziata prima del nuovo validFrom) che si
   * sovrappone al nuovo periodo: è quella che l'opzione "chiudi la precedente"
   * chiuderebbe al giorno prima.
   */
  get truncatableRow(): AssignmentRow | null {
    if (this.modalMode !== 'create' || !this.currentOperator || !this.assignValidFrom) {
      return null;
    }
    return (
      this.currentOperator.rows.find(
        (r) =>
          r.validFrom < this.assignValidFrom &&
          (!r.validUntil || r.validUntil >= this.assignValidFrom) &&
          (!this.assignValidUntil || r.validFrom <= this.assignValidUntil)
      ) || null
    );
  }

  get truncateUntilLabel(): string {
    if (!this.assignValidFrom) return '';
    return this.formatDate(this.addDays(this.assignValidFrom, -1));
  }

  /** Input di assegnazione costruito dal form (usato per salvataggio e pre-check). */
  private buildAssignInput(): AssignTemplateToOperatorInput {
    const overrides: AssignmentRoomOverrideInput[] = this.overridesDraft
      .filter((o) => o.roomId)
      .map((o) => ({
        dayInPattern: Number(o.dayInPattern),
        startTime: o.startTime || undefined,
        endTime: o.endTime || undefined,
        roomId: o.roomId,
        chairId: o.chairId || undefined,
      }));

    return {
      operatorId: this.currentOperator!.operator.id,
      patternGroupId: this.selectedPatternGroupId,
      patternStartDate: this.assignPatternStartDate,
      validFrom: this.assignValidFrom,
      validUntil: this.assignValidUntil || undefined,
      truncatePrevious: this.modalMode === 'create' ? this.truncatePrevious : undefined,
      roomId: this.selectedRoomId || undefined,
      chairId: this.selectedChairId || undefined,
      overrides: overrides.length > 0 ? overrides : undefined,
    };
  }

  private validateModalForm(): boolean {
    if (this.modalMode === 'create' && !this.selectedPatternGroupId) {
      this.modalError = 'Seleziona un template';
      return false;
    }
    if (!this.assignValidFrom) {
      this.modalError = 'Inserisci la data di inizio validità';
      return false;
    }
    if (!this.assignPatternStartDate) {
      this.modalError = 'Inserisci la data di inizio del pattern';
      return false;
    }
    if (this.assignValidUntil && this.assignValidUntil < this.assignValidFrom) {
      this.modalError =
        'La data di fine validità non può precedere quella di inizio';
      return false;
    }
    for (const o of this.overridesDraft) {
      if (!o.roomId) {
        this.modalError = 'Ogni override deve indicare uno studio';
        return false;
      }
      if ((o.startTime && !o.endTime) || (!o.startTime && o.endTime)) {
        this.modalError =
          'Gli override con fascia oraria devono avere inizio e fine';
        return false;
      }
      if (o.startTime && o.endTime && o.endTime <= o.startTime) {
        this.modalError =
          "Negli override l'ora di fine deve essere successiva all'inizio";
        return false;
      }
    }
    return true;
  }

  onAssignSave() {
    if (!this.currentOperator) return;
    if (!this.validateModalForm()) return;

    this.modalError = null;
    const input = this.buildAssignInput();
    const usesRooms = !!input.roomId || (input.overrides?.length || 0) > 0;

    // Pre-check conflitti studi/poltrone: i blocking fermano qui con il
    // dettaglio; i warning (condivisione entro capacità) richiedono una
    // conferma esplicita ("Salva comunque").
    if (usesRooms && !this.warningsAcknowledged) {
      this.checkingConflicts = true;
      this.templateService
        .checkAssignmentRoomConflicts(
          input,
          this.modalMode === 'edit' ? this.editingRow!.assignment.id : undefined
        )
        .pipe(
          takeUntil(this.destroy$),
          catchError((err) => {
            this.modalError = this.extractErrorMessage(err);
            return of(null);
          }),
          finalize(() => (this.checkingConflicts = false))
        )
        .subscribe((result) => {
          this.ngZone.run(() => {
            if (!result) return;
            if (result.blocking.length > 0) {
              this.modalError =
                'Conflitti bloccanti:\n- ' + result.blocking.join('\n- ');
              return;
            }
            if (result.warnings.length > 0) {
              this.conflictWarnings = result.warnings;
              this.warningsAcknowledged = true; // il prossimo click salva
              return;
            }
            this.doSave(input);
          });
        });
      return;
    }

    this.doSave(input);
  }

  private doSave(input: AssignTemplateToOperatorInput) {
    this.loading = true;
    this.modalError = null;

    const obs$ =
      this.modalMode === 'create'
        ? this.templateService.assignTemplateToOperator(input)
        : this.templateService
            .updateTemplateAssignment(this.editingRow!.assignment.id, {
              validFrom: this.assignValidFrom,
              // Stringa vuota = rimozione della scadenza
              validUntil: this.assignValidUntil,
              patternStartDate: this.assignPatternStartDate,
              // Stringa vuota = rimozione di studio/poltrona
              roomId: this.selectedRoomId,
              chairId: this.selectedChairId,
            })
            .pipe(
              switchMap(() =>
                this.templateService.setAssignmentRoomOverrides(
                  this.editingRow!.assignment.id,
                  input.overrides || []
                )
              )
            );

    obs$
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          this.modalError = this.extractErrorMessage(err);
          return of(null);
        }),
        finalize(() => (this.loading = false))
      )
      .subscribe((result) => {
        if (result) {
          this.ngZone.run(() => {
            this.showAssignModal = false;
            this.currentOperator = null;
            this.editingRow = null;
            this.loadData();
          });
        }
      });
  }

  onAssignCancel() {
    this.ngZone.run(() => {
      this.showAssignModal = false;
      this.currentOperator = null;
      this.editingRow = null;
      this.modalError = null;
      this.selectedPatternGroupId = '';
      this.selectedRoomId = '';
      this.selectedChairId = '';
      this.overridesDraft = [];
      this.roomAvailability = [];
      this.availabilityKey = '';
      this.invalidateConflictCheck();
    });
  }

  // ==================== Editor grafico ====================

  /** Pattern group del template in corso di assegnazione/modifica. */
  get editorPatternGroup(): PatternGroup | null {
    if (this.modalMode === 'edit') {
      return (this.editingRow?.assignment.patternGroup as PatternGroup) || null;
    }
    return this.patternGroups.find((pg) => pg.id === this.selectedPatternGroupId) || null;
  }

  openRoomEditor() {
    if (!this.editorPatternGroup) {
      this.modalError = 'Seleziona prima un template';
      return;
    }
    this.ngZone.run(() => {
      this.modalError = null;
      this.showRoomEditor = true;
    });
  }

  onRoomEditorSave(result: EditorResult) {
    this.ngZone.run(() => {
      this.selectedRoomId = result.roomId;
      this.selectedChairId = result.chairId;
      this.overridesDraft = result.overrides.map((o) => ({ ...o }));
      this.showOverrides = this.overridesDraft.length > 0;
      this.invalidateConflictCheck();
      this.showRoomEditor = false;
    });
  }

  onRoomEditorCancel() {
    this.ngZone.run(() => {
      this.showRoomEditor = false;
    });
  }

  /** Etichetta studio/poltrona per la riga della timeline. */
  getRowRoomLabel(row: AssignmentRow): string | null {
    const a = row.assignment;
    const parts: string[] = [];
    if (a.room?.name) {
      parts.push(a.chair?.name ? `${a.room.name} · ${a.chair.name}` : a.room.name);
    }
    const overrideCount = a.roomOverrides?.length || 0;
    if (overrideCount > 0) {
      parts.push(`${overrideCount} override`);
    }
    return parts.length > 0 ? parts.join(' + ') : null;
  }

  // ==================== Azioni riga ====================

  /**
   * Elimina (righe future, mai entrate in vigore) o revoca (righe attive o
   * passate: restano in archivio ma escono dalla timeline e dal calendario).
   */
  removeRow(item: OperatorWithAssignments, row: AssignmentRow) {
    this.ngZone.run(() => {
      const name = `${item.operator.name} ${item.operator.surname || ''}`.trim();
      const isFuture = row.state === 'future';
      const message = isFuture
        ? `Eliminare l'assegnazione futura di "${row.patternGroupName}" a ${name}?`
        : `Revocare l'assegnazione di "${row.patternGroupName}" a ${name}?\n` +
          `Le disponibilità del periodo ${this.getRowValidityLabel(row)} verranno rimosse dal calendario.`;

      if (!confirm(message)) return;

      this.loading = true;
      this.error = null;

      const obs$: Observable<unknown> = isFuture
        ? this.templateService.deleteTemplateAssignment(row.assignment.id)
        : this.templateService.deactivateTemplateAssignment(row.assignment.id);

      obs$
        .pipe(
          takeUntil(this.destroy$),
          catchError((err) => {
            this.error = 'Errore nella rimozione: ' + this.extractErrorMessage(err);
            return of(null);
          }),
          finalize(() => (this.loading = false))
        )
        .subscribe((result) => {
          if (result) {
            this.ngZone.run(() => this.loadData());
          }
        });
    });
  }

  private extractErrorMessage(err: any): string {
    return (
      err?.graphQLErrors?.[0]?.message ||
      err?.message ||
      'Errore imprevisto'
    );
  }

  // ==================== Label helpers ====================

  formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  getRowValidityLabel(row: AssignmentRow): string {
    const from = this.formatDate(row.validFrom);
    return row.validUntil
      ? `${from} → ${this.formatDate(row.validUntil)}`
      : `${from} → senza scadenza`;
  }

  getRowStateLabel(row: AssignmentRow): string {
    switch (row.state) {
      case 'active':
        return 'In corso';
      case 'future':
        return 'Futura';
      case 'expired':
        return 'Scaduta';
    }
  }

  getRowExpirationWarning(row: AssignmentRow): string | null {
    if (
      row.state === 'active' &&
      row.daysUntilExpiration !== null &&
      row.daysUntilExpiration <= 15
    ) {
      return row.daysUntilExpiration <= 0
        ? 'Scade oggi'
        : `Scade tra ${row.daysUntilExpiration} giorn${row.daysUntilExpiration > 1 ? 'i' : 'o'}`;
    }
    return null;
  }

  getStatusIcon(status: OperatorWithAssignments['status']): string {
    switch (status) {
      case 'active':
        return '✅';
      case 'expiring':
        return '⚠️';
      case 'future':
        return '🕒';
      case 'none':
        return '❌';
    }
  }

  getStatusLabel(status: OperatorWithAssignments['status']): string {
    switch (status) {
      case 'active':
        return 'Attivo';
      case 'expiring':
        return 'In Scadenza';
      case 'future':
        return 'Solo Futuro';
      case 'none':
        return 'Nessuno';
    }
  }

  getStatusClass(status: OperatorWithAssignments['status']): string {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'expiring':
        return 'status-expiring';
      case 'future':
        return 'status-future';
      case 'none':
        return 'status-none';
    }
  }

  trackByOperatorId(index: number, item: OperatorWithAssignments): string {
    return item.operator.id;
  }

  trackByAssignmentId(index: number, row: AssignmentRow): string {
    return row.assignment.id;
  }

  getMacroCategoryLabel(macroCategory: OperatorMacroCategory): string {
    return getMacroCategoryLabel(macroCategory);
  }

  // Overlay click handlers (previene chiusura durante selezione testo con click-and-drag)
  onOverlayMouseDown(event: MouseEvent): void {
    this.overlayMouseDownTarget = event.target;
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.overlayMouseDownTarget === event.currentTarget &&
        event.target === event.currentTarget) {
      this.onAssignCancel();
    }
    this.overlayMouseDownTarget = null;
  }
}

import { Component, Input, Output, EventEmitter, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../../models/user.model';
import { Treatment, getTreatmentStatusLabel, getTreatmentStatusColor } from '../../../models/treatment.model';
import { OperatorMacroCategory, InstrumentCategory } from '../../../graphql/generated/types';
import { AppointmentSearchFilters } from '../services/calendar-state.service';

@Component({
  selector: 'app-calendar-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-sidebar.component.html',
  styleUrls: ['./calendar-sidebar.component.scss']
})
export class CalendarSidebarComponent {
  constructor(
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  @Input() allUsers: User[] = [];
  @Input() selectedUsers: User[] = [];
  @Input() collapsed: boolean = false;
  @Input() selectedMacroCategory: OperatorMacroCategory | null = null;
  @Input() searchFilters: AppointmentSearchFilters = { duration: 45, withInstrument: false };
  @Input() instrumentCategories: InstrumentCategory[] = [];
  @Input() slotSearchEnabled: boolean = false;
  @Input() ongoingTreatments: Treatment[] = [];
  @Input() loadingTreatments = false;

  @Output() userToggle = new EventEmitter<User>();
  @Output() selectAll = new EventEmitter<void>();
  @Output() deselectAll = new EventEmitter<void>();
  @Output() toggleCollapse = new EventEmitter<void>();
  @Output() macroCategoryChange = new EventEmitter<OperatorMacroCategory | null>();
  @Output() searchFiltersChange = new EventEmitter<Partial<AppointmentSearchFilters>>();
  @Output() slotSearchToggle = new EventEmitter<boolean>();

  // UI state
  operatorsExpanded = true;
  filtersExpanded = true;
  treatmentsExpanded = false;

  // Durate disponibili
  durations = [
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 45, label: '45 min' },
    { value: 60, label: '60 min' }
  ];

  categories = [
    { value: null, label: 'Tutte le categorie' },
    { value: OperatorMacroCategory.Doctor, label: 'Medici' },
    { value: OperatorMacroCategory.Physiotherapist, label: 'Fisioterapisti' },
    { value: OperatorMacroCategory.GymInstructor, label: 'Istruttori Palestra' }
  ];

  get allSelected(): boolean {
    return this.allUsers.length > 0 && this.selectedUsers.length === this.allUsers.length;
  }

  get someSelected(): boolean {
    return this.selectedUsers.length > 0 && this.selectedUsers.length < this.allUsers.length;
  }

  isUserSelected(user: User): boolean {
    return this.selectedUsers.some(u => u.id === user.id);
  }

  onUserToggle(user: User): void {
    this.userToggle.emit(user);
  }

  onSelectAll(): void {
    if (this.allSelected) {
      this.deselectAll.emit();
    } else {
      this.selectAll.emit();
    }
  }

  onToggleCollapse(): void {
    this.toggleCollapse.emit();
  }

  onCategoryChange(value: string): void {
    const category = value ? value as OperatorMacroCategory : null;
    this.macroCategoryChange.emit(category);
  }

  /**
   * Verifica se un operatore non ha template assegnato.
   * Usa il campo hasTemplate sul modello User.
   */
  hasNoTemplate(user: User): boolean {
    return !user.hasTemplate;
  }

  // ============ PANEL TOGGLES ============

  toggleOperatorsExpanded(): void {
    this.ngZone.run(() => {
      this.operatorsExpanded = !this.operatorsExpanded;
      this.cdr.markForCheck();
    });
  }

  toggleFiltersExpanded(): void {
    this.ngZone.run(() => {
      this.filtersExpanded = !this.filtersExpanded;
      this.cdr.markForCheck();
    });
  }

  toggleTreatmentsExpanded(): void {
    this.ngZone.run(() => {
      this.treatmentsExpanded = !this.treatmentsExpanded;
      this.cdr.markForCheck();
    });
  }

  // Computed properties per visibilità condizionale dei filtri
  get canHaveInstrument(): boolean {
    return this.searchFilters.duration >= 30;
  }

  get showInstrumentCount(): boolean {
    return this.searchFilters.withInstrument && this.searchFilters.duration >= 30;
  }

  get canHaveTwoInstruments(): boolean {
    return this.searchFilters.duration >= 45;
  }

  get showInstrumentPosition(): boolean {
    return this.searchFilters.withInstrument &&
           this.searchFilters.instrumentCount === 1 &&
           this.searchFilters.duration > 30;
  }

  get showInstrumentOrder(): boolean {
    return this.searchFilters.withInstrument &&
           this.searchFilters.instrumentCount === 2;
  }

  get showInstrumentCategory(): boolean {
    return this.searchFilters.withInstrument && this.searchFilters.instrumentCount === 1;
  }

  get showTwoInstrumentCategories(): boolean {
    return this.searchFilters.withInstrument && this.searchFilters.instrumentCount === 2;
  }

  // Handler per toggle ricerca slot
  onSlotSearchToggle(enabled: boolean): void {
    this.slotSearchToggle.emit(enabled);
  }

  // Handler per cambio filtri
  onDurationChange(value: number): void {
    this.searchFiltersChange.emit({ duration: value as 15 | 30 | 45 | 60 });
  }

  onWithInstrumentChange(value: boolean): void {
    this.searchFiltersChange.emit({ withInstrument: value });
  }

  onInstrumentCountChange(value: number): void {
    this.searchFiltersChange.emit({ instrumentCount: value as 1 | 2 });
  }

  onInstrumentPositionChange(value: string): void {
    this.searchFiltersChange.emit({ instrumentPosition: value as 'first' | 'second' });
  }

  onInstrumentOrderChange(value: boolean): void {
    this.searchFiltersChange.emit({ instrumentOrderMatters: value });
  }

  onInstrumentCategoryChange(value: string): void {
    this.searchFiltersChange.emit({ instrumentCategoryId: value || null });
  }

  onInstrument2CategoryChange(value: string): void {
    this.searchFiltersChange.emit({ instrument2CategoryId: value || null });
  }

  // Label per posizione strumento basata sulla durata
  getPositionLabel(position: 'first' | 'second'): string {
    const duration = this.searchFilters.duration;
    if (position === 'first') {
      return 'Primi 30 min (0-30)';
    } else {
      if (duration === 45) {
        return 'Secondi 30 min (15-45)';
      } else {
        return 'Secondi 30 min (30-60)';
      }
    }
  }

  // ============ TRATTAMENTI IN CORSO ============

  /**
   * Getter per filtrare i trattamenti in base agli operatori selezionati.
   * Se selectedUsers è vuoto, mostra tutti i trattamenti.
   * Altrimenti mostra solo quelli degli operatori selezionati.
   */
  get filteredTreatments(): Treatment[] {
    if (!this.ongoingTreatments || this.ongoingTreatments.length === 0) {
      return [];
    }

    // Se nessun operatore selezionato, mostra tutti
    if (!this.selectedUsers || this.selectedUsers.length === 0) {
      return this.ongoingTreatments;
    }

    // Filtra per operatori selezionati
    const selectedOperatorIds = this.selectedUsers.map(u => u.operatorId).filter(Boolean);
    return this.ongoingTreatments.filter(t =>
      t.operatorId && selectedOperatorIds.includes(t.operatorId)
    );
  }

  getTreatmentStatusLabel(status: string): string {
    return getTreatmentStatusLabel(status as any);
  }

  getTreatmentStatusColor(status: string): string {
    return getTreatmentStatusColor(status as any);
  }

  formatTreatmentDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  }

  formatTreatmentTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
}

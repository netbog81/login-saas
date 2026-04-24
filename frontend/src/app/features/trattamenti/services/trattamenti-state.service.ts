import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import {
  Trattamento,
  TrattamentiFilters,
  TrattamentiViewMode,
  TreatmentStatus,
} from '../models/trattamento.model';

/**
 * Layer 3 - State service per la feature Trattamenti.
 * Contiene filtri, modalità di vista e selezione multipla.
 * Non chiama mai il backend: quella è responsabilità di TrattamentiService.
 */
@Injectable({ providedIn: 'root' })
export class TrattamentiStateService {
  // ==================== STATE ====================

  private readonly filtersSubject = new BehaviorSubject<TrattamentiFilters>({
    statuses: [TreatmentStatus.IN_PROGRESS, TreatmentStatus.OPERATOR_COMPLETED],
  });

  private readonly viewModeSubject = new BehaviorSubject<TrattamentiViewMode>('flat');

  private readonly treatmentsSubject = new BehaviorSubject<Trattamento[]>([]);

  private readonly loadingSubject = new BehaviorSubject<boolean>(false);

  private readonly errorSubject = new BehaviorSubject<string | null>(null);

  private readonly selectedIdsSubject = new BehaviorSubject<Set<string>>(new Set());

  // ==================== OBSERVABLES ====================

  readonly filters$ = this.filtersSubject.asObservable();
  readonly viewMode$ = this.viewModeSubject.asObservable();
  readonly treatments$ = this.treatmentsSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();
  readonly selectedIds$ = this.selectedIdsSubject.asObservable();

  readonly selectedCount$: Observable<number> = this.selectedIds$.pipe(
    map(s => s.size),
    distinctUntilChanged(),
  );

  /**
   * Trattamenti filtrati localmente sul testo di ricerca (se presente
   * nei filtri UI oltre ai filtri server). Per ora restituisce così com'è;
   * l'hook locale resta disponibile per estensioni future.
   */
  readonly filteredTreatments$: Observable<Trattamento[]> = combineLatest([
    this.treatments$,
  ]).pipe(map(([treatments]) => treatments));

  // ==================== GETTERS ====================

  get filters(): TrattamentiFilters {
    return this.filtersSubject.value;
  }
  get viewMode(): TrattamentiViewMode {
    return this.viewModeSubject.value;
  }
  get treatments(): Trattamento[] {
    return this.treatmentsSubject.value;
  }
  get selectedIds(): Set<string> {
    return this.selectedIdsSubject.value;
  }

  // ==================== MUTATIONS ====================

  setFilters(partial: Partial<TrattamentiFilters>): void {
    this.filtersSubject.next({ ...this.filtersSubject.value, ...partial });
    // Se cambiano i filtri, svuota la selezione (potrebbero non essere più visibili)
    this.clearSelection();
  }

  resetFilters(): void {
    this.filtersSubject.next({
      statuses: [TreatmentStatus.IN_PROGRESS, TreatmentStatus.OPERATOR_COMPLETED],
    });
    this.clearSelection();
  }

  setViewMode(mode: TrattamentiViewMode): void {
    this.viewModeSubject.next(mode);
  }

  setTreatments(treatments: Trattamento[]): void {
    this.treatmentsSubject.next(treatments);
    // Rimuovi selezioni che non sono più presenti nei risultati
    const visibleIds = new Set(treatments.map(t => t.id));
    const currentSelection = this.selectedIds;
    const stillValid = new Set(
      Array.from(currentSelection).filter(id => visibleIds.has(id)),
    );
    if (stillValid.size !== currentSelection.size) {
      this.selectedIdsSubject.next(stillValid);
    }
  }

  updateTreatment(treatment: Trattamento): void {
    const current = this.treatmentsSubject.value;
    const idx = current.findIndex(t => t.id === treatment.id);
    if (idx >= 0) {
      const next = [...current];
      next[idx] = treatment;
      this.treatmentsSubject.next(next);
    }
  }

  removeTreatment(id: string): void {
    this.treatmentsSubject.next(this.treatmentsSubject.value.filter(t => t.id !== id));
    this.deselect(id);
  }

  setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  setError(error: string | null): void {
    this.errorSubject.next(error);
  }

  // ==================== SELECTION ====================

  toggleSelection(id: string): void {
    const next = new Set(this.selectedIdsSubject.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIdsSubject.next(next);
  }

  select(id: string): void {
    const next = new Set(this.selectedIdsSubject.value);
    next.add(id);
    this.selectedIdsSubject.next(next);
  }

  deselect(id: string): void {
    const next = new Set(this.selectedIdsSubject.value);
    next.delete(id);
    this.selectedIdsSubject.next(next);
  }

  selectMany(ids: string[]): void {
    const next = new Set(this.selectedIdsSubject.value);
    ids.forEach(id => next.add(id));
    this.selectedIdsSubject.next(next);
  }

  selectAll(): void {
    const all = new Set(this.treatmentsSubject.value.map(t => t.id));
    this.selectedIdsSubject.next(all);
  }

  clearSelection(): void {
    if (this.selectedIdsSubject.value.size > 0) {
      this.selectedIdsSubject.next(new Set());
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIdsSubject.value.has(id);
  }
}

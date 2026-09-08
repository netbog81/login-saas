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
 *
 * Filtri persistiti su localStorage (sessione 7): default include
 * IN_PROGRESS + OPERATOR_COMPLETED + CLOSED. Reset filtri ripristina il
 * default e cancella la cache.
 */
@Injectable({ providedIn: 'root' })
export class TrattamentiStateService {
  // ==================== STATE ====================

  /** Default filtri quando localStorage è vuoto o resetFilters() viene chiamato. */
  private static readonly DEFAULT_FILTERS: TrattamentiFilters = {
    statuses: [
      TreatmentStatus.IN_PROGRESS,
      TreatmentStatus.OPERATOR_COMPLETED,
      TreatmentStatus.CLOSED,
    ],
  };

  /** Chiavi localStorage. Versionate per consentire migration future. */
  private static readonly LS_FILTERS_KEY = 'trattamenti.filters.v1';
  private static readonly LS_VIEWMODE_KEY = 'trattamenti.viewMode.v1';

  private readonly filtersSubject = new BehaviorSubject<TrattamentiFilters>(
    this.loadFiltersFromStorage(),
  );

  private readonly viewModeSubject = new BehaviorSubject<TrattamentiViewMode>(
    this.loadViewModeFromStorage(),
  );

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
    const next = { ...this.filtersSubject.value, ...partial };
    this.filtersSubject.next(next);
    this.persistFilters(next);
    // Se cambiano i filtri, svuota la selezione (potrebbero non essere più visibili)
    this.clearSelection();
  }

  resetFilters(): void {
    this.filtersSubject.next({ ...TrattamentiStateService.DEFAULT_FILTERS });
    this.clearFiltersFromStorage();
    this.clearSelection();
  }

  setViewMode(mode: TrattamentiViewMode): void {
    this.viewModeSubject.next(mode);
    this.persistViewMode(mode);
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

  // ==================== PERSISTENCE (localStorage) ====================

  private loadFiltersFromStorage(): TrattamentiFilters {
    try {
      const raw = localStorage.getItem(TrattamentiStateService.LS_FILTERS_KEY);
      if (!raw) return { ...TrattamentiStateService.DEFAULT_FILTERS };
      const parsed = JSON.parse(raw) as Partial<TrattamentiFilters>;
      // I filtri "fatturazione" (billingStatuses client-side + flag
      // tri-state server-side) NON vengono ripristinati tra sessioni:
      // restano attivi in modo invisibile e, combinati con un cambio di
      // operatore/periodo, producono liste vuote inspiegabili. Sono
      // quindi session-scoped: persistiamo solo statuses/date/operatore.
      delete parsed.billingStatuses;
      delete parsed.readyForBilling;
      delete parsed.isInvoicedToPatient;
      delete parsed.scontoFE;
      // Stessa ragione per il filtro orfani: è una modalità di pulizia
      // puntuale, non uno stato di lavoro. Se restasse acceso tra sessioni
      // la lista mostrerebbe solo i trattamenti senza appuntamento senza
      // che si capisca perché.
      delete parsed.withoutAppointment;
      // Idem per patientId: l'autocomplete paziente NON ripristina il testo
      // (patientSearchText riparte vuoto), quindi un patientId persistito
      // diventa un filtro fantasma invisibile che svuota la lista.
      delete parsed.patientId;
      // Merge col default per essere robusti a chiavi mancanti (es. dopo
      // aggiornamenti del modello filtri non ancora migrate).
      return { ...TrattamentiStateService.DEFAULT_FILTERS, ...parsed };
    } catch {
      return { ...TrattamentiStateService.DEFAULT_FILTERS };
    }
  }

  private loadViewModeFromStorage(): TrattamentiViewMode {
    try {
      const raw = localStorage.getItem(TrattamentiStateService.LS_VIEWMODE_KEY);
      if (raw === 'flat' || raw === 'by-patient' || raw === 'by-operator') return raw;
      return 'flat';
    } catch {
      return 'flat';
    }
  }

  private persistFilters(f: TrattamentiFilters): void {
    try {
      localStorage.setItem(
        TrattamentiStateService.LS_FILTERS_KEY,
        JSON.stringify(f),
      );
    } catch {
      /* localStorage non disponibile (private mode, quota piena): ignora */
    }
  }

  private persistViewMode(m: TrattamentiViewMode): void {
    try {
      localStorage.setItem(TrattamentiStateService.LS_VIEWMODE_KEY, m);
    } catch {
      /* ignore */
    }
  }

  private clearFiltersFromStorage(): void {
    try {
      localStorage.removeItem(TrattamentiStateService.LS_FILTERS_KEY);
    } catch {
      /* ignore */
    }
  }
}

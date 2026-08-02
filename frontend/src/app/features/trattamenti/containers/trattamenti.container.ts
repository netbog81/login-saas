import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, combineLatest } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

import { TrattamentiService } from '../services/trattamenti.service';
import { TrattamentiStateService } from '../services/trattamenti-state.service';
import { TrattamentiPdfService } from '../services/trattamenti-pdf.service';
import {
  AttendanceCertificateService,
  NoTemplateError,
} from '../../document-templates/services/attendance-certificate.service';
import {
  Trattamento,
  TrattamentiFilters,
  TrattamentiViewMode,
  TreatmentStatus,
  TreatmentBillingStatus,
  PaymentMethod,
  PaymentTenderLine,
} from '../models/trattamento.model';

import { TrattamentiFiltersComponent } from '../components/trattamenti-filters/trattamenti-filters.component';
import { TrattamentiListComponent, TrattamentoGroup } from '../components/trattamenti-list/trattamenti-list.component';
import {
  PagamentoSplitDialogComponent,
  PagamentoSplitDialogData,
  PagamentoSplitDialogResult,
} from '../components/pagamento-split-dialog/pagamento-split-dialog.component';
import {
  TrattamentoDetailComponent,
  DetailDialogData,
  DetailUpdateServiceDescriptionPayload,
  DetailEditInvoiceLinePayload,
  DetailUpdateEconomicsPayload,
} from '../components/trattamento-detail/trattamento-detail.component';

import { OperatorService } from '../../../services/operator.service';
import { PatientService } from '../../../services/patient.service';
import { ServiceService } from '../../../services/service.service';
import { AuthService } from '../../../core/auth/auth.service';
import { SseService, CalendarEvent } from '../../../services/sse.service';

const SECRETARY_ROLES = ['admin', 'amministratore', 'superadmin', 'segreteria'];

/**
 * Smart container riutilizzabile per la feature Trattamenti.
 *
 * Si comporta in modo diverso a seconda del ruolo dell'utente autenticato:
 * - segreteria/admin: vede tutti i trattamenti, filtri completi, può editare
 *   campi economici, righe fatturazione, marcare pronti per fatturazione.
 * - operatore (altro ruolo): vede solo i propri trattamenti, readonly sui
 *   campi economici e di fatturazione.
 *
 * È lo stesso component usato sia dentro una MatDialog (TrattamentiDialogContainer)
 * che come pagina routed (TrattamentiPageContainer). L'host decide solo il
 * layout esterno; il container gestisce tutta la logica.
 */
@Component({
  selector: 'app-trattamenti-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTooltipModule,
    TrattamentiFiltersComponent,
    TrattamentiListComponent,
  ],
  template: `
    <div class="container">
      <div class="toolbar">
        <h2>
          <mat-icon>healing</mat-icon>
          Trattamenti
        </h2>
        <div class="spacer"></div>

        @if (isSecretary && (state.selectedIds$ | async); as sel) {
          @if (sel.size > 0) {
            <div class="batch-actions">
              <span>{{ sel.size }} selezionati</span>
              @if (canSendSelection(sel)) {
                <button mat-flat-button color="accent" (click)="sendSelection()"
                  matTooltip="Chiude (se completati dall'operatore) e invia tutti i selezionati al sistema di fatturazione">
                  <mat-icon>send</mat-icon>
                  Invia a fatturazione
                </button>
              }
              <button mat-icon-button (click)="state.clearSelection()" matTooltip="Deseleziona">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          }
        }

        <button mat-stroked-button (click)="exportPdf()"
          [disabled]="flatTreatments.length === 0"
          matTooltip="Esporta l'elenco filtrato in PDF">
          <mat-icon>picture_as_pdf</mat-icon>
          Esporta PDF
        </button>

        <button mat-icon-button (click)="reload()" matTooltip="Ricarica">
          <mat-icon>refresh</mat-icon>
        </button>
      </div>

      @if (state.loading$ | async) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      @if (state.error$ | async; as err) {
        <div class="error-banner">
          <mat-icon>error</mat-icon>
          {{ err }}
        </div>
      }

      <app-trattamenti-filters
        [filters]="(state.filters$ | async) || {}"
        [viewMode]="(state.viewMode$ | async) || 'flat'"
        [operators]="operatorOptions"
        [patients]="patientOptions"
        [canSelectOperator]="isSecretary"
        [showBillingFlags]="isSecretary"
        [showViewMode]="true"
        (statusesChange)="onStatuses($event)"
        (billingStatusesChange)="state.setFilters({ billingStatuses: $event })"
        (dateFromChange)="state.setFilters({ dateFrom: $event })"
        (dateToChange)="state.setFilters({ dateTo: $event })"
        (dateRangeChange)="state.setFilters({ dateFrom: $event.from, dateTo: $event.to })"
        (operatorIdChange)="state.setFilters({ operatorId: $event })"
        (patientIdChange)="state.setFilters({ patientId: $event })"
        (patientSearchTerm)="onPatientSearch($event)"
        (readyForBillingChange)="state.setFilters({ readyForBilling: $event })"
        (isInvoicedChange)="state.setFilters({ isInvoicedToPatient: $event })"
        (scontoFEChange)="state.setFilters({ scontoFE: $event })"
        (viewModeChange)="state.setViewMode($event)"
        (clearDates)="state.setFilters({ dateFrom: null, dateTo: null })"
        (reset)="state.resetFilters()">
      </app-trattamenti-filters>

      <app-trattamenti-list
        [treatments]="flatTreatments"
        [groups]="groupedTreatments"
        [viewMode]="(state.viewMode$ | async) || 'flat'"
        [canSelect]="isSecretary"
        [canManage]="isSecretary && !readOnlyMode"
        [selectedIds]="(state.selectedIds$ | async) || emptySet"
        (toggleSelection)="state.toggleSelection($event)"
        (selectAllToggle)="onSelectAllToggle($event)"
        (openDetail)="openDetail($event)"
        (sendOne)="sendOne($event)"
        (closeTreatment)="closeOne($event)"
        (generateCertificate)="generateCertificate($event)">
      </app-trattamenti-list>

      <!-- Paginazione server-side (solo segreteria: la vista operatore ha
           volumi piccoli e resta non paginata). -->
      @if (isSecretary) {
        <mat-paginator
          [length]="totalCount"
          [pageIndex]="pageIndex"
          [pageSize]="pageSize"
          [pageSizeOptions]="[25, 50, 100]"
          (page)="onPage($event)"
          showFirstLastButtons>
        </mat-paginator>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      height: 100%;
      overflow: auto;
    }
    .toolbar {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 0;
    }
    .toolbar h2 { margin: 0; display: flex; align-items: center; gap: 8px; }
    .spacer { flex: 1; }
    .batch-actions {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 12px;
      background: rgba(33, 150, 243, 0.08);
      border-radius: 20px;
    }
    .error-banner {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px;
      background: #fdecea; color: #b71c1c; border-radius: 4px;
    }
  `],
})
export class TrattamentiContainer implements OnInit, OnDestroy {
  /** Se fornito, il container parte con filtri pre-impostati (es. dialog: oggi). */
  @Input() initialFilters?: Partial<TrattamentiFilters>;
  @Input() initialViewMode?: TrattamentiViewMode;

  /** Se true, forza anche per segreteria la vista del solo operatore corrente. */
  @Input() forceOwnOperatorOnly = false;

  /**
   * Se true, il container opera in **modalità sola lettura** per la
   * pagina dashboard operatore: nasconde tutte le azioni di segreteria
   * (chiudi, riapri, force-close, marca pronto, invia a fatturazione,
   * registra pagamento) ma permette di consultare il dettaglio.
   * Indipendente da `forceOwnOperatorOnly`: è un controllo UI sul
   * dialog dettaglio. Il backend rimane comunque la fonte di verità.
   */
  @Input() readOnlyMode = false;

  /**
   * 2026-07-27 — Deep-link: id trattamento da aprire subito nel riquadro
   * dettagli (route /trattamenti/:treatmentId, es. "apri il trattamento nel
   * clinico" dall'elenco Da fatturare dell'accounting). Fetch mirato by id:
   * il trattamento può non essere nella lista per via dei filtri correnti.
   */
  @Input() openTreatmentId: string | null = null;

  @Output() closed = new EventEmitter<void>();

  isSecretary = false;
  currentOperatorId: string | null = null;
  currentUserId: string | null = null;

  operatorOptions: { id: string; label: string }[] = [];
  patientOptions: { id: string; label: string }[] = [];

  flatTreatments: Trattamento[] = [];
  groupedTreatments: TrattamentoGroup[] = [];

  // Paginazione server-side (solo vista segreteria). Volutamente NON nei
  // filtri persistiti: la pagina riparte da 0 a ogni cambio filtri/sessione.
  totalCount = 0;
  pageIndex = 0;
  pageSize = 50;

  emptySet = new Set<string>();

  /**
   * Idempotenza UI per il flusso "Fattura" → "Incassa": treatmentId con
   * un'azione in volo. Finché l'id è nel set il bottone resta disabilitato
   * ("…"), così 3 click veloci producono UNA sola azione. Liberato in
   * next/error/complete del relativo Observable.
   */
  private fatturaInFlight = new Set<string>();
  private incassaInFlight = new Set<string>();
  /** Idempotenza "Verifica risoluzione e riprova" (invoice-blocked retry). */
  private retryInvoiceInFlight = new Set<string>();

  private destroy$ = new Subject<void>();

  constructor(
    public state: TrattamentiStateService,
    private service: TrattamentiService,
    private operatorService: OperatorService,
    private auth: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private sse: SseService,
    private cdr: ChangeDetectorRef,
    private patientService: PatientService,
    private pdfService: TrattamentiPdfService,
    private serviceService: ServiceService,
    private certificateService: AttendanceCertificateService,
  ) {}

  /** Catalogo servizi (per il dropdown "aggiungi riga servizio" nel dettaglio). */
  serviceCatalog: {
    id: string;
    name: string;
    defaultPrice?: number;
    discountFE?: number;
  }[] = [];

  ngOnInit(): void {
    this.isSecretary = this.auth.hasRole(SECRETARY_ROLES);
    const user = this.auth.currentUser();
    this.currentUserId = (user as any)?.id || (user as any)?.userId || null;

    // Catalogo servizi per il dropdown "aggiungi riga servizio" (una volta).
    this.serviceService.getServicesOnce().subscribe({
      next: (services) => {
        this.serviceCatalog = (services || [])
          .filter((s) => s.isActive !== false)
          .map((s) => ({
            id: s.id,
            name: s.name,
            defaultPrice: s.defaultPrice,
            discountFE: (s as any).discountFE ?? undefined,
          }));
      },
      error: () => { /* catalogo opzionale: se fallisce, dropdown vuoto */ },
    });

    // Applica filtri iniziali se forniti
    if (this.initialFilters) {
      this.state.setFilters(this.initialFilters);
    }
    if (this.initialViewMode) {
      this.state.setViewMode(this.initialViewMode);
    }

    // Per operatori: forza filtro sul proprio operatorId
    if (!this.isSecretary || this.forceOwnOperatorOnly) {
      this.operatorService.getMyOperator().subscribe({
        next: (op) => {
          if (op) {
            this.currentOperatorId = op.id;
            this.state.setFilters({ operatorId: op.id });
          }
          this.loadOperatorsOptions();
          this.subscribeToReload();
          this.subscribeToSse();
        },
        error: () => {
          this.loadOperatorsOptions();
          this.subscribeToReload();
          this.subscribeToSse();
        },
      });
    } else {
      this.loadOperatorsOptions();
      this.subscribeToReload();
      this.subscribeToSse();
    }

    // Deep-link /trattamenti/:id → apri direttamente il riquadro dettagli.
    // La lista si carica in parallelo per conto suo; qui basta il fetch
    // mirato del singolo trattamento.
    if (this.openTreatmentId) {
      this.service.getById(this.openTreatmentId).subscribe({
        next: (t) => {
          if (t) {
            this.openDetail(t);
          } else {
            this.snackBar.open(
              'Trattamento non trovato: forse è stato eliminato o il link non è più valido.',
              'OK',
              { duration: 6000 },
            );
          }
        },
        error: () =>
          this.snackBar.open(
            'Errore nel caricamento del trattamento dal link.',
            'OK',
            { duration: 6000 },
          ),
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Sessione 7 — Safety net: se l'utente torna alla tab del browser dopo
   * un periodo di assenza (es. è andato su accounting, ha emesso fattura,
   * torna su clinico) → reload completo. Cope il caso edge in cui la SSE
   * connection si è interrotta e non si è auto-riconnessa.
   */
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.reload();
    }
  }

  /**
   * Ogni volta che cambiano i filtri, ricarica. Debounce 200ms per evitare
   * chiamate multiple quando l'utente tocca rapidamente più filtri.
   */
  private subscribeToReload(): void {
    this.state.filters$
      .pipe(debounceTime(200), takeUntil(this.destroy$))
      .subscribe(() => {
        // Un cambio di filtri riparte sempre dalla prima pagina.
        this.pageIndex = 0;
        this.reload();
      });

    // Trasforma i treatments in flat + groups ogni volta che cambiano.
    // Include `state.filters$` per applicare i filtri client-only (es.
    // billingStatuses, vedi Step 6.4 sessione 6) prima del rendering.
    combineLatest([this.state.treatments$, this.state.viewMode$, this.state.filters$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([treatments, mode, filters]) => {
        // try/catch difensivo: un errore qui (es. dato inatteso in buildGroups)
        // NON deve terminare la subscription (congelerebbe la lista per sempre).
        try {
          const filtered = this.applyClientFilters(treatments, filters);
          this.flatTreatments = filtered;
          this.groupedTreatments = this.buildGroups(filtered, mode);
        } catch (err) {
          console.error('[trattamenti] errore nel rebuild lista/gruppi:', err);
          // Fallback: mostra almeno la lista flat non raggruppata.
          this.flatTreatments = treatments;
          this.groupedTreatments = [];
        }
        // OnPush: subscription async non triggera CD da sola. markForCheck
        // garantisce che il refresh SSE → state.updateTreatment → questa
        // emission re-renderizzi la lista.
        this.cdr.markForCheck();
      });
  }

  /**
   * Sessione 7 — Sottoscrive al canale SSE `/events/appointments` per
   * ricevere eventi `treatment_status_changed` (+ created/deleted).
   * Sostituisce il polling rimosso in commit 81190cf: real-time push,
   * niente flickering, banda zero.
   *
   * Strategia di refetch:
   *  - `treatment_status_changed` con `treatmentId` presente in lista →
   *    refetch MIRATO del singolo treatment (TREATMENT_BY_ID). Aggiorna
   *    riga + propaga al dialog aperto via state.treatments$.
   *  - `treatment_created` / `treatment_deleted` → reload completo
   *    (creazione/cancellazione può aggiungere/togliere righe). Rari.
   *  - `heartbeat` → ignora.
   *  - Eventi per treatment NON in lista (es. operatore Y mentre vedo
   *    operatore X) → ignora.
   *
   * Cleanup: takeUntil(destroy$) chiude la subscription al destroy del
   * container; SseService chiude EventSource al unsubscribe.
   */
  private subscribeToSse(): void {
    // eslint-disable-next-line no-console
    console.log('[TrattamentiContainer] subscribeToSse() called');
    this.sse.getAppointmentEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event: CalendarEvent) => {
          // eslint-disable-next-line no-console
          console.log('[TrattamentiContainer] SSE event received', event);
          if (event.type === 'heartbeat') return;

          if (event.type === 'treatment_status_changed' && event.treatmentId) {
            const targetId = event.treatmentId;
            const inList = this.state.treatments.some(t => t.id === targetId);
            // eslint-disable-next-line no-console
            console.log('[SSE-handler]', { targetId, inList, listSize: this.state.treatments.length });
            if (!inList) {
              // Treatment non in lista corrente: potrebbe essere appena creato
              // o appena passato a uno status filtrato. Reload completo per
              // gestire il caso.
              this.reload();
              return;
            }
            this.service.getById(targetId).subscribe({
              next: (fresh) => {
                // eslint-disable-next-line no-console
                console.log('[SSE-handler] refetch result', {
                  targetId,
                  hasResult: !!fresh,
                  newStatus: fresh?.billingStatus,
                });
                if (fresh) {
                  this.state.updateTreatment(fresh);
                  this.cdr.markForCheck();
                }
              },
              error: (e) => {
                // eslint-disable-next-line no-console
                console.error('[SSE-handler] refetch error', e);
              },
            });
            return;
          }

          if (event.type === 'treatment_created' || event.type === 'treatment_deleted') {
            this.reload();
          }
        },
      });
  }

  /**
   * Filtri applicati lato client su risultati già caricati dal backend.
   * Per ora solo `billingStatuses` (multi-select chip in
   * trattamenti-filters). Altri filtri viaggiano server-side via query
   * GraphQL (vedi sanitizeFilters nel service).
   */
  private applyClientFilters(
    treatments: Trattamento[],
    filters: TrattamentiFilters,
  ): Trattamento[] {
    const billingFilter = filters.billingStatuses;
    if (!billingFilter || billingFilter.length === 0) {
      return treatments;
    }
    const allowed = new Set(billingFilter);
    return treatments.filter(t =>
      t.billingStatus != null && allowed.has(t.billingStatus),
    );
  }

  reload(): void {
    this.state.setLoading(true);
    this.state.setError(null);

    const filters = this.state.filters;
    const obs = this.isSecretary
      ? this.service.getForSecretary({
          ...filters,
          limit: this.pageSize,
          offset: this.pageIndex * this.pageSize,
        })
      : this.service.getForOperator(filters.operatorId || this.currentOperatorId || '', filters);

    // Count in parallelo alla pagina (stessi filtri, senza limit/offset).
    if (this.isSecretary) {
      this.service.getForSecretaryCount(filters)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (n) => {
            this.totalCount = n;
            this.cdr.markForCheck();
          },
          error: () => { /* il paginator tiene l'ultimo count noto */ },
        });
    }

    obs.subscribe({
      next: (treatments) => {
        this.state.setTreatments(treatments);
        this.state.setLoading(false);
        this.rebuildPatientOptions(treatments);
      },
      error: (err) => {
        this.state.setError(this.extractError(err));
        this.state.setLoading(false);
      },
    });
  }

  onPage(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.reload();
  }

  private loadOperatorsOptions(): void {
    // Solo la segreteria/admin vede il selettore operatore, quindi
    // solo per loro carichiamo la lista. Gli altri vedono solo i propri.
    if (!this.isSecretary) return;
    // L'esistente AvailabilityStateService espone già operators,
    // ma per non creare dipendenze qui usiamo OperatorService.getMyOperator
    // è insufficiente — usiamo la stessa API dell'altra feature per
    // prendere tutti gli operatori. Fallback: lista vuota se non disponibile.
    // getAllOperators esiste in OperatorService:
    this.operatorService.getOperators()?.subscribe?.({
      next: (ops: any[]) => {
        this.operatorOptions = (ops || []).map(o => ({
          id: o.id,
          label: `${o.name} ${o.surname || ''}`.trim(),
        }));
      },
      error: () => { /* silenziosa: opzionale */ },
    });
  }

  private rebuildPatientOptions(treatments: Trattamento[]): void {
    // Quando l'utente sta cercando un paziente dal registry, le opzioni
    // provengono dalla ricerca remota: non sovrascriverle con i soli pazienti
    // presenti nei risultati correnti (sarebbe un filtro circolare).
    if (this.patientOptionsFromSearch) return;
    const map = new Map<string, string>();
    for (const t of treatments) {
      if (t.patient) {
        map.set(t.patient.id, `${t.patient.nome} ${t.patient.cognome}`.trim());
      }
    }
    this.patientOptions = Array.from(map.entries()).map(([id, label]) => ({ id, label }));
    this.patientOptions.sort((a, b) => a.label.localeCompare(b.label));
  }

  /** true quando patientOptions deriva dalla ricerca registry (non dai risultati). */
  private patientOptionsFromSearch = false;

  /**
   * Ricerca paziente nel registry (qualsiasi paziente, non solo quelli con
   * trattamenti nel periodo filtrato). Popola le opzioni dell'autocomplete.
   */
  onPatientSearch(term: string): void {
    if (!term || !term.trim()) {
      // Ricerca azzerata: torna a derivare le opzioni dai risultati correnti.
      this.patientOptionsFromSearch = false;
      this.rebuildPatientOptions(this.flatTreatments);
      this.cdr.markForCheck();
      return;
    }
    this.patientOptionsFromSearch = true;
    this.patientService.searchPatients(term.trim())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (patients) => {
          this.patientOptions = (patients || []).map(p => ({
            id: p.id,
            label: `${p.cognome ?? ''} ${p.nome ?? ''}`.trim(),
          })).sort((a, b) => a.label.localeCompare(b.label));
          this.cdr.markForCheck();
        },
        error: () => { /* silenzioso: nessun risultato */ },
      });
  }

  // ==================== FILTRI ====================

  onStatuses(statuses: TreatmentStatus[]): void {
    this.state.setFilters({ statuses });
  }

  onSelectAllToggle(checked: boolean): void {
    if (checked) this.state.selectAll();
    else this.state.clearSelection();
  }

  /**
   * Chiusura rapida dalla segreteria dalla riga della lista (icona accanto ai
   * dettagli). Abilitata solo per trattamenti OPERATOR_COMPLETED — il pulsante
   * emette solo in quel caso (vincolo lato lista). Riusa `service.close`, la
   * stessa mutation del dialog dettaglio.
   */
  /**
   * Conferma esplicita prima di riaprire un trattamento. Il messaggio dipende
   * dallo stato attuale (la riapertura è un dispatcher lato backend):
   *  - CLOSED → OPERATOR_COMPLETED: la segreteria ANNULLA la propria chiusura
   *    per correggere dati/righe. Il trattamento NON torna all'operatore.
   *  - OPERATOR_COMPLETED → IN_PROGRESS: lo riporta "in corso" all'operatore,
   *    come se non l'avesse completato — azione forte, warning esplicito.
   * Ritorna true se l'utente conferma.
   */
  private confirmReopen(currentStatus: TreatmentStatus | string | undefined | null): boolean {
    if (currentStatus === TreatmentStatus.CLOSED) {
      return window.confirm(
        'Riaprire questo trattamento chiuso dalla segreteria?\n\n' +
          'Tornerà nello stato «chiuso dall\'operatore», così puoi correggere ' +
          'righe, prezzi o dati amministrativi prima dell\'invio a fatturazione. ' +
          'Non viene restituito all\'operatore.',
      );
    }
    if (currentStatus === TreatmentStatus.OPERATOR_COMPLETED) {
      return window.confirm(
        '⚠️ Attenzione: questo trattamento è stato chiuso dall\'operatore.\n\n' +
          'Riaprendolo tornerà «in corso» e risulterà come se l\'operatore non ' +
          'l\'avesse ancora completato. Procedere comunque?',
      );
    }
    return true;
  }

  closeOne(t: Trattamento): void {
    this.service.close(t.id).subscribe({
      next: (updated) => {
        this.state.updateTreatment(updated);
        this.snackBar.open('Trattamento chiuso dalla segreteria', 'OK', { duration: 2500 });
      },
      error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
    });
  }

  /**
   * Esporta in PDF l'elenco trattamenti risultante dai filtri correnti
   * (flatTreatments = già filtrato client-side). Risolve i nomi
   * operatore/paziente per titolo e nome file; i placeholder
   * alloperator/allpatients/periodocompleto sono gestiti dal service.
   */
  exportPdf(): void {
    if (this.flatTreatments.length === 0) return;
    this.pdfService.export({
      treatments: this.flatTreatments,
      filters: this.state.filters,
      operatorLabel: this.operatorNameForFilter(),
      patientLabel: this.patientNameForFilter(),
    });
  }

  /** Nome operatore del filtro attivo (dai risultati, fallback alle opzioni). */
  private operatorNameForFilter(): string | null {
    const id = this.state.filters.operatorId;
    if (!id) return null;
    const t = this.flatTreatments.find(x => x.operator?.id === id);
    if (t?.operator) return `${t.operator.name} ${t.operator.surname || ''}`.trim();
    return this.operatorOptions.find(o => o.id === id)?.label ?? null;
  }

  /** Nome paziente del filtro attivo (dai risultati, fallback alle opzioni). */
  private patientNameForFilter(): string | null {
    const id = this.state.filters.patientId;
    if (!id) return null;
    const t = this.flatTreatments.find(x => x.patient?.id === id);
    if (t?.patient) return `${t.patient.nome} ${t.patient.cognome}`.trim();
    return this.patientOptions.find(o => o.id === id)?.label ?? null;
  }

  // ==================== INVIO A FATTURAZIONE ====================

  /** Restituisce true se TUTTI i trattamenti selezionati sono in stato
   * "inviabile" al sistema di fatturazione.
   *
   * Vincoli:
   * - status CLOSED o OPERATOR_COMPLETED (il backend auto-chiude gli
   *   OPERATOR_COMPLETED all'invio: policy "chiusura segreteria = invio")
   * - scontoFE=false (i trattamenti fattura elettronica esclusi non
   *   passano da accounting)
   * - billingStatus IN (NOT_READY, READY_FOR_BILLING) — esclude i
   *   trattamenti già SENT/PENDING/INVOICED/CANCELLED/REFUNDED. Una
   *   volta inviato non si può re-inviare (idempotenza UI).
   */
  canSendSelection(selectedIds: Set<string>): boolean {
    if (selectedIds.size === 0) return false;
    const set = this.state.treatments.filter(t => selectedIds.has(t.id));
    if (set.length === 0) return false;
    const sendableStatuses: ReadonlyArray<TreatmentBillingStatus | null | undefined> = [
      TreatmentBillingStatus.NotReady,
      TreatmentBillingStatus.ReadyForBilling,
      null,
      undefined,  // treatment vecchi pre-sessione 6 senza billingStatus
    ];
    return set.every(t =>
      (t.status === TreatmentStatus.CLOSED || t.status === TreatmentStatus.OPERATOR_COMPLETED)
      && t.scontoFE === false
      && sendableStatuses.includes(t.billingStatus),
    );
  }

  sendSelection(): void {
    const ids = Array.from(this.state.selectedIds);
    if (ids.length === 0) return;
    // Sessione 6 chiusa: setReadyForBilling pubblica treatment.closed
    // → consumer accounting crea BillableEvent → billable.received
    // aggiorna treatment.billingStatus SENT → PENDING (eventually
    // consistent, ~1s). AutoIssue NON scatta (requestImmediateInvoice=false).
    // Il primo reload mostra SENT; un refresh manuale dell'utente entro
    // 1-2s mostrerà PENDING.
    this.service.setReadyForBilling(ids, true).subscribe({
      next: () => {
        this.snackBar.open(
          ids.length === 1
            ? 'Trattamento inviato al sistema di fatturazione'
            : `${ids.length} trattamenti inviati al sistema di fatturazione`,
          'OK',
          { duration: 4000 },
        );
        this.reload();
      },
      error: (err) => {
        this.snackBar.open(this.extractError(err), 'OK', { duration: 5000 });
      },
    });
  }

  sendOne(t: Trattamento): void {
    this.service.setReadyForBilling([t.id], true).subscribe({
      next: () => {
        this.snackBar.open(
          'Trattamento inviato al sistema di fatturazione',
          'OK',
          { duration: 4000 },
        );
        this.reload();
      },
      error: (err) => {
        this.snackBar.open(this.extractError(err), 'OK', { duration: 5000 });
      },
    });
  }

  /**
   * Dopo una mutation che cambia un solo trattamento: ricarica la lista
   * completa (economia di una query sola) e poi aggiorna anche
   * l'istanza del dialog aperto (che è OnPush: il setter triggera il
   * refresh visivo).
   */
  private refreshSingleTreatment(
    id: string,
    ref: { componentInstance: { treatment: Trattamento } },
  ): void {
    const filters = this.state.filters;
    const obs = this.isSecretary
      ? this.service.getForSecretary(filters)
      : this.service.getForOperator(filters.operatorId || this.currentOperatorId || '', filters);

    obs.subscribe({
      next: (treatments) => {
        this.state.setTreatments(treatments);
        const updated = treatments.find(t => t.id === id);
        if (updated && ref?.componentInstance) {
          ref.componentInstance.treatment = updated;
        }
      },
      error: (err) => {
        this.state.setError(this.extractError(err));
      },
    });
  }

  // ==================== ATTESTATO DI PRESENZA ====================

  /**
   * Genera l'attestato di presenza dal template predefinito (Configurazioni
   * → Template documenti) e apre il dialog di stampa del browser.
   */
  generateCertificate(t: Trattamento): void {
    this.certificateService.generateForTreatment(t.id).subscribe({
      error: (err) => {
        if (err instanceof NoTemplateError) {
          this.snackBar
            .open(err.message, 'Apri configurazioni', { duration: 8000 })
            .onAction()
            .subscribe(() => {
              window.open('/settings/document-templates', '_blank');
            });
          return;
        }
        this.snackBar.open(
          `Errore nella generazione dell'attestato: ${this.extractError(err)}`,
          'OK',
          { duration: 6000 },
        );
      },
    });
  }

  // ==================== DETAIL DIALOG ====================

  openDetail(treatment: Trattamento): void {
    // In modalità readOnly (dashboard operatore) le azioni amministrative
    // (chiudere/riaprire/inviare a fatturazione/forzare chiusura) restano
    // disabilitate. Il PAGAMENTO invece è consentito anche lì (2026-07-10):
    // l'operatore con canCollectPayment deve poter incassare/annullare dal
    // suo workspace, anche a trattamento chiuso (es. il paziente paga alla
    // seduta successiva). Il backend resta la fonte di verità (ruolo dal
    // JWT + canCollectPayment sulle mutation di pagamento).
    const editEconomicsAllowed = this.isSecretary && !this.readOnlyMode;
    const recordPaymentAllowed = this.canRecordPayment(treatment);
    const data: DetailDialogData = {
      treatment,
      canEditEconomics: editEconomicsAllowed,
      canRecordPayment: recordPaymentAllowed,
      currentUserId: this.currentUserId ?? undefined,
    };
    // Force-close: anche qui escluso in readOnlyMode.
    const canForceCloseTreatment = this.isSecretary && !this.readOnlyMode;

    const ref = this.dialog.open(TrattamentoDetailComponent, {
      data,
      width: '900px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'trattamento-detail-dialog',
      hasBackdrop: true,
      autoFocus: false,
    });

    const inst = ref.componentInstance;
    inst.canForceCloseTreatment = canForceCloseTreatment;
    inst.serviceCatalog = this.serviceCatalog;
    // Catalogo operatori per il selettore "Eseguito da" (attribuzione
    // compenso riga). Popolato solo per segreteria/admin.
    inst.operatorCatalog = this.operatorOptions;

    // Helper definito qui sopra (vs in basso) per essere referenziabile
    // dalla subscription state.treatments$ → fresh update.
    const applyBillingFlagsToInst = (t: Trattamento): void => {
      const flags = this.computeBillingFlags(t);
      ref.componentInstance.billingCancelDisabled = flags.cancelDisabled;
      ref.componentInstance.billingCancelDisabledReason = flags.cancelDisabledReason;
      ref.componentInstance.billingReopenDisabled = flags.reopenDisabled;
      ref.componentInstance.billingReopenDisabledReason = flags.reopenDisabledReason;
      ref.componentInstance.billingFatturaVisible = flags.fatturaVisible;
      ref.componentInstance.billingFatturaDisabled = flags.fatturaDisabled;
      ref.componentInstance.billingFatturaDisabledReason = flags.fatturaDisabledReason;
      ref.componentInstance.billingFatturaInFlight = flags.fatturaInFlight;
      ref.componentInstance.billingIncassaVisible = flags.incassaVisible;
      ref.componentInstance.billingIncassaDisabled = flags.incassaDisabled;
      ref.componentInstance.billingIncassaDisabledReason = flags.incassaDisabledReason;
      ref.componentInstance.billingIncassaInFlight = flags.incassaInFlight;
      ref.componentInstance.billingAwaitingFiscalConfig = flags.awaitingFiscalConfig;
      ref.componentInstance.billingRetryInvoiceVisible = flags.retryInvoiceVisible;
      ref.componentInstance.billingRetryInvoiceDisabled = flags.retryInvoiceDisabled;
      ref.componentInstance.billingRetryInvoiceDisabledReason = flags.retryInvoiceDisabledReason;
      ref.componentInstance.billingRetryInvoiceInFlight = flags.retryInvoiceInFlight;
      ref.componentInstance.billingRecallDisabled = flags.recallDisabled;
      ref.componentInstance.billingRecallDisabledReason = flags.recallDisabledReason;
      ref.componentInstance.billingRecallInFlight = flags.recallInFlight;
      ref.componentInstance.billingSentWarningLevel = flags.sentWarningLevel;
      ref.componentInstance.billingSentWarningMessage = flags.sentWarningMessage;
      ref.componentInstance.billingResendVisible = flags.resendVisible;
      ref.componentInstance.billingResendDisabled = flags.resendDisabled;
      ref.componentInstance.billingResendDisabledReason = flags.resendDisabledReason;
    };

    // Sessione 7 — Sync dialog ↔ state: quando reload() (anche da polling
    // recall in volo) rinfresca la lista, propaga la nuova versione del
    // treatment corrente al dialog. Senza, l'operatore con dialog aperto
    // resta a guardare uno spinner "Richiamo in corso" anche dopo che
    // accounting ha risposto. Subscription chiusa al dialog close.
    this.state.treatments$
      .pipe(takeUntil(ref.afterClosed()))
      .subscribe((list) => {
        const fresh = list.find((t) => t.id === treatment.id);
        if (!fresh) return;
        const current = ref.componentInstance.treatment;
        // Aggiorna solo se i campi rilevanti sono cambiati (evita
        // re-render inutili). Confronto su billingStatus + recall fields +
        // totale/stato pagamento: tutto ciò che cambia via consumer async (SSE).
        // accountingTotalAmount/isPaid servono per mostrare live il totale con
        // bollo confermato e l'evidenza "Incassato" senza refresh manuale.
        if (
          fresh.billingStatus !== current.billingStatus ||
          fresh.readyForBilling !== current.readyForBilling ||
          fresh.forcedClosure !== current.forcedClosure ||
          fresh.accountingTotalAmount !== current.accountingTotalAmount ||
          fresh.isPaid !== current.isPaid ||
          fresh.billingHoldReason !== current.billingHoldReason ||
          fresh.billingHoldReasonAt !== current.billingHoldReasonAt ||
          fresh.recallRequestId !== current.recallRequestId ||
          fresh.lastRecallRejectionAt !== current.lastRecallRejectionAt ||
          fresh.returnedFromAccountingAt !== current.returnedFromAccountingAt ||
          fresh.accountingInvoiceUrl !== current.accountingInvoiceUrl
        ) {
          ref.componentInstance.treatment = fresh;
          applyBillingFlagsToInst(fresh);
        }
      });

    inst.updateServiceDescription.subscribe((p: DetailUpdateServiceDescriptionPayload) => {
      this.service.updateServiceInvoiceDescription(p).subscribe({
        next: (updatedTs) => {
          // Aggiornamento puntuale del singolo TreatmentService nel
          // trattamento in-memory: evita di ricaricare tutta la lista
          // e il conseguente blip visivo del textarea (distruzione/
          // ricostruzione DOM). trackBy su mat-table garantisce che
          // la riga non venga smontata.
          const current = ref.componentInstance.treatment;
          const nextServices = (current.treatmentServices || []).map(ts =>
            ts.id === updatedTs.id
              ? { ...ts, invoiceLineDescription: updatedTs.invoiceLineDescription ?? null,
                         invoiceLineDescriptionAuto: updatedTs.invoiceLineDescriptionAuto ?? null }
              : ts
          );
          const nextTreatment = { ...current, treatmentServices: nextServices };
          ref.componentInstance.treatment = nextTreatment;
          this.state.updateTreatment(nextTreatment);
          this.snackBar.open('Descrizione salvata', 'OK', { duration: 1500 });
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 4000 }),
      });
    });

    inst.createInvoiceLine.subscribe((p: DetailEditInvoiceLinePayload) => {
      if (p.mode !== 'create' || !p.input) return;
      this.service.createInvoiceLine(
        {
          treatmentId: treatment.id,
          description: p.input.description || '',
          amount: p.input.amount ?? 0,
        },
        this.currentUserId ?? undefined,
      ).subscribe({
        next: () => this.refreshSingleTreatment(treatment.id, ref),
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 4000 }),
      });
    });

    inst.updateInvoiceLine.subscribe((p: DetailEditInvoiceLinePayload) => {
      if (p.mode !== 'update' || !p.input?.id) return;
      this.service.updateInvoiceLine({
        id: p.input.id,
        description: p.input.description,
        amount: p.input.amount,
      }).subscribe({
        next: () => this.refreshSingleTreatment(treatment.id, ref),
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 4000 }),
      });
    });

    inst.deleteInvoiceLine.subscribe((p: DetailEditInvoiceLinePayload) => {
      if (p.mode !== 'delete' || !p.line) return;
      this.service.deleteInvoiceLine(p.line.id).subscribe({
        next: () => this.refreshSingleTreatment(treatment.id, ref),
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 4000 }),
      });
    });

    // 2026-07-02 — Aggiungi riga servizio (dal catalogo).
    inst.addServiceLine.subscribe((p: {
      serviceId: string;
      description?: string;
      price?: number;
      executorOperatorId?: string | null;
    }) => {
      this.service.addTreatmentServiceLine(
        treatment.id, p.serviceId, p.description, p.price, p.executorOperatorId ?? null,
      ).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          this.snackBar.open('Riga servizio aggiunta', 'OK', { duration: 2000 });
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    // 2026-07-15 — Cambia "Eseguito da" su una riga esistente: a quell'
    // operatore va il compenso della riga nei conteggi.
    inst.changeServiceLineExecutor.subscribe((p: {
      treatmentServiceId: string;
      executorOperatorId: string | null;
    }) => {
      this.service.updateTreatmentServiceExecutor(p.treatmentServiceId, p.executorOperatorId).subscribe({
        next: (updatedTs) => {
          const current = ref.componentInstance.treatment;
          const nextServices = (current.treatmentServices || []).map(ts =>
            ts.id === updatedTs.id
              ? { ...ts,
                  executorOperatorId: updatedTs.executorOperatorId ?? null,
                  executorOperator: updatedTs.executorOperator ?? null }
              : ts
          );
          const nextTreatment = { ...current, treatmentServices: nextServices };
          ref.componentInstance.treatment = nextTreatment;
          this.state.updateTreatment(nextTreatment);
          this.snackBar.open('Operatore esecutore aggiornato', 'OK', { duration: 2000 });
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 4000 }),
      });
    });

    // 2026-07-02 — Rimuovi riga servizio.
    inst.removeServiceLine.subscribe((treatmentServiceId: string) => {
      this.service.removeTreatmentServiceLine(treatmentServiceId).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          this.snackBar.open('Riga servizio rimossa', 'OK', { duration: 2000 });
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    inst.updateEconomics.subscribe((p: DetailUpdateEconomicsPayload) => {
      const prevStatus = ref.componentInstance.treatment.billingStatus;
      this.service.updateBySecretary({
        id: treatment.id,
        ...p,
      }).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          // I flag dei pulsanti dipendono da billingStatus, che può cambiare
          // (auto-recall su abilitazione scontoFE: SENT/PENDING → NOT_READY).
          // Senza ricalcolarli resterebbero stale fino al prossimo SSE.
          applyBillingFlagsToInst(updated);
          // Se l'abilitazione dello sconto FE ha scatenato il recupero da
          // accounting, segnalalo esplicitamente (feedback distinto dal
          // generico "Modifiche salvate").
          const wasSentOrPending =
            prevStatus === TreatmentBillingStatus.Sent ||
            prevStatus === TreatmentBillingStatus.Pending;
          if (p.scontoFE === true && wasSentOrPending) {
            this.snackBar.open(
              'Sconto FE abilitato. Il trattamento è stato richiamato da accounting e torna modificabile.',
              'OK',
              { duration: 4000 },
            );
          } else {
            this.snackBar.open('Modifiche salvate', 'OK', { duration: 2000 });
          }
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    // Toggle "Segna come incassato in contanti" (sconto FE): registra o annulla
    // l'incasso contanti sul totale. Solo clinico, nessun evento accounting.
    inst.markScontoFeCash.subscribe((paid: boolean) => {
      this.service.markScontoFeCashPayment(treatment.id, paid).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          applyBillingFlagsToInst(updated);
          this.snackBar.open(
            paid ? 'Incasso contanti registrato' : 'Incasso annullato',
            'OK',
            { duration: 2000 },
          );
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    // 2026-07-08 — Annulla pagamento (annulla-e-reinserisci al posto della
    // vecchia modifica). Conferma esplicita: tocca i movimenti di cassa.
    inst.cancelPayment.subscribe(() => {
      const t = ref.componentInstance.treatment;
      const ok = window.confirm(
        'Annullare il pagamento registrato? L\'incasso verrà azzerato ' +
          '(eventuali voucher FE usati verranno ripristinati) e potrà essere reinserito.',
      );
      if (!ok) return;
      this.service.cancelTreatmentPayment(t.id).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          applyBillingFlagsToInst(updated);
          this.snackBar.open('Pagamento annullato', 'OK', { duration: 2500 });
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    inst.openPaymentDialog.subscribe((opts: { replace: boolean }) => {
      // PARTE 2/4 — apre il dialog di pagamento con split multi-riga + voucher.
      // È l'UNICO punto di registrazione/correzione del pagamento (la scheda
      // del dettaglio mostra solo stato + fonte, niente form inline).
      const t = ref.componentInstance.treatment;
      const dialogRef = this.dialog.open<
        PagamentoSplitDialogComponent,
        PagamentoSplitDialogData,
        PagamentoSplitDialogResult
      >(PagamentoSplitDialogComponent, {
        width: '560px',
        data: {
          treatmentId: t.id,
          patientId: t.patient?.id ?? null,
          scontoFE: t.scontoFE === true,
          // Totale REALE confermato da accounting (bollo incluso) se la
          // fattura è emessa; prima usava sempre t.price → sul documento
          // l'incasso risultava parziale (es. 80 su 82).
          totalAmount: t.scontoFE === true
            ? (t.price ?? 0)
            : (t.accountingTotalAmount ?? t.price ?? 0),
          currentUserId: this.currentUserId ?? '',
          isCorrection: opts.replace,
          // Emissione voucher FE solo per segreteria/admin (l'operatore può
          // solo scalare i voucher esistenti).
          canIssueVoucherFe: this.isSecretary,
          multiInvoice: (t.accountingDocumentTreatmentCount ?? 1) > 1
            ? {
                treatmentCount: t.accountingDocumentTreatmentCount!,
                invoiceNumber: t.patientInvoiceNumber,
              }
            : undefined,
        },
      });
      dialogRef.afterClosed().subscribe((result) => {
        if (!result) return;
        this.service.recordPayment(
          t.id,
          // paymentMethod legacy: deriva dalla prima riga 'method' se presente,
          // altrimenti OTHER (il backend usa tenderLines come fonte di verità).
          this.deriveLegacyMethod(result.tenderLines),
          result.collectedBy,
          result.amount,
          this.isSecretary ? 'SECRETARY' : 'OPERATOR',
          undefined,
          result.tenderLines,
          opts.replace, // replaceExisting
        ).subscribe({
          next: (updated) => {
            this.state.updateTreatment(updated);
            ref.componentInstance.treatment = updated;
            applyBillingFlagsToInst(updated);
            this.snackBar.open(
              opts.replace ? 'Pagamento aggiornato' : 'Pagamento registrato',
              'OK',
              { duration: 2000 },
            );
          },
          error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
        });
      });
    });

    inst.sendToBilling.subscribe(() => {
      this.service.setReadyForBilling([treatment.id], true).subscribe({
        next: () => {
          // setReadyForBilling(true) triggera publish treatment.closed →
          // billingStatus passa a SENT (sync) e poi PENDING (async dopo
          // billable.received). Refetch completo garantisce che il dialog
          // mostri lo stato accounting reale. NB: billingStatus PENDING
          // arriva di solito ~1s dopo, l'utente vedrà SENT poi un
          // refresh successivo mostrerà PENDING.
          this.refreshSingleTreatment(treatment.id, ref);
          this.snackBar.open(
            'Trattamento inviato al sistema di fatturazione',
            'OK',
            { duration: 3000 },
          );
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    inst.closeTreatment.subscribe(() => {
      this.service.close(treatment.id).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          this.snackBar.open('Trattamento chiuso dalla segreteria', 'OK', { duration: 2000 });
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    inst.reopenTreatment.subscribe(() => {
      if (!this.confirmReopen(ref.componentInstance.treatment.status)) return;
      this.service.reopen(treatment.id).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          this.snackBar.open('Trattamento riaperto', 'OK', { duration: 2000 });
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    inst.forceCloseTreatment.subscribe(() => {
      this.service.forceClose(treatment.id).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          this.snackBar.open(
            'Trattamento chiuso forzatamente. Operatore avvisato in audit.',
            'OK',
            { duration: 3500 },
          );
        },
        error: (e) =>
          this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    // ────────── BillingSection (sessione 6 Step 6.5) ──────────
    // applyBillingFlagsToInst è dichiarata sopra (per uso anche nella
    // subscription state.treatments$). Qui solo inizializzazione.
    applyBillingFlagsToInst(treatment);

    // Sessione 7 — "Annulla invio a fatturazione" (rinominato): riporta
    // il treatment a NOT_READY (riapribile/modificabile) e, se SENT/PENDING,
    // pubblica treatment.cancelled ad accounting.
    inst.cancelTreatmentBilling.subscribe((id: string) => {
      const reason = window.prompt(
        "Annullare l'invio a fatturazione?\n\n" +
          'Il trattamento tornerà modificabile (stato "Non pronto"). ' +
          "Se era già stato inviato ad accounting, verrà notificato.\n\n" +
          'Inserisci un motivo (obbligatorio):',
        '',
      );
      if (!reason || reason.trim().length === 0) {
        return;
      }
      this.service.cancelTreatment(id, reason.trim()).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          applyBillingFlagsToInst(updated);
          this.snackBar.open(
            'Invio a fatturazione annullato. Il trattamento è ora modificabile.',
            'OK',
            { duration: 3000 },
          );
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    // Reopen: usa la mutation esistente reopen del service.
    inst.reopenTreatmentBilling.subscribe((id: string) => {
      if (!this.confirmReopen(ref.componentInstance.treatment.status)) return;
      this.service.reopen(id).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          applyBillingFlagsToInst(updated);
          this.snackBar.open('Trattamento riaperto', 'OK', { duration: 2000 });
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    // ── Passo 1 — "Fattura" ────────────────────────────────────────────────
    // Chiede ad accounting di EMETTERE la fattura (totale vero con marca da
    // bollo). NON registra alcun pagamento: l'incasso avviene solo dopo, con
    // "Incassa", sul totale confermato. Modello "prima fattura → totale vero →
    // poi incassa".
    //
    // Idempotenza: se c'è già una richiesta in volo per questo id, ignora i
    // click successivi (3 click veloci = 1 sola richiesta).
    inst.invoiceTreatment.subscribe((id: string) => {
      if (this.fatturaInFlight.has(id)) return;

      // "Fattura" emette DAVVERO il documento fiscale (immediate=true →
      // AutoIssue accounting). È un'operazione economica irreversibile
      // (per correggere serve nota di credito): conferma esplicita per
      // evitare emissioni accidentali con un clic dopo la chiusura.
      const t = ref.componentInstance.treatment;
      const importo = (t.accountingTotalAmount ?? t.price ?? 0)
        .toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
      const ok = window.confirm(
        `Emettere subito la fattura per questo trattamento (${importo})?\n\n` +
          "Il documento fiscale viene emesso immediatamente dall'amministrazione. " +
          'Per annullarlo servirà una nota di credito.\n\n' +
          'Per inviarlo invece alla coda "da fatturare" senza emetterlo, usa ' +
          '"Invia al sistema di fatturazione".',
      );
      if (!ok) return;

      this.fatturaInFlight.add(id);
      applyBillingFlagsToInst(ref.componentInstance.treatment);

      const clearInFlight = () => {
        this.fatturaInFlight.delete(id);
        applyBillingFlagsToInst(ref.componentInstance.treatment);
      };

      // setReadyForBillingImmediate = setReadyForBilling([id], true, true):
      // pubblica treatment.closed con requestImmediateInvoice=true SENZA
      // payment (treatment NON è isPaid) → accounting emette la fattura ma
      // NON registra alcun incasso. billingStatus passa a SENT → PENDING →
      // INVOICED (via SSE).
      this.service.setReadyForBillingImmediate(id).subscribe({
        next: () => {
          this.refreshSingleTreatment(id, ref);
          this.snackBar.open(
            'Trattamento inviato all\'amministrazione per l\'emissione della fattura.',
            'OK',
            { duration: 3000 },
          );
        },
        // error e complete sono mutuamente esclusivi in RxJS: clearInFlight va
        // chiamato in ENTRAMBI per liberare sempre il lock.
        error: (e) => {
          clearInFlight();
          this.snackBar.open(
            `Invio a fatturazione fallito: ${this.extractError(e)}`,
            'OK',
            { duration: 5000 },
          );
        },
        complete: () => clearInFlight(),
      });
    });

    // ── Passo 2 — "Incassa" ─────────────────────────────────────────────────
    // Registra il pagamento SUL TOTALE CONFERMATO da accounting
    // (accountingTotalAmount, marca da bollo inclusa). Visibile solo dopo
    // l'emissione fattura (billingStatus=INVOICED). Riusa il dialog split
    // voucher+contanti già esistente.
    //
    // Idempotenza: una richiesta per volta per treatmentId.
    inst.collectPaymentBilling.subscribe((id: string) => {
      if (this.incassaInFlight.has(id)) return;
      const t = ref.componentInstance.treatment;
      const confirmedTotal = t.accountingTotalAmount ?? t.price ?? 0;

      const payRef = this.dialog.open<
        PagamentoSplitDialogComponent,
        PagamentoSplitDialogData,
        PagamentoSplitDialogResult
      >(PagamentoSplitDialogComponent, {
        width: '560px',
        data: {
          treatmentId: t.id,
          patientId: t.patient?.id ?? null,
          scontoFE: false, // il flusso accounting non è mai scontoFE
          totalAmount: confirmedTotal,
          currentUserId: this.currentUserId ?? '',
          isCorrection: false,
          // Fattura cumulativa: banner nel dialog + incasso a saldo intero
          // (il backend marca pagati tutti i trattamenti della fattura).
          multiInvoice: (t.accountingDocumentTreatmentCount ?? 1) > 1
            ? {
                treatmentCount: t.accountingDocumentTreatmentCount!,
                invoiceNumber: t.patientInvoiceNumber,
              }
            : undefined,
        },
      });
      payRef.afterClosed().subscribe((result) => {
        if (!result) return; // cancel
        if (this.incassaInFlight.has(id)) return; // doppio-conferma race
        this.incassaInFlight.add(id);
        applyBillingFlagsToInst(ref.componentInstance.treatment);

        const clearInFlight = () => {
          this.incassaInFlight.delete(id);
          applyBillingFlagsToInst(ref.componentInstance.treatment);
        };

        this.service.recordPayment(
          id,
          this.deriveLegacyMethod(result.tenderLines),
          result.collectedBy,
          result.amount,
          this.isSecretary ? 'SECRETARY' : 'OPERATOR',
          undefined,
          result.tenderLines,
          false, // replaceExisting
        ).subscribe({
          next: (updated) => {
            this.state.updateTreatment(updated);
            ref.componentInstance.treatment = updated;
            this.snackBar.open('Incasso registrato', 'OK', { duration: 2000 });
          },
          error: (e) => {
            clearInFlight();
            this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 });
          },
          complete: () => clearInFlight(),
        });
      });
    });

    // "Verifica risoluzione e riprova" (invoice-blocked retry): chiede ad
    // accounting di ri-tentare l'emissione. L'esito arriva async via SSE
    // (billable.invoiced sblocca, billable.invoice-blocked aggiorna il motivo).
    // Idempotenza UI: un retry per volta per treatmentId.
    inst.retryInvoiceBilling.subscribe((id: string) => {
      if (this.retryInvoiceInFlight.has(id)) return;
      this.retryInvoiceInFlight.add(id);
      applyBillingFlagsToInst(ref.componentInstance.treatment);

      const clearInFlight = () => {
        this.retryInvoiceInFlight.delete(id);
        applyBillingFlagsToInst(ref.componentInstance.treatment);
      };

      this.service.retryTreatmentInvoice(id).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          this.snackBar.open(
            'Richiesta inviata all\'amministrazione. Se il problema è risolto, ' +
              'la fattura verrà emessa a breve.',
            'OK',
            { duration: 4000 },
          );
        },
        error: (e) => {
          clearInFlight();
          this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 });
        },
        complete: () => clearInFlight(),
      });
    });

    // dismissBillingAlert (Step 6.7): chiama mutation backend, idempotente.
    inst.dismissBillingAlert.subscribe((id: string) => {
      this.service.dismissBillingAlert(id).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          // Niente snackbar di conferma: il dismiss visibile è già il
          // banner che sparisce — feedback visivo immediato sufficiente.
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    // Sessione 7 — Recall: dialog conferma con reason opzionale.
    inst.requestTreatmentRecall.subscribe((id: string) => {
      const reason = window.prompt(
        'Richiamare il trattamento indietro per modifiche?\n\n' +
          "Verrà chiesto ad accounting di rilasciare il billable. Inserisci un motivo (opzionale):",
        '',
      );
      // Cancel del prompt → null. Stringa vuota → confermato senza motivo.
      if (reason === null) return;
      const trimmed = reason.trim();
      this.service.requestRecall(id, trimmed.length > 0 ? trimmed : undefined).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          applyBillingFlagsToInst(updated);
          this.snackBar.open(
            'Richiamo inviato ad accounting. Attendi la risposta.',
            'OK',
            { duration: 3000 },
          );
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    // Sessione 7 — Dismiss banner "Restituito dall'amministrazione".
    inst.dismissReturnFromAccountingBanner.subscribe((id: string) => {
      this.service.dismissReturnFromAccountingBanner(id).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    // Sessione 7 — "Forza re-invio ad accounting" (escape hatch).
    // Confermo prima perché ri-pubblica un messaggio: con il fix idempotency
    // accounting non duplica billable, ma l'operatore deve sapere cosa fa.
    inst.resendToAccounting.subscribe((id: string) => {
      const ok = window.confirm(
        'Forzare il re-invio del trattamento ad accounting?\n\n' +
          'Verrà ripubblicato il messaggio: se accounting non aveva ricevuto ' +
          "il primo invio (es. incident), questo lo risolve. Se invece l'invio " +
          'era arrivato, nessun doppio billable viene creato.',
      );
      if (!ok) return;
      this.service.resendToAccounting(id).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          applyBillingFlagsToInst(updated);
          this.snackBar.open(
            "Re-invio ad accounting effettuato. Attendi qualche secondo per la conferma.",
            'OK',
            { duration: 3000 },
          );
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    // PARTE 3 — "Stampa fattura": scarica il PDF dal proxy clinico (che inoltra
    // ad accounting) e lo apre in una nuova tab per la stampa. Nessuna mutation.
    inst.printInvoice.subscribe((id: string) => {
      this.service.fetchInvoicePdf(id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const win = window.open(url, '_blank');
          if (!win) {
            this.snackBar.open(
              'Impossibile aprire il PDF: consenti i popup per stampare la fattura.',
              'OK',
              { duration: 5000 },
            );
          }
          // Revoca l'object URL dopo un attimo: il tempo di farlo caricare dal
          // browser nella nuova tab. Evita memory leak senza chiudere la tab.
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        },
        error: (e) =>
          this.snackBar.open(
            `Impossibile recuperare il PDF della fattura: ${this.extractError(e)}`,
            'OK',
            { duration: 5000 },
          ),
      });
    });

    // Dopo la chiusura del dialog, garantiamo che la lista sia sincronizzata:
    // l'utente potrebbe aver chiuso senza applicare tutte le nostre
    // ottimizzazioni ottimistiche (es. mutation pending).
    ref.afterClosed().subscribe(() => {
      this.reload();
    });
  }

  /**
   * Calcola i flag disabled per i bottoni della BillingSection in base
   * a `treatment.billingStatus`. Semantica revisionata in sessione 7:
   *
   * - "Annulla invio a fatturazione": NOT_READY/READY_FOR_BILLING (no-op
   *   in NOT_READY) o SENT/PENDING (publish treatment.cancelled, status
   *   torna NOT_READY). Bloccato per INVOICED+ (serve NC).
   * - "Riapri per modifiche": SOLO NOT_READY/READY_FOR_BILLING (modifica
   *   locale). SENT/PENDING/INVOICED → tooltip "usa Richiama indietro".
   *   Post-fatturazione → bloccato (NC).
   * - "Fattura" (passo 1): SOLO CLOSED + !scontoFE + NOT_READY. Chiama
   *   setReadyForBillingImmediate (no payment) → accounting EMETTE la fattura.
   *   Nascosto da INVOICED in poi.
   * - "Incassa" (passo 2): SOLO dopo INVOICED, se !isPaid. Apre il dialog
   *   pagamento sul totale confermato (accountingTotalAmount) → recordPayment.
   * - "Richiama indietro": SENT/PENDING/INVOICED.
   */
  private computeBillingFlags(treatment: Trattamento): {
    cancelDisabled: boolean;
    cancelDisabledReason: string | null;
    reopenDisabled: boolean;
    reopenDisabledReason: string | null;
    // Flusso "Fattura" → "Incassa"
    fatturaVisible: boolean;
    fatturaDisabled: boolean;
    fatturaDisabledReason: string | null;
    fatturaInFlight: boolean;
    incassaVisible: boolean;
    incassaDisabled: boolean;
    incassaDisabledReason: string | null;
    incassaInFlight: boolean;
    awaitingFiscalConfig: boolean;
    retryInvoiceVisible: boolean;
    retryInvoiceDisabled: boolean;
    retryInvoiceDisabledReason: string | null;
    retryInvoiceInFlight: boolean;
    recallDisabled: boolean;
    recallDisabledReason: string | null;
    recallInFlight: boolean;
    // Sessione 7: warning SENT prolungato + bottone "Forza re-invio"
    sentWarningLevel: 'none' | 'soft' | 'hard';
    sentWarningMessage: string | null;
    resendVisible: boolean;
    resendDisabled: boolean;
    resendDisabledReason: string | null;
  } {
    const status = treatment.billingStatus;

    // Stati post-fatturazione che richiedono NC (testo unico human-friendly).
    const postInvoiceStates: ReadonlyArray<TreatmentBillingStatus> = [
      TreatmentBillingStatus.Invoiced,
      TreatmentBillingStatus.PartiallyRefunded,
      TreatmentBillingStatus.Refunded,
      TreatmentBillingStatus.Reissued,
      TreatmentBillingStatus.Cancelled,
    ];
    const isPostInvoice = status != null && postInvoiceStates.includes(status);
    const postInvoiceMsg =
      "Trattamento già fatturato. Per modificarlo o cancellarlo contatta " +
      "l'amministrazione (serve emettere una nota di credito).";

    // "Annulla invio a fatturazione": abilitato SOLO per SENT / PENDING, gli
    // unici stati in cui il treatment è stato effettivamente pubblicato verso
    // accounting (treatment.closed emesso). NOT_READY e READY_FOR_BILLING sono
    // entrambi "non ancora inviato": annullare l'invio non ha senso (niente da
    // annullare) → disabilitato con tooltip esplicativo. Per modificare un
    // treatment non ancora inviato si usa "Riapri per modifiche".
    const cancellableStates: ReadonlyArray<TreatmentBillingStatus> = [
      TreatmentBillingStatus.Sent,
      TreatmentBillingStatus.Pending,
    ];
    const cancelDisabled = !(status != null && cancellableStates.includes(status));
    const cancelDisabledReason = isPostInvoice
      ? postInvoiceMsg
      : status === TreatmentBillingStatus.NotReady ||
        status === TreatmentBillingStatus.ReadyForBilling
      ? "Il trattamento è pronto ma non è ancora stato inviato a fatturazione: niente da annullare. Usa 'Riapri per modifiche'."
      : null;

    // "Riapri per modifiche": SOLO se modifica è locale (NOT_READY /
    // READY_FOR_BILLING). SENT/PENDING/INVOICED rimanda a "Richiama indietro".
    // "Riapri per modifiche" = ANNULLA LA CHIUSURA della segreteria
    // (CLOSED → OPERATOR_COMPLETED), per correggere righe/prezzi prima
    // dell'invio. Vincolato a status===CLOSED: se il trattamento è solo
    // OPERATOR_COMPLETED è già modificabile (niente da riaprire) e un
    // ulteriore reopen lo spingerebbe a IN_PROGRESS, cioè lo restituirebbe
    // all'operatore facendolo sembrare non completato — NON è un'azione di
    // fatturazione e non deve partire da qui.
    const reopenIsClosed = treatment.status === TreatmentStatus.CLOSED;
    const reopenLocallyAllowed: ReadonlyArray<TreatmentBillingStatus> = [
      TreatmentBillingStatus.NotReady,
      TreatmentBillingStatus.ReadyForBilling,
    ];
    const canReopenLocally =
      reopenIsClosed && status != null && reopenLocallyAllowed.includes(status);
    const reopenDisabled = !canReopenLocally;
    const reopenDisabledReason = isPostInvoice
      ? postInvoiceMsg
      : status === TreatmentBillingStatus.Sent ||
        status === TreatmentBillingStatus.Pending
      ? "Il trattamento è già stato inviato ad accounting. Usa 'Richiama indietro' per riprenderlo lato amministrazione e poterlo modificare."
      : !reopenIsClosed
      ? "Disponibile solo per trattamenti chiusi dalla segreteria: annulla la chiusura per correggere righe e prezzi."
      : null;

    // ── Flusso "Fattura" → "Incassa" (due passi sequenziali) ──────────────
    //
    // Passo 1 "Fattura": chiede ad accounting di EMETTERE la fattura (totale
    // vero con marca da bollo). NON registra pagamento. Visibile finché la
    // fattura non è stata emessa; nascosto da INVOICED in poi. Abilitato SOLO
    // se:
    //  - NON è sconto FE (sconto FE non va mai ad accounting: il pagamento si
    //    registra dalla scheda "Pagamento", contanti/voucher_fe), E
    //  - il trattamento è già CHIUSO dalla segreteria (status=CLOSED), E
    //  - billingStatus è NOT_READY (non ancora inviato).
    //
    // Passo 2 "Incassa": registra il pagamento sul totale confermato. Visibile
    // SOLO dopo l'emissione (billingStatus=INVOICED) e se non già pagato.
    const isClosed = treatment.status === TreatmentStatus.CLOSED;
    const isScontoFE = treatment.scontoFE === true;
    const isInvoiced = status === TreatmentBillingStatus.Invoiced;
    const isSentOrPending =
      status === TreatmentBillingStatus.Sent ||
      status === TreatmentBillingStatus.Pending;

    // "Fattura": visibile solo se il trattamento può ancora essere fatturato
    // (non sconto FE, non già fatturato/post-fattura). Nascosto a INVOICED+.
    // Abilitato sia su NOT_READY che su READY_FOR_BILLING: la chiusura da
    // segreteria auto-marca READY_FOR_BILLING, e la fatturazione veloce deve
    // restare possibile finché il treatment non è stato DAVVERO inviato
    // (SENT+). Il backend accetta entrambi gli stati in setReadyForBilling.
    const fatturaReadyStates: ReadonlyArray<TreatmentBillingStatus> = [
      TreatmentBillingStatus.NotReady,
      TreatmentBillingStatus.ReadyForBilling,
    ];
    const fatturaStateOk = status == null || fatturaReadyStates.includes(status);
    const fatturaVisible = !isScontoFE && !isPostInvoice;
    const fatturaInFlight = this.fatturaInFlight.has(treatment.id);
    const fatturaDisabled =
      fatturaInFlight ||
      isScontoFE ||
      !isClosed ||
      !fatturaStateOk;
    const fatturaDisabledReason = isScontoFE
      ? "Trattamento con sconto FE: non si fattura ad accounting. Registra il pagamento dalla scheda \"Pagamento\"."
      : !isClosed
      ? "Prima chiudi il trattamento con \"Chiudi trattamento\", poi potrai inviarlo per la fatturazione."
      : isSentOrPending
      ? "Trattamento già inviato all'amministrazione: in attesa dell'emissione della fattura."
      : !fatturaStateOk
      ? "Disponibile solo per trattamenti chiusi non ancora inviati a fatturazione."
      : null;

    // "Incassa": visibile solo dopo l'emissione fattura. Disabilitato se già
    // pagato (idempotenza: niente doppio incasso) o se incasso in volo.
    const incassaInFlight = this.incassaInFlight.has(treatment.id);
    const incassaVisible = isInvoiced && !isScontoFE;
    const incassaDisabled = incassaInFlight || treatment.isPaid === true;
    const incassaDisabledReason = treatment.isPaid
      ? "Incasso già registrato per questo trattamento."
      : null;

    // 2026-07-08 — Banner "in attesa/bloccata" SOLO con un blocco REALE
    // comunicato da accounting (billable.invoice-blocked → billingHoldReason).
    // Prima appariva su OGNI treatment SENT/PENDING, ma con il flusso normale
    // "Pronto per fatturazione" (senza fattura immediata) lo stato PENDING è
    // fisiologico: il billable è in coda tra i documenti "da fatturare" di
    // accounting e verrà emesso da lì. Mostrare banner+pulsante lì era
    // fuorviante (sembrava un errore) e il retry forzava l'emissione
    // immediata bypassando la lista da fatturare.
    const awaitingFiscalConfig =
      isSentOrPending && !isScontoFE && !!treatment.billingHoldReason;

    // "Verifica risoluzione e riprova": solo insieme al blocco reale (il
    // retry forza AutoIssue, corretto solo quando l'intento era l'emissione
    // automatica rimasta bloccata).
    const retryInvoiceVisible = awaitingFiscalConfig;
    const retryInvoiceInFlight = this.retryInvoiceInFlight.has(treatment.id);
    const retryInvoiceDisabled = retryInvoiceInFlight;
    const retryInvoiceDisabledReason = null;

    // "Richiama indietro": SENT/PENDING/INVOICED. Bloccato se recall già in volo.
    const recallable: ReadonlyArray<TreatmentBillingStatus> = [
      TreatmentBillingStatus.Sent,
      TreatmentBillingStatus.Pending,
      TreatmentBillingStatus.Invoiced,
    ];
    const isRecallable = status != null && recallable.includes(status);
    const recallInFlight = !!treatment.recallRequestId;
    const recallDisabled = !isRecallable || recallInFlight;
    const recallDisabledReason = recallInFlight
      ? "Richiamo già in corso. Attendi la risposta da accounting (massimo 5 minuti)."
      : !isRecallable
      ? "Disponibile solo per trattamenti inviati ad accounting."
      : null;

    // Sessione 7 — Warning + bottone "Forza re-invio" per SENT prolungato.
    // Solo SENT trigger il warning: PENDING significa che accounting ha
    // già confermato ricezione, anche se non ha ancora fatturato.
    let sentWarningLevel: 'none' | 'soft' | 'hard' = 'none';
    let sentWarningMessage: string | null = null;
    let resendVisible = false;
    let resendDisabled = true;
    let resendDisabledReason: string | null =
      "Disponibile solo se l'invio ad accounting non viene confermato entro 5 minuti.";

    if (status === TreatmentBillingStatus.Sent && treatment.readyForBillingAt) {
      const sentAtMs = new Date(treatment.readyForBillingAt).getTime();
      const elapsedSec = (Date.now() - sentAtMs) / 1000;
      if (elapsedSec >= 300) {
        sentWarningLevel = 'hard';
        sentWarningMessage =
          'Accounting non ha confermato la ricezione del trattamento. ' +
          'Possibile problema di comunicazione: puoi forzare il re-invio.';
        resendVisible = true;
        resendDisabled = false;
        resendDisabledReason = null;
      } else if (elapsedSec >= 30) {
        sentWarningLevel = 'soft';
        sentWarningMessage =
          "Invio in corso, in attesa di conferma da accounting.";
      }
    }

    return {
      cancelDisabled,
      cancelDisabledReason,
      reopenDisabled,
      reopenDisabledReason,
      fatturaVisible,
      fatturaDisabled,
      fatturaDisabledReason,
      fatturaInFlight,
      incassaVisible,
      incassaDisabled,
      incassaDisabledReason,
      incassaInFlight,
      awaitingFiscalConfig,
      retryInvoiceVisible,
      retryInvoiceDisabled,
      retryInvoiceDisabledReason,
      retryInvoiceInFlight,
      recallDisabled,
      recallDisabledReason,
      recallInFlight,
      sentWarningLevel,
      sentWarningMessage,
      resendVisible,
      resendDisabled,
      resendDisabledReason,
    };
  }

  // ==================== HELPERS ====================

  /**
   * Visibilità scheda Pagamento nel dialog dettaglio.
   *
   * - Segreteria/admin: sempre visibile. Se il trattamento è CLOSED i
   *   campi sono comunque mostrati ma in lettura (vedi template detail).
   * - Operatori: visibile solo se hanno canCollectPayment=true E il
   *   trattamento non è ancora CLOSED (dopo la chiusura non ha senso che
   *   l'operatore tocchi la parte economica).
   */
  private canRecordPayment(t: Trattamento): boolean {
    // Segreteria: sempre (anche su trattamento chiuso/inviato — il backend
    // consente la registrazione/correzione dell'incasso post-chiusura).
    if (this.isSecretary) return true;
    // Operatore: solo se ha il permesso di incassare. NON blocchiamo più su
    // CLOSED: l'incasso può essere registrato/corretto anche dopo la chiusura.
    return t.operator?.canCollectPayment === true;
  }

  /**
   * Deriva il `paymentMethod` legacy (enum clinico) dalla prima riga 'method'
   * delle tenderLines, per retro-compat dell'input. Il backend usa comunque le
   * tenderLines come fonte di verità; questo valore è solo un fallback.
   */
  private deriveLegacyMethod(lines: PaymentTenderLine[]): PaymentMethod {
    const first = lines.find((l) => l.kind === 'method');
    const code = (first?.paymentMethodId ?? '').toLowerCase();
    if (code.includes('cash') || code.includes('contant')) return PaymentMethod.CASH;
    if (code.includes('card') || code.includes('bancomat') || code.includes('pos')) return PaymentMethod.CARD;
    if (code.includes('transfer') || code.includes('bonific')) return PaymentMethod.TRANSFER;
    if (code.includes('satispay')) return PaymentMethod.SATISPAY;
    return PaymentMethod.OTHER;
  }

  private buildGroups(treatments: Trattamento[], mode: TrattamentiViewMode): TrattamentoGroup[] {
    if (mode === 'flat') return [];

    if (mode === 'by-patient') {
      const map = new Map<string, TrattamentoGroup>();
      for (const t of treatments) {
        const key = t.patient?.id || '__unknown__';
        const label = t.patient
          ? `${t.patient.nome} ${t.patient.cognome}`.trim()
          : 'Senza paziente';
        if (!map.has(key)) {
          map.set(key, { key, label, treatments: [] });
        }
        map.get(key)!.treatments.push(t);
      }
      return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    }

    if (mode === 'by-operator') {
      const opMap = new Map<string, { label: string; patients: Map<string, TrattamentoGroup> }>();
      for (const t of treatments) {
        const opKey = t.operator?.id || '__no_operator__';
        const opLabel = t.operator
          ? `${t.operator.name} ${t.operator.surname || ''}`.trim()
          : 'Operatore rimosso';
        const patKey = t.patient?.id || '__unknown__';
        const patLabel = t.patient
          ? `${t.patient.nome} ${t.patient.cognome}`.trim()
          : 'Senza paziente';

        if (!opMap.has(opKey)) {
          opMap.set(opKey, { label: opLabel, patients: new Map() });
        }
        const opEntry = opMap.get(opKey)!;
        if (!opEntry.patients.has(patKey)) {
          opEntry.patients.set(patKey, { key: patKey, label: patLabel, treatments: [] });
        }
        opEntry.patients.get(patKey)!.treatments.push(t);
      }

      return Array.from(opMap.entries()).map(([key, entry]) => {
        const children = Array.from(entry.patients.values())
          .sort((a, b) => a.label.localeCompare(b.label));
        const count = children.reduce((s, c) => s + c.treatments.length, 0);
        return {
          key,
          label: entry.label,
          children,
          treatments: children.flatMap(c => c.treatments), // per contare nel badge
        };
      }).sort((a, b) => a.label.localeCompare(b.label));
    }

    if (mode === 'by-day-operator') {
      // Albero Giorno → Operatore: gruppo per giorno (data), e dentro
      // suddivisione per operatore. Stessa forma a 2 livelli di by-operator,
      // cosi' il componente lista lo renderizza senza modifiche.
      const dayMap = new Map<string, { label: string; operators: Map<string, TrattamentoGroup> }>();
      for (const t of treatments) {
        const dayKey = (t.appointment?.appointmentDate || t.startedAt || '').slice(0, 10);
        const opKey = t.operator?.id || '__no_operator__';
        const opLabel = t.operator
          ? `${t.operator.name} ${t.operator.surname || ''}`.trim()
          : 'Operatore rimosso';

        if (!dayMap.has(dayKey)) {
          dayMap.set(dayKey, { label: this.formatDayGroupLabel(dayKey), operators: new Map() });
        }
        const dayEntry = dayMap.get(dayKey)!;
        if (!dayEntry.operators.has(opKey)) {
          dayEntry.operators.set(opKey, { key: opKey, label: opLabel, treatments: [] });
        }
        dayEntry.operators.get(opKey)!.treatments.push(t);
      }

      // Ordina i giorni in modo decrescente (piu' recenti in alto), operatori A→Z.
      return Array.from(dayMap.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, entry]) => {
          const children = Array.from(entry.operators.values())
            .sort((a, b) => a.label.localeCompare(b.label));
          return {
            key,
            label: entry.label,
            children,
            treatments: children.flatMap(c => c.treatments),
          };
        });
    }

    return [];
  }

  /** Etichetta gruppo-giorno: "Mercoledì 17 giu 2026". */
  private formatDayGroupLabel(day: string): string {
    if (!day) return 'Senza data';
    const d = new Date(day + 'T00:00:00');
    if (isNaN(d.getTime())) return day;
    const s = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private extractError(err: any): string {
    if (err?.graphQLErrors?.length > 0) {
      return err.graphQLErrors.map((e: any) => e.message).join(', ');
    }
    if (err?.networkError?.error?.errors) {
      return err.networkError.error.errors.map((e: any) => e.message).join(', ');
    }
    return err?.message || 'Errore sconosciuto';
  }
}

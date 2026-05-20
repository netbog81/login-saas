import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, combineLatest } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

import { TrattamentiService } from '../services/trattamenti.service';
import { TrattamentiStateService } from '../services/trattamenti-state.service';
import {
  Trattamento,
  TrattamentiFilters,
  TrattamentiViewMode,
  TreatmentStatus,
  TreatmentBillingStatus,
  PaymentMethod,
} from '../models/trattamento.model';

import { TrattamentiFiltersComponent } from '../components/trattamenti-filters/trattamenti-filters.component';
import { TrattamentiListComponent, TrattamentoGroup } from '../components/trattamenti-list/trattamenti-list.component';
import {
  TrattamentoDetailComponent,
  DetailDialogData,
  DetailUpdateServiceDescriptionPayload,
  DetailEditInvoiceLinePayload,
  DetailUpdateEconomicsPayload,
  DetailRecordPaymentPayload,
} from '../components/trattamento-detail/trattamento-detail.component';

import { OperatorService } from '../../../services/operator.service';
import { AuthService } from '../../../core/auth/auth.service';

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
              <button mat-stroked-button (click)="markSelectedReady(true)"
                matTooltip="Chiudi (se non chiusi) e marca come pronti per fatturazione">
                <mat-icon>playlist_add_check</mat-icon>
                Chiudi / marca pronti
              </button>
              <button mat-stroked-button (click)="markSelectedReady(false)"
                matTooltip="Rimuovi il flag 'pronto per fatturazione'">
                <mat-icon>undo</mat-icon>
                Togli pronti
              </button>
              @if (canSendSelection(sel)) {
                <button mat-flat-button color="accent" (click)="sendSelection()"
                  matTooltip="Invia tutti i selezionati al sistema di fatturazione">
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
        (operatorIdChange)="state.setFilters({ operatorId: $event })"
        (patientIdChange)="state.setFilters({ patientId: $event })"
        (readyForBillingChange)="state.setFilters({ readyForBilling: $event })"
        (isInvoicedChange)="state.setFilters({ isInvoicedToPatient: $event })"
        (scontoFEChange)="state.setFilters({ scontoFE: $event })"
        (viewModeChange)="state.setViewMode($event)"
        (reset)="state.resetFilters()">
      </app-trattamenti-filters>

      <app-trattamenti-list
        [treatments]="flatTreatments"
        [groups]="groupedTreatments"
        [viewMode]="(state.viewMode$ | async) || 'flat'"
        [canSelect]="isSecretary"
        [selectedIds]="(state.selectedIds$ | async) || emptySet"
        (toggleSelection)="state.toggleSelection($event)"
        (selectAllToggle)="onSelectAllToggle($event)"
        (openDetail)="openDetail($event)"
        (sendOne)="sendOne($event)">
      </app-trattamenti-list>
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

  @Output() closed = new EventEmitter<void>();

  isSecretary = false;
  currentOperatorId: string | null = null;
  currentUserId: string | null = null;

  operatorOptions: { id: string; label: string }[] = [];
  patientOptions: { id: string; label: string }[] = [];

  flatTreatments: Trattamento[] = [];
  groupedTreatments: TrattamentoGroup[] = [];

  emptySet = new Set<string>();

  private destroy$ = new Subject<void>();

  constructor(
    public state: TrattamentiStateService,
    private service: TrattamentiService,
    private operatorService: OperatorService,
    private auth: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.isSecretary = this.auth.hasRole(SECRETARY_ROLES);
    const user = this.auth.currentUser();
    this.currentUserId = (user as any)?.id || (user as any)?.userId || null;

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
        },
        error: () => {
          this.loadOperatorsOptions();
          this.subscribeToReload();
        },
      });
    } else {
      this.loadOperatorsOptions();
      this.subscribeToReload();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Ogni volta che cambiano i filtri, ricarica. Debounce 200ms per evitare
   * chiamate multiple quando l'utente tocca rapidamente più filtri.
   */
  private subscribeToReload(): void {
    this.state.filters$
      .pipe(debounceTime(200), takeUntil(this.destroy$))
      .subscribe(() => this.reload());

    // Trasforma i treatments in flat + groups ogni volta che cambiano.
    // Include `state.filters$` per applicare i filtri client-only (es.
    // billingStatuses, vedi Step 6.4 sessione 6) prima del rendering.
    combineLatest([this.state.treatments$, this.state.viewMode$, this.state.filters$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([treatments, mode, filters]) => {
        const filtered = this.applyClientFilters(treatments, filters);
        this.flatTreatments = filtered;
        this.groupedTreatments = this.buildGroups(filtered, mode);
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
      ? this.service.getForSecretary(filters)
      : this.service.getForOperator(filters.operatorId || this.currentOperatorId || '', filters);

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
    const map = new Map<string, string>();
    for (const t of treatments) {
      if (t.patient) {
        map.set(t.patient.id, `${t.patient.nome} ${t.patient.cognome}`.trim());
      }
    }
    this.patientOptions = Array.from(map.entries()).map(([id, label]) => ({ id, label }));
    this.patientOptions.sort((a, b) => a.label.localeCompare(b.label));
  }

  // ==================== FILTRI ====================

  onStatuses(statuses: TreatmentStatus[]): void {
    this.state.setFilters({ statuses });
  }

  onSelectAllToggle(checked: boolean): void {
    if (checked) this.state.selectAll();
    else this.state.clearSelection();
  }

  // ==================== BATCH ACTIONS ====================

  markSelectedReady(ready: boolean): void {
    const ids = Array.from(this.state.selectedIds);
    if (ids.length === 0) return;
    this.service.setReadyForBilling(ids, ready).subscribe({
      next: () => {
        // Ricarica dal server: `setReadyForBilling` può anche aver
        // transizionato lo stato (da OPERATOR_COMPLETED a CLOSED), e la
        // query iniziale include tutti i campi che ci servono. Più semplice
        // e robusto di un merge puntuale.
        this.reload();
        this.state.clearSelection();
        this.snackBar.open(
          ready ? 'Trattamenti marcati come pronti' : 'Flag "pronto" rimosso',
          'OK',
          { duration: 2500 },
        );
      },
      error: (err) => {
        this.snackBar.open(this.extractError(err), 'OK', { duration: 5000 });
      },
    });
  }

  // ==================== INVIO A FATTURAZIONE ====================

  /** Restituisce true se TUTTI i trattamenti selezionati sono in stato
   * "inviabile" al sistema di fatturazione.
   *
   * Vincoli:
   * - readyForBilling=true (operatore ha cliccato "Pronto per fatturazione")
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
      t.readyForBilling === true
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

  // ==================== DETAIL DIALOG ====================

  openDetail(treatment: Trattamento): void {
    // In modalità readOnly (dashboard operatore) tutte le azioni
    // amministrative/economiche sono disabilitate: l'operatore può
    // consultare il dettaglio del proprio trattamento ma non può
    // chiudere/riaprire/segnare pronto/registrare pagamento. Il backend
    // resta la fonte di verità (guard sui mutation).
    const editEconomicsAllowed = this.isSecretary && !this.readOnlyMode;
    const recordPaymentAllowed =
      !this.readOnlyMode && this.canRecordPayment(treatment);
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

    inst.updateEconomics.subscribe((p: DetailUpdateEconomicsPayload) => {
      this.service.updateBySecretary({
        id: treatment.id,
        ...p,
      }).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          this.snackBar.open('Modifiche salvate', 'OK', { duration: 2000 });
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    inst.recordPayment.subscribe((p: DetailRecordPaymentPayload) => {
      this.service.recordPayment(
        treatment.id,
        p.paymentMethod,
        p.collectedBy,
        p.amount,
        this.isSecretary ? 'SECRETARY' : 'OPERATOR',
      ).subscribe({
        next: (updated) => {
          this.state.updateTreatment(updated);
          ref.componentInstance.treatment = updated;
          this.snackBar.open('Pagamento registrato', 'OK', { duration: 2000 });
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    inst.toggleReadyForBilling.subscribe((ready: boolean) => {
      this.service.setReadyForBilling([treatment.id], ready).subscribe({
        next: () => {
          // Sessione 6: setReadyForBilling+ready=true triggera publish
          // treatment.closed → billingStatus passa a SENT (sync) e poi
          // PENDING (async dopo billable.received). Refetch completo
          // garantisce che il dialog mostri lo stato accounting reale,
          // non solo readyForBilling boolean. NB: billingStatus PENDING
          // arriva di solito ~1s dopo, l'utente vedrà SENT poi un
          // refresh successivo mostrerà PENDING.
          this.refreshSingleTreatment(treatment.id, ref);
          if (ready) {
            this.snackBar.open(
              'Trattamento inviato al sistema di fatturazione',
              'OK',
              { duration: 3000 },
            );
          }
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
    // Cabla i 3 flag disabled basandosi su billingStatus + handler 4 events.
    // Helper: ricalcola i flag per il treatment correntemente nel dialog.
    const applyBillingFlagsToInst = (t: Trattamento): void => {
      const flags = this.computeBillingFlags(t);
      ref.componentInstance.billingCancelDisabled = flags.cancelDisabled;
      ref.componentInstance.billingCancelDisabledReason = flags.cancelDisabledReason;
      ref.componentInstance.billingReopenDisabled = flags.reopenDisabled;
      ref.componentInstance.billingReopenDisabledReason = flags.reopenDisabledReason;
      ref.componentInstance.billingImmediateInvoiceDisabled = flags.immediateInvoiceDisabled;
      ref.componentInstance.billingImmediateInvoiceDisabledReason = flags.immediateInvoiceDisabledReason;
    };
    // Inizializza i flag con il treatment iniziale.
    applyBillingFlagsToInst(treatment);

    // Cancel: dialog conferma con reason obbligatoria.
    inst.cancelTreatmentBilling.subscribe((id: string) => {
      const reason = window.prompt(
        'Annullare il trattamento? Inserisci un motivo (obbligatorio):',
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
          this.snackBar.open('Trattamento annullato', 'OK', { duration: 2500 });
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
      });
    });

    // Reopen: usa la mutation esistente reopen del service.
    inst.reopenTreatmentBilling.subscribe((id: string) => {
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

    // Fattura subito + incassa: setReadyForBilling con flag immediate.
    // Disponibile solo per NOT_READY (closes + publishes con
    // requestImmediateInvoice=true → accounting AutoIssue).
    inst.immediateInvoiceBilling.subscribe((id: string) => {
      this.service.setReadyForBillingImmediate(id).subscribe({
        next: () => {
          // Ricarico il singolo treatment per avere lo stato aggiornato
          // (billingStatus → SENT, eventualmente PENDING/INVOICED al
          // round-trip successivo).
          this.reload();
          this.snackBar.open(
            'Inviato ad accounting per fatturazione immediata',
            'OK',
            { duration: 2500 },
          );
        },
        error: (e) => this.snackBar.open(this.extractError(e), 'OK', { duration: 5000 }),
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

    // Dopo la chiusura del dialog, garantiamo che la lista sia sincronizzata:
    // l'utente potrebbe aver chiuso senza applicare tutte le nostre
    // ottimizzazioni ottimistiche (es. mutation pending).
    ref.afterClosed().subscribe(() => {
      this.reload();
    });
  }

  /**
   * Calcola i 3 flag disabled per i bottoni della BillingSection in base
   * a `treatment.billingStatus` (spec §10).
   *
   * - Annulla disponibile per: NOT_READY, READY_FOR_BILLING, SENT, PENDING
   * - Riapri disponibile per: NOT_READY, READY_FOR_BILLING, SENT, PENDING
   *   (stessa lista — riapertura post-INVOICED richiede storno fiscale)
   * - Fattura subito + incassa disponibile SOLO per: NOT_READY
   *   (chiude+pubblica in un unico passo con requestImmediateInvoice=true)
   *
   * USA L'ENUM `TreatmentBillingStatus`, niente stringhe hardcoded.
   */
  private computeBillingFlags(treatment: Trattamento): {
    cancelDisabled: boolean;
    cancelDisabledReason: string | null;
    reopenDisabled: boolean;
    reopenDisabledReason: string | null;
    immediateInvoiceDisabled: boolean;
    immediateInvoiceDisabledReason: string | null;
  } {
    const status = treatment.billingStatus;

    const cancelOrReopenBlocked: ReadonlyArray<TreatmentBillingStatus> = [
      TreatmentBillingStatus.Invoiced,
      TreatmentBillingStatus.PartiallyRefunded,
      TreatmentBillingStatus.Refunded,
      TreatmentBillingStatus.Reissued,
      TreatmentBillingStatus.Cancelled,
    ];
    const isCancelOrReopenBlocked =
      status != null && cancelOrReopenBlocked.includes(status);

    const cancelDisabled = isCancelOrReopenBlocked;
    const cancelDisabledReason = cancelDisabled
      ? 'Non disponibile per trattamenti già fatturati. Storno richiede nota credito da accounting.'
      : null;

    const reopenDisabled = isCancelOrReopenBlocked;
    const reopenDisabledReason = reopenDisabled
      ? 'Non disponibile per trattamenti già fatturati. Storno richiede nota credito da accounting.'
      : null;

    // Fattura subito + incassa: unica condizione abilitante.
    const immediateInvoiceDisabled = status !== TreatmentBillingStatus.NotReady;
    const immediateInvoiceDisabledReason = immediateInvoiceDisabled
      ? "Disponibile solo per trattamenti non ancora pronti per fatturazione. Per inviare ora, abilita 'Pronto per fatturazione'."
      : null;

    return {
      cancelDisabled,
      cancelDisabledReason,
      reopenDisabled,
      reopenDisabledReason,
      immediateInvoiceDisabled,
      immediateInvoiceDisabledReason,
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
    if (this.isSecretary) return true;
    if (t.status === TreatmentStatus.CLOSED) return false;
    return t.operator?.canCollectPayment === true;
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
        const opKey = t.operator.id;
        const opLabel = `${t.operator.name} ${t.operator.surname || ''}`.trim();
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

    return [];
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

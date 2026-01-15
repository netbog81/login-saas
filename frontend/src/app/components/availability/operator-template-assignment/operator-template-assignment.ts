import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperatorService } from '../../../services/operator.service';
import { TemplateService } from '../../../services/template.service';
import { Operator, OperatorMacroCategory } from '../../../graphql/generated/types';
import { TemplateAssignment, PatternGroup, getMacroCategoryLabel } from '../../../graphql/types';
import { catchError, finalize, forkJoin, of, Subject, switchMap, takeUntil } from 'rxjs';

interface OperatorWithAssignment {
  operator: Operator;
  assignment: TemplateAssignment | null;
  status: 'active' | 'expiring' | 'none';
  validFrom?: string;
  validUntil?: string;
  daysUntilExpiration?: number;
  patternGroupName?: string;
}

@Component({
  selector: 'app-operator-template-assignment',
  imports: [CommonModule, FormsModule],
  templateUrl: './operator-template-assignment.html',
  styleUrl: './operator-template-assignment.scss',
})
export class OperatorTemplateAssignment implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  operators: OperatorWithAssignment[] = [];
  filteredOperators: OperatorWithAssignment[] = [];
  patternGroups: PatternGroup[] = [];

  loading = false;
  error: string | null = null;

  searchTerm = '';
  selectedOperator: OperatorWithAssignment | null = null;

  showAssignModal = false;
  currentOperator: OperatorWithAssignment | null = null;
  selectedPatternGroupId: string = '';
  assignPatternStartDate: string = '';
  assignValidFrom: string = '';
  assignValidUntil: string = '';

  // Overlay click tracking (per evitare chiusura durante click-and-drag)
  overlayMouseDownTarget: EventTarget | null = null;

  constructor(
    private operatorService: OperatorService,
    private templateService: TemplateService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    console.log('OperatorTemplateAssignment component initialized');
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
      assignments: this.templateService.getTemplateAssignments(undefined, true), // Get all current assignments
    })
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          console.error('Errore nel caricamento dei dati:', err);
          this.error = 'Errore nel caricamento dei dati: ' + err.message;
          return of({ operators: [], patternGroups: [], assignments: [] });
        }),
        finalize(() => (this.loading = false))
      )
      .subscribe((data) => {
        console.log('Data loaded:', data);
        this.patternGroups = data.patternGroups;
        this.buildOperatorList(data.operators, data.assignments);
        this.applyFilters();
        console.log('Operators:', this.operators.length, 'Filtered:', this.filteredOperators.length);
      });
  }

  private buildOperatorList(
    operators: Operator[],
    assignments: TemplateAssignment[]
  ) {
    this.operators = operators.map((operator) => {
      // Find current assignment for this operator
      const assignment = assignments.find(
        (a) => a.operatorId === operator.id && a.isCurrent
      ) || null;

      let status: 'active' | 'expiring' | 'none' = 'none';
      let validFrom: string | undefined;
      let validUntil: string | undefined;
      let daysUntilExpiration: number | undefined;
      let patternGroupName: string | undefined;

      if (assignment) {
        const fromDate = assignment.validFrom instanceof Date
          ? assignment.validFrom
          : new Date(assignment.validFrom);
        validFrom = fromDate.toISOString().split('T')[0];

        if (assignment.validUntil) {
          const untilDate = assignment.validUntil instanceof Date
            ? assignment.validUntil
            : new Date(assignment.validUntil);
          validUntil = untilDate.toISOString().split('T')[0];
        }

        patternGroupName = assignment.patternGroup?.name;

        // Calculate status
        const now = new Date();

        if (assignment.validUntil) {
          const untilDate = assignment.validUntil instanceof Date
            ? assignment.validUntil
            : new Date(assignment.validUntil);
          const diffTime = untilDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          daysUntilExpiration = diffDays;

          if (diffDays <= 0) {
            status = 'none'; // Expired
          } else if (diffDays <= 15) {
            status = 'expiring'; // Expiring soon
          } else {
            status = 'active'; // Active
          }
        } else {
          // No end date, check if started
          const startDate = assignment.validFrom instanceof Date
            ? assignment.validFrom
            : new Date(assignment.validFrom);
          if (now >= startDate) {
            status = 'active';
          } else {
            status = 'none'; // Not yet started
          }
        }
      }

      return {
        operator,
        assignment,
        status,
        validFrom,
        validUntil,
        daysUntilExpiration,
        patternGroupName,
      };
    });

    // Sort: active first, then expiring, then none
    this.operators.sort((a, b) => {
      const statusOrder = { active: 0, expiring: 1, none: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
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

  selectOperator(operator: OperatorWithAssignment) {
    this.ngZone.run(() => {
      this.selectedOperator =
        this.selectedOperator === operator ? null : operator;
    });
  }

  openAssignModal(operator: OperatorWithAssignment) {
    this.ngZone.run(() => {
      this.currentOperator = operator;
      this.selectedPatternGroupId = operator.assignment?.patternGroupId || '';
      this.assignPatternStartDate = this.getTodayString();
      this.assignValidFrom = operator.validFrom || this.getTodayString();
      this.assignValidUntil = operator.validUntil || '';
      this.showAssignModal = true;
    });
  }

  private getTodayString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  onAssignSave() {
    if (!this.currentOperator || !this.selectedPatternGroupId) {
      alert('Seleziona un pattern group');
      return;
    }

    if (!this.assignValidFrom) {
      alert('Inserisci la data di inizio validità');
      return;
    }

    if (!this.assignPatternStartDate) {
      alert('Inserisci la data di inizio del pattern');
      return;
    }

    this.loading = true;
    this.error = null;

    // If there's an existing assignment, deactivate it first, then create new assignment
    const deactivateObs$ = this.currentOperator.assignment
      ? this.templateService.deactivateTemplateAssignment(this.currentOperator.assignment.id).pipe(
          catchError((err) => {
            console.error('Errore nella disattivazione:', err);
            return of(null);
          })
        )
      : of(null);

    deactivateObs$
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() =>
          this.templateService.assignTemplateToOperator({
            operatorId: this.currentOperator!.operator.id,
            patternGroupId: this.selectedPatternGroupId,
            patternStartDate: this.assignPatternStartDate,
            validFrom: this.assignValidFrom,
            validUntil: this.assignValidUntil || undefined,
          }).pipe(
            catchError((err) => {
              this.error = "Errore nell'assegnazione: " + err.message;
              return of(null);
            })
          )
        ),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((assignment) => {
        if (assignment) {
          this.showAssignModal = false;
          this.currentOperator = null;
          this.loadData(); // Reload to show updated assignments
        }
      });
  }

  onAssignCancel() {
    this.ngZone.run(() => {
      this.showAssignModal = false;
      this.currentOperator = null;
      this.selectedPatternGroupId = '';
    });
  }

  removeAssignment(operator: OperatorWithAssignment) {
    this.ngZone.run(() => {
      if (
        !confirm(
          `Vuoi rimuovere l'assegnazione del template da ${operator.operator.name}?`
        )
      ) {
        return;
      }

      if (!operator.assignment) {
        return;
      }

      this.loading = true;
      this.error = null;

      this.templateService
        .deactivateTemplateAssignment(operator.assignment.id)
        .pipe(
          takeUntil(this.destroy$),
          catchError((err) => {
            this.error = 'Errore nella rimozione: ' + err.message;
            return of(null);
          }),
          finalize(() => {
            this.loading = false;
          })
        )
        .subscribe((result) => {
          if (result) {
            this.ngZone.run(() => this.loadData());
          }
        });
    });
  }

  getStatusIcon(status: 'active' | 'expiring' | 'none'): string {
    switch (status) {
      case 'active':
        return '✅';
      case 'expiring':
        return '⚠️';
      case 'none':
        return '❌';
    }
  }

  getStatusLabel(status: 'active' | 'expiring' | 'none'): string {
    switch (status) {
      case 'active':
        return 'Attivo';
      case 'expiring':
        return 'In Scadenza';
      case 'none':
        return 'Nessuno';
    }
  }

  getStatusClass(status: 'active' | 'expiring' | 'none'): string {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'expiring':
        return 'status-expiring';
      case 'none':
        return 'status-none';
    }
  }

  getValidityLabel(operator: OperatorWithAssignment): string {
    if (!operator.validFrom) return 'N/A';

    const from = new Date(operator.validFrom).toLocaleDateString('it-IT');
    const until = operator.validUntil
      ? new Date(operator.validUntil).toLocaleDateString('it-IT')
      : 'Indefinito';

    return `${from} - ${until}`;
  }

  getExpirationWarning(operator: OperatorWithAssignment): string | null {
    if (operator.status === 'expiring' && operator.daysUntilExpiration) {
      return `Scade tra ${operator.daysUntilExpiration} giorn${
        operator.daysUntilExpiration > 1 ? 'i' : 'o'
      }`;
    }
    return null;
  }

  trackByOperatorId(index: number, item: OperatorWithAssignment): string {
    return item.operator.id;
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

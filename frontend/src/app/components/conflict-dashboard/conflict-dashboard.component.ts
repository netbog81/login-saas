import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { ConflictService, ConflictFilters } from '../../services/conflict.service';
import { OperatorService } from '../../services/operator.service';
import {
  AvailabilityAppointment,
  ConflictStatsOutput,
  ConflictReason,
  ConflictResolutionAction,
  Operator,
} from '../../graphql/generated/types';

@Component({
  selector: 'app-conflict-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './conflict-dashboard.component.html',
  styleUrls: ['./conflict-dashboard.component.scss'],
})
export class ConflictDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  conflicts: AvailabilityAppointment[] = [];
  stats: ConflictStatsOutput | null = null;
  operators: Operator[] = [];

  // Filters
  filters: ConflictFilters = {};
  selectedOperatorId: string = '';
  dateFrom: string = '';
  dateTo: string = '';
  selectedReason: ConflictReason | '' = '';

  // UI State
  loading = false;
  error: string | null = null;
  selectedConflicts: Set<string> = new Set();
  showResolveDialog = false;
  conflictToResolve: AvailabilityAppointment | null = null;

  // Reschedule data
  newDate: string = '';
  newStartTime: string = '';
  newEndTime: string = '';
  resolutionNotes: string = '';

  // Enums for template
  ConflictReason = ConflictReason;
  ConflictResolutionAction = ConflictResolutionAction;

  constructor(
    private conflictService: ConflictService,
    private operatorService: OperatorService
  ) {}

  ngOnInit(): void {
    this.loadOperators();
    this.loadConflicts();
    this.loadStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOperators(): void {
    this.operatorService
      .getOperators(undefined, undefined, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (operators) => {
          this.operators = operators;
        },
        error: (err) => {
          console.error('Error loading operators:', err);
        },
      });
  }

  loadConflicts(): void {
    this.loading = true;
    this.error = null;

    const filters: ConflictFilters = {};
    if (this.selectedOperatorId) {
      filters.operatorId = this.selectedOperatorId;
    }
    if (this.dateFrom) {
      filters.dateFrom = this.dateFrom;
    }
    if (this.dateTo) {
      filters.dateTo = this.dateTo;
    }
    if (this.selectedReason) {
      filters.conflictReason = this.selectedReason as ConflictReason;
    }

    this.conflictService
      .getConflictedAppointments(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (conflicts) => {
          this.conflicts = conflicts;
          this.loading = false;
          this.selectedConflicts.clear();
        },
        error: (err) => {
          this.error = 'Errore nel caricamento dei conflitti';
          this.loading = false;
          console.error('Error loading conflicts:', err);
        },
      });
  }

  loadStats(): void {
    this.conflictService
      .getConflictStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
        },
        error: (err) => {
          console.error('Error loading stats:', err);
        },
      });
  }

  applyFilters(): void {
    this.loadConflicts();
  }

  clearFilters(): void {
    this.selectedOperatorId = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.selectedReason = '';
    this.loadConflicts();
  }

  toggleConflictSelection(conflictId: string): void {
    if (this.selectedConflicts.has(conflictId)) {
      this.selectedConflicts.delete(conflictId);
    } else {
      this.selectedConflicts.add(conflictId);
    }
  }

  toggleSelectAll(): void {
    if (this.selectedConflicts.size === this.conflicts.length) {
      this.selectedConflicts.clear();
    } else {
      this.conflicts.forEach((c) => this.selectedConflicts.add(c.id));
    }
  }

  isSelected(conflictId: string): boolean {
    return this.selectedConflicts.has(conflictId);
  }

  // Single conflict resolution
  openResolveDialog(conflict: AvailabilityAppointment): void {
    this.conflictToResolve = conflict;
    this.showResolveDialog = true;
    this.newDate = this.formatDateForInput(conflict.appointmentDate);
    this.newStartTime = conflict.startTime;
    this.newEndTime = conflict.endTime;
    this.resolutionNotes = '';
  }

  closeResolveDialog(): void {
    this.showResolveDialog = false;
    this.conflictToResolve = null;
    this.newDate = '';
    this.newStartTime = '';
    this.newEndTime = '';
    this.resolutionNotes = '';
  }

  resolveConflict(action: ConflictResolutionAction): void {
    if (!this.conflictToResolve) return;

    this.loading = true;
    const options: any = {
      notes: this.resolutionNotes || undefined,
    };

    if (action === ConflictResolutionAction.Reschedule) {
      options.newDate = this.newDate;
      options.newStartTime = this.newStartTime;
      options.newEndTime = this.newEndTime;
    }

    this.conflictService
      .resolveConflict(
        this.conflictToResolve.id,
        action,
        'current-user-id', // TODO: Get from auth service
        options
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeResolveDialog();
          this.loadConflicts();
          this.loadStats();
        },
        error: (err) => {
          this.error = 'Errore nella risoluzione del conflitto';
          this.loading = false;
          console.error('Error resolving conflict:', err);
        },
      });
  }

  // Batch resolution
  resolveSelectedConflicts(action: ConflictResolutionAction.Keep | ConflictResolutionAction.Cancel): void {
    if (this.selectedConflicts.size === 0) return;

    this.loading = true;
    const appointmentIds = Array.from(this.selectedConflicts);

    this.conflictService
      .resolveMultipleConflicts(
        appointmentIds,
        action,
        'current-user-id' // TODO: Get from auth service
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.selectedConflicts.clear();
          this.loadConflicts();
          this.loadStats();
        },
        error: (err) => {
          this.error = 'Errore nella risoluzione dei conflitti';
          this.loading = false;
          console.error('Error resolving conflicts:', err);
        },
      });
  }

  // Helpers
  getConflictReasonLabel(reason: ConflictReason | null | undefined): string {
    if (!reason) return '-';
    const labels: Record<ConflictReason, string> = {
      [ConflictReason.TemplateChange]: 'Cambio Template',
      [ConflictReason.OperatorSick]: 'Malattia Operatore',
      [ConflictReason.OperatorVacation]: 'Ferie Operatore',
      [ConflictReason.OperatorUnavailable]: 'Operatore Non Disponibile',
    };
    return labels[reason] || reason;
  }

  formatDate(date: any): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  formatDateForInput(date: any): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  getOperatorName(conflict: AvailabilityAppointment): string {
    if (conflict.operator) {
      return `${conflict.operator.name} ${conflict.operator.surname || ''}`.trim();
    }
    return '-';
  }

  getOperatorColor(conflict: AvailabilityAppointment): string {
    return conflict.operator?.color || '#007bff';
  }

  getStatByReason(reason: string): number {
    if (!this.stats?.byReason) return 0;
    return (this.stats.byReason as any)[reason] || 0;
  }

  refreshData(): void {
    this.loadConflicts();
    this.loadStats();
  }
}

import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TemplateBuilder } from '../template-builder/template-builder';
import { TemplateService } from '../../../services/template.service';
import { AvailabilityTemplate } from '../../../graphql/generated/types';
import { PatternGroup, TemplateAssignment, TemplatePattern } from '../../../graphql/types';
import { catchError, finalize, forkJoin, of, Subject, takeUntil } from 'rxjs';

interface TemplateGroup {
  name: string;
  templates: Partial<AvailabilityTemplate>[];
  pattern: TemplatePattern | null;
  operatorCount: number;
  patternGroupId: string; // ID of the pattern group for updates
  slotCount: number; // numero fasce orarie: 0 = gruppo orfano da sistemare
  isActive: boolean;
}

type StatusFilter = 'active' | 'inactive' | 'all';

@Component({
  selector: 'app-template-management',
  imports: [CommonModule, FormsModule, TemplateBuilder],
  templateUrl: './template-management.html',
  styleUrl: './template-management.scss',
})
export class TemplateManagement implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  templateGroups: TemplateGroup[] = [];
  filteredGroups: TemplateGroup[] = [];

  loading = false;
  error: string | null = null;

  searchTerm = '';
  statusFilter: StatusFilter = 'active';
  selectedGroup: TemplateGroup | null = null;

  showBuilderModal = false;
  currentPattern: TemplatePattern | null = null;
  isEditMode = false;
  editingGroup: TemplateGroup | null = null;

  // Overlay click tracking (per evitare chiusura durante click-and-drag)
  overlayMouseDownTarget: EventTarget | null = null;

  constructor(
    private templateService: TemplateService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.loadTemplates();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTemplates() {
    this.loading = true;
    this.error = null;

    // Le assegnazioni correnti servono per il conteggio operatori per gruppo
    // (gate di modifica/eliminazione, allineato al blocco lato backend).
    forkJoin({
      groups: this.templateService.getAllPatternGroups(),
      assignments: this.templateService.getTemplateAssignments(undefined, true),
    })
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          this.error = 'Errore nel caricamento dei template: ' + err.message;
          return of({ groups: [] as PatternGroup[], assignments: [] as TemplateAssignment[] });
        }),
        finalize(() => (this.loading = false))
      )
      .subscribe(({ groups, assignments }) => {
        this.buildTemplateGroups(groups, assignments);
        this.applyFilters();
      });
  }

  private buildTemplateGroups(
    groups: PatternGroup[],
    assignments: TemplateAssignment[]
  ) {
    // Una card per pattern group, INCLUSI i gruppi senza fasce orarie: se
    // venissero nascosti resterebbero orfani non modificabili né eliminabili
    // (ma comunque presenti a DB).
    this.templateGroups = groups.map((group) => {
      const templates = this.templateService.convertGroupToTemplates(group);

      // Con la timeline di assegnazioni isCurrent significa "non revocata":
      // per il conteggio contano solo quelle in corso o future (non scadute).
      const today = new Date().toISOString().split('T')[0];
      const operatorIds = new Set(
        assignments
          .filter(
            (a) =>
              a.patternGroupId === group.id &&
              a.isCurrent &&
              (!a.validUntil ||
                String(a.validUntil).slice(0, 10) >= today)
          )
          .map((a) => a.operatorId)
      );

      return {
        name: group.name || 'Senza Nome',
        templates,
        pattern: this.templateService.convertGroupToUiPattern(group),
        operatorCount: operatorIds.size,
        patternGroupId: group.id,
        slotCount: group.patterns?.length || 0,
        isActive: group.isActive,
      };
    });

    // Sort by name
    this.templateGroups.sort((a, b) => a.name.localeCompare(b.name));
  }

  applyFilters() {
    let groups = this.templateGroups;

    if (this.statusFilter === 'active') {
      groups = groups.filter((g) => g.isActive);
    } else if (this.statusFilter === 'inactive') {
      groups = groups.filter((g) => !g.isActive);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      groups = groups.filter((group) =>
        group.name.toLowerCase().includes(term)
      );
    }

    this.filteredGroups = [...groups];
  }

  onSearchChange() {
    this.applyFilters();
  }

  setStatusFilter(filter: StatusFilter) {
    this.ngZone.run(() => {
      this.statusFilter = filter;
      this.applyFilters();
    });
  }

  selectGroup(group: TemplateGroup) {
    this.ngZone.run(() => {
      this.selectedGroup = this.selectedGroup === group ? null : group;
    });
  }

  openCreateModal() {
    this.ngZone.run(() => {
      this.currentPattern = null;
      this.isEditMode = false;
      this.showBuilderModal = true;
    });
  }

  openEditModal(group: TemplateGroup) {
    this.ngZone.run(() => {
      if (!group.pattern) {
        alert('Impossibile modificare questo template');
        return;
      }

      // Check if template is used by operators
      if (group.operatorCount > 0) {
        const action = confirm(
          `Questo template è utilizzato da ${group.operatorCount} operatore/i.\n\n` +
            'Vuoi:\n' +
            '- OK: Aggiornare il template esistente (impatterà gli operatori)\n' +
            '- Annulla: Creare una copia con nuovo nome'
        );

        if (action) {
          // Update existing
          this.currentPattern = group.pattern;
          this.isEditMode = true;
          this.editingGroup = group;
          this.showBuilderModal = true;
        } else {
          // Create copy
          this.currentPattern = {
            ...group.pattern,
            id: undefined,
            name: group.name + ' - Copia',
          };
          this.isEditMode = false;
          this.editingGroup = null;
          this.showBuilderModal = true;
        }
      } else {
        // No operators using it, safe to edit
        this.currentPattern = group.pattern;
        this.isEditMode = true;
        this.editingGroup = group;
        this.showBuilderModal = true;
      }
    });
  }

  duplicateTemplate(group: TemplateGroup) {
    this.ngZone.run(() => {
      if (!group.pattern) return;

      this.currentPattern = {
        ...group.pattern,
        id: undefined,
        name: group.name + ' - Copia',
      };
      this.isEditMode = false;
      this.showBuilderModal = true;
    });
  }

  deleteTemplate(group: TemplateGroup) {
    this.ngZone.run(() => {
      if (group.operatorCount > 0) {
        alert(
          `Impossibile eliminare: questo template è utilizzato da ${group.operatorCount} operatore/i.\n` +
            'Rimuovi prima le assegnazioni agli operatori.'
        );
        return;
      }

      if (!confirm(`Sei sicuro di voler eliminare il template "${group.name}"?`)) {
        return;
      }

      this.loading = true;
      this.error = null;

      // Delete diretta per patternGroupId: funziona anche per i gruppi senza
      // fasce orarie (il vecchio percorso risaliva al gruppo da una fascia).
      this.templateService
        .deletePatternGroup(group.patternGroupId)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => (this.loading = false))
        )
        .subscribe({
          next: () => {
            this.ngZone.run(() => this.loadTemplates());
          },
          error: (err) => {
            this.ngZone.run(() => {
              this.error = 'Errore durante l\'eliminazione: ' + err.message;
            });
          }
        });
    });
  }

  toggleActive(group: TemplateGroup) {
    this.ngZone.run(() => {
      const action = group.isActive ? 'disattivare' : 'riattivare';
      if (!confirm(`Vuoi ${action} il template "${group.name}"?`)) {
        return;
      }

      this.loading = true;
      this.error = null;

      this.templateService
        .setPatternGroupActive(group.patternGroupId, !group.isActive)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => (this.loading = false))
        )
        .subscribe({
          next: () => {
            this.ngZone.run(() => this.loadTemplates());
          },
          error: (err) => {
            this.ngZone.run(() => {
              this.error = 'Errore durante l\'aggiornamento: ' + err.message;
            });
          }
        });
    });
  }

  onBuilderSave(pattern: TemplatePattern) {
    // Validate template name
    this.templateService
      .checkTemplateName(pattern.name)
      .pipe(takeUntil(this.destroy$))
      .subscribe((exists) => {
        // If template name exists
        if (exists) {
          // In edit mode, allow using the same name if it's the current pattern being edited
          if (this.isEditMode && this.currentPattern && pattern.name === this.currentPattern.name) {
            // Same name as the pattern being edited - OK to save
            this.saveTemplate(pattern);
            return;
          }

          // Different name or create mode - show error
          if (!this.isEditMode) {
            alert('Esiste già un template con questo nome. Scegli un nome diverso.');
            return;
          }
        }

        // Save the template
        this.saveTemplate(pattern);
      });
  }

  private saveTemplate(pattern: TemplatePattern) {
    this.loading = true;
    this.error = null;

    // In edit mode, update the existing pattern group
    if (this.isEditMode && this.editingGroup) {
      const patternGroupId = this.editingGroup.patternGroupId;
      if (!patternGroupId) {
        this.error = 'Errore: ID del pattern group non trovato';
        this.loading = false;
        return;
      }

      this.templateService
        .updatePatternGroupWithInfo(patternGroupId, pattern)
        .pipe(
          takeUntil(this.destroy$),
          catchError((err) => {
            const errorMsg = err?.error?.message || err?.message || 'Errore sconosciuto';
            this.error = 'Errore nell\'aggiornamento: ' + errorMsg;
            this.loading = false;
            return of(null);
          }),
          finalize(() => {
            this.loading = false;
          })
        )
        .subscribe((result) => {
          if (result) {
            // Guardia studi: avvisa se la modifica delle fasce ha eliminato
            // abbinamenti studio/poltrona rimasti senza fascia (orfani).
            if (result.removedRoomOverridesCount > 0) {
              alert(
                `Attenzione: la modifica delle fasce orarie ha rimosso ` +
                `${result.removedRoomOverridesCount} abbinament${result.removedRoomOverridesCount > 1 ? 'i' : 'o'} ` +
                `studio/poltrona che si riferivano a giorni o fasce non più presenti nel template. ` +
                `Controlla le assegnazioni degli operatori che usano questo template.`
              );
            }
            this.showBuilderModal = false;
            this.loadTemplates(); // Reload templates to show updated data
          }
        });
    } else {
      // Create mode - just create the new pattern
      this.createPattern(pattern);
    }
  }

  private createPattern(pattern: TemplatePattern) {
    this.templateService
      .createTemplateFromPattern(pattern)
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          // Extract meaningful error message
          const errorMsg = err?.error?.message || err?.message || 'Errore sconosciuto';
          this.error = 'Errore nel salvataggio: ' + errorMsg;
          this.loading = false;
          this.showBuilderModal = false;
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((templates) => {
        if (templates.length > 0) {
          this.showBuilderModal = false;
          this.currentPattern = null;
          this.editingGroup = null;
          this.loadTemplates();
        }
      });
  }

  onBuilderCancel() {
    this.ngZone.run(() => {
      this.showBuilderModal = false;
      this.currentPattern = null;
      this.isEditMode = false;
      this.editingGroup = null;
    });
  }

  getPatternWeeksLabel(pattern: TemplatePattern | null): string {
    if (!pattern) return '';
    const weeks = pattern.patternWeeks;
    return weeks === 1 ? '1 Settimana' : `${weeks} Settimane`;
  }

  getValidityLabel(pattern: TemplatePattern | null): string {
    if (!pattern) return '';
    const from = new Date(pattern.validFrom!).toLocaleDateString('it-IT');
    const until = pattern.validUntil
      ? new Date(pattern.validUntil).toLocaleDateString('it-IT')
      : 'Indefinito';
    return `${from} - ${until}`;
  }

  getTotalSlots(pattern: TemplatePattern | null): number {
    if (!pattern) return 0;
    return pattern.weeks.reduce(
      (total, week) =>
        total + week.days.reduce((sum, day) => sum + day.slots.length, 0),
      0
    );
  }

  trackByGroupName(index: number, group: TemplateGroup): string {
    return group.patternGroupId || group.name;
  }

  // Overlay click handlers (previene chiusura durante selezione testo con click-and-drag)
  onOverlayMouseDown(event: MouseEvent): void {
    this.overlayMouseDownTarget = event.target;
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.overlayMouseDownTarget === event.currentTarget &&
        event.target === event.currentTarget) {
      this.onBuilderCancel();
    }
    this.overlayMouseDownTarget = null;
  }
}

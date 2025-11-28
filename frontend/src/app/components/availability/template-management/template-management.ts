import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TemplateBuilder } from '../template-builder/template-builder';
import { TemplateService } from '../../../services/template.service';
import { AvailabilityTemplate } from '../../../graphql/generated/types';
import { TemplatePattern } from '../../../graphql/types';
import { catchError, finalize, of } from 'rxjs';

interface TemplateGroup {
  name: string;
  templates: Partial<AvailabilityTemplate>[];
  pattern: TemplatePattern | null;
  operatorCount: number;
  patternGroupId?: string; // ID of the pattern group for updates
}

@Component({
  selector: 'app-template-management',
  imports: [CommonModule, FormsModule, TemplateBuilder],
  templateUrl: './template-management.html',
  styleUrl: './template-management.scss',
})
export class TemplateManagement implements OnInit {
  templateGroups: TemplateGroup[] = [];
  filteredGroups: TemplateGroup[] = [];

  loading = false;
  error: string | null = null;

  searchTerm = '';
  selectedGroup: TemplateGroup | null = null;

  showBuilderModal = false;
  currentPattern: TemplatePattern | null = null;
  isEditMode = false;
  editingGroup: TemplateGroup | null = null;

  constructor(private templateService: TemplateService) {}

  ngOnInit() {
    this.loadTemplates();
  }

  loadTemplates() {
    this.loading = true;
    this.error = null;

    this.templateService
      .getAllTemplates()
      .pipe(
        catchError((err) => {
          this.error = 'Errore nel caricamento dei template: ' + err.message;
          return of([]);
        }),
        finalize(() => (this.loading = false))
      )
      .subscribe((templates) => {
        this.buildTemplateGroups(templates);
        this.applyFilters();
      });
  }

  private buildTemplateGroups(templates: Partial<AvailabilityTemplate>[]) {
    const grouped = this.templateService.groupTemplatesByName(templates);
    this.templateGroups = [];

    grouped.forEach((groupTemplates, name) => {
      // Only show current templates
      const currentTemplates = groupTemplates.filter((t) => t.isCurrent);
      if (currentTemplates.length === 0) return;

      const pattern = this.templateService.convertBackendToPattern(currentTemplates);

      // Count unique operators using this template (exclude empty operatorId for generic patterns)
      const operatorIds = new Set(
        currentTemplates
          .map((t) => t.operatorId)
          .filter((id) => id && id.trim() !== '')
      );

      this.templateGroups.push({
        name,
        templates: currentTemplates,
        pattern,
        operatorCount: operatorIds.size,
        patternGroupId: (currentTemplates[0] as any)?.patternGroupId, // Get pattern group ID for updates
      });
    });

    // Sort by name
    this.templateGroups.sort((a, b) => a.name.localeCompare(b.name));
  }

  applyFilters() {
    if (!this.searchTerm.trim()) {
      this.filteredGroups = [...this.templateGroups];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredGroups = this.templateGroups.filter((group) =>
        group.name.toLowerCase().includes(term)
      );
    }
  }

  onSearchChange() {
    this.applyFilters();
  }

  selectGroup(group: TemplateGroup) {
    this.selectedGroup = this.selectedGroup === group ? null : group;
  }

  openCreateModal() {
    this.currentPattern = null;
    this.isEditMode = false;
    this.showBuilderModal = true;
  }

  openEditModal(group: TemplateGroup) {
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
  }

  duplicateTemplate(group: TemplateGroup) {
    if (!group.pattern) return;

    this.currentPattern = {
      ...group.pattern,
      id: undefined,
      name: group.name + ' - Copia',
    };
    this.isEditMode = false;
    this.showBuilderModal = true;
  }

  deleteTemplate(group: TemplateGroup) {
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

    // Delete all templates in the group
    const deleteObservables = group.templates.map((template) =>
      this.templateService.deleteTemplate(template.id!)
    );

    // Execute all deletions
    Promise.all(deleteObservables.map((obs) => obs.toPromise()))
      .then(() => {
        this.loadTemplates();
      })
      .catch((err) => {
        this.error = 'Errore durante l\'eliminazione: ' + err.message;
        this.loading = false;
      });
  }

  onBuilderSave(pattern: TemplatePattern) {
    // Validate template name
    this.templateService
      .checkTemplateName(pattern.name)
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
        .updatePatternGroup(patternGroupId, pattern)
        .pipe(
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
    this.showBuilderModal = false;
    this.currentPattern = null;
    this.isEditMode = false;
    this.editingGroup = null;
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
    return group.name;
  }
}

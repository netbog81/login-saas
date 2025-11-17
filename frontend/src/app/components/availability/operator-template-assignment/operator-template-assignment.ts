import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperatorService } from '../../../services/operator.service';
import { TemplateService } from '../../../services/template.service';
import { Operator, AvailabilityTemplate, TemplatePattern } from '../../../graphql/types';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';

interface OperatorWithTemplate {
  operator: Operator;
  templates: AvailabilityTemplate[];
  pattern: TemplatePattern | null;
  status: 'active' | 'expiring' | 'none';
  validFrom?: string;
  validUntil?: string;
  daysUntilExpiration?: number;
}

interface TemplateOption {
  name: string;
  templates: AvailabilityTemplate[];
  pattern: TemplatePattern | null;
}

@Component({
  selector: 'app-operator-template-assignment',
  imports: [CommonModule, FormsModule],
  templateUrl: './operator-template-assignment.html',
  styleUrl: './operator-template-assignment.scss',
})
export class OperatorTemplateAssignment implements OnInit {
  operators: OperatorWithTemplate[] = [];
  filteredOperators: OperatorWithTemplate[] = [];
  templateOptions: TemplateOption[] = [];

  loading = false;
  error: string | null = null;

  searchTerm = '';
  selectedOperator: OperatorWithTemplate | null = null;

  showAssignModal = false;
  currentOperator: OperatorWithTemplate | null = null;
  selectedTemplateName: string = '';
  assignValidFrom: string = '';
  assignValidUntil: string = '';

  constructor(
    private operatorService: OperatorService,
    private templateService: TemplateService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.error = null;

    forkJoin({
      operators: this.operatorService.getOperators(),
      templates: this.templateService.getAllTemplates(),
    })
      .pipe(
        catchError((err) => {
          this.error = 'Errore nel caricamento dei dati: ' + err.message;
          return of({ operators: [], templates: [] });
        }),
        finalize(() => (this.loading = false))
      )
      .subscribe((data) => {
        this.buildOperatorList(data.operators, data.templates);
        this.buildTemplateOptions(data.templates);
        this.applyFilters();
      });
  }

  private buildOperatorList(
    operators: Operator[],
    allTemplates: AvailabilityTemplate[]
  ) {
    this.operators = operators.map((operator) => {
      // Find templates for this operator (current ones)
      const operatorTemplates = allTemplates.filter(
        (t) => t.operatorId === operator.id && t.isCurrent
      );

      let pattern: TemplatePattern | null = null;
      let status: 'active' | 'expiring' | 'none' = 'none';
      let validFrom: string | undefined;
      let validUntil: string | undefined;
      let daysUntilExpiration: number | undefined;

      if (operatorTemplates.length > 0) {
        pattern = this.templateService.convertBackendToPattern(operatorTemplates);

        if (pattern) {
          validFrom = pattern.validFrom;
          validUntil = pattern.validUntil;

          // Calculate status
          const now = new Date();
          const fromDate = new Date(pattern.validFrom!);

          if (pattern.validUntil) {
            const untilDate = new Date(pattern.validUntil);
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
            if (now >= fromDate) {
              status = 'active';
            } else {
              status = 'none'; // Not yet started
            }
          }
        }
      }

      return {
        operator,
        templates: operatorTemplates,
        pattern,
        status,
        validFrom,
        validUntil,
        daysUntilExpiration,
      };
    });

    // Sort: active first, then expiring, then none
    this.operators.sort((a, b) => {
      const statusOrder = { active: 0, expiring: 1, none: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }

  private buildTemplateOptions(allTemplates: AvailabilityTemplate[]) {
    const grouped = this.templateService.groupTemplatesByName(allTemplates);
    this.templateOptions = [];

    grouped.forEach((templates, name) => {
      const currentTemplates = templates.filter((t) => t.isCurrent);
      if (currentTemplates.length === 0) return;

      const pattern = this.templateService.convertBackendToPattern(currentTemplates);

      this.templateOptions.push({
        name,
        templates: currentTemplates,
        pattern,
      });
    });

    // Sort by name
    this.templateOptions.sort((a, b) => a.name.localeCompare(b.name));
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

  selectOperator(operator: OperatorWithTemplate) {
    this.selectedOperator =
      this.selectedOperator === operator ? null : operator;
  }

  openAssignModal(operator: OperatorWithTemplate) {
    this.currentOperator = operator;
    this.selectedTemplateName = operator.pattern?.name || '';
    this.assignValidFrom = operator.validFrom || this.getTodayString();
    this.assignValidUntil = operator.validUntil || '';
    this.showAssignModal = true;
  }

  private getTodayString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  onAssignSave() {
    if (!this.currentOperator || !this.selectedTemplateName) {
      alert('Seleziona un template');
      return;
    }

    if (!this.assignValidFrom) {
      alert('Inserisci la data di inizio validità');
      return;
    }

    // Find the selected template
    const templateOption = this.templateOptions.find(
      (t) => t.name === this.selectedTemplateName
    );

    if (!templateOption || !templateOption.pattern) {
      alert('Template non valido');
      return;
    }

    // Update pattern with operator ID and validity dates
    const pattern: TemplatePattern = {
      ...templateOption.pattern,
      operatorId: this.currentOperator.operator.id,
      validFrom: this.assignValidFrom,
      validUntil: this.assignValidUntil || undefined,
    };

    this.loading = true;
    this.error = null;

    this.templateService
      .createTemplateFromPattern(pattern)
      .pipe(
        catchError((err) => {
          this.error = 'Errore nell\'assegnazione: ' + err.message;
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((templates) => {
        if (templates.length > 0) {
          this.showAssignModal = false;
          this.currentOperator = null;
          this.loadData(); // Reload to show updated assignments
        }
      });
  }

  onAssignCancel() {
    this.showAssignModal = false;
    this.currentOperator = null;
    this.selectedTemplateName = '';
  }

  removeAssignment(operator: OperatorWithTemplate) {
    if (
      !confirm(
        `Vuoi rimuovere l'assegnazione del template da ${operator.operator.name}?`
      )
    ) {
      return;
    }

    this.loading = true;
    this.error = null;

    // Delete all templates for this operator
    const deleteObservables = operator.templates.map((template) =>
      this.templateService.deleteTemplate(template.id)
    );

    Promise.all(deleteObservables.map((obs) => obs.toPromise()))
      .then(() => {
        this.loadData();
      })
      .catch((err) => {
        this.error = 'Errore nella rimozione: ' + err.message;
        this.loading = false;
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

  getValidityLabel(operator: OperatorWithTemplate): string {
    if (!operator.validFrom) return 'N/A';

    const from = new Date(operator.validFrom).toLocaleDateString('it-IT');
    const until = operator.validUntil
      ? new Date(operator.validUntil).toLocaleDateString('it-IT')
      : 'Indefinito';

    return `${from} - ${until}`;
  }

  getExpirationWarning(operator: OperatorWithTemplate): string | null {
    if (operator.status === 'expiring' && operator.daysUntilExpiration) {
      return `Scade tra ${operator.daysUntilExpiration} giorn${
        operator.daysUntilExpiration > 1 ? 'i' : 'o'
      }`;
    }
    return null;
  }

  trackByOperatorId(index: number, item: OperatorWithTemplate): string {
    return item.operator.id;
  }
}

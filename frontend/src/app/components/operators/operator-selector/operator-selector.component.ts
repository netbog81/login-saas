import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Operator } from '../../../graphql/generated/types';

@Component({
  selector: 'app-operator-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './operator-selector.component.html',
  styleUrls: ['./operator-selector.component.scss'],
})
export class OperatorSelectorComponent {
  @Input() operators: Operator[] = [];
  @Input() selectedOperator: Operator | null = null;
  @Input() loading = false;
  @Input() disabled = false;

  @Output() operatorChange = new EventEmitter<Operator>();

  onSelectionChange(operatorId: string): void {
    const operator = this.operators.find((op) => op.id === operatorId);
    if (operator) {
      this.operatorChange.emit(operator);
    }
  }

  getOperatorDisplayName(operator: Operator): string {
    if (operator.surname) {
      return `${operator.name} ${operator.surname}`;
    }
    return operator.name;
  }

  getOperatorInitials(operator: Operator): string {
    const name = operator.name || '';
    const surname = operator.surname || '';
    return (name.charAt(0) + surname.charAt(0)).toUpperCase() || '?';
  }
}

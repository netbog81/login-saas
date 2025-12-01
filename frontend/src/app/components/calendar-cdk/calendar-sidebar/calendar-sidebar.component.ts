import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../../models/user.model';
import { OperatorMacroCategory } from '../../../graphql/generated/types';

@Component({
  selector: 'app-calendar-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-sidebar.component.html',
  styleUrls: ['./calendar-sidebar.component.scss']
})
export class CalendarSidebarComponent {
  @Input() allUsers: User[] = [];
  @Input() selectedUsers: User[] = [];
  @Input() collapsed: boolean = false;
  @Input() selectedMacroCategory: OperatorMacroCategory | null = null;

  @Output() userToggle = new EventEmitter<User>();
  @Output() selectAll = new EventEmitter<void>();
  @Output() deselectAll = new EventEmitter<void>();
  @Output() toggleCollapse = new EventEmitter<void>();
  @Output() macroCategoryChange = new EventEmitter<OperatorMacroCategory | null>();

  categories = [
    { value: null, label: 'Tutte le categorie' },
    { value: OperatorMacroCategory.Doctor, label: 'Medici' },
    { value: OperatorMacroCategory.Physiotherapist, label: 'Fisioterapisti' },
    { value: OperatorMacroCategory.GymInstructor, label: 'Istruttori Palestra' }
  ];

  get allSelected(): boolean {
    return this.allUsers.length > 0 && this.selectedUsers.length === this.allUsers.length;
  }

  get someSelected(): boolean {
    return this.selectedUsers.length > 0 && this.selectedUsers.length < this.allUsers.length;
  }

  isUserSelected(user: User): boolean {
    return this.selectedUsers.some(u => u.id === user.id);
  }

  onUserToggle(user: User): void {
    this.userToggle.emit(user);
  }

  onSelectAll(): void {
    if (this.allSelected) {
      this.deselectAll.emit();
    } else {
      this.selectAll.emit();
    }
  }

  onToggleCollapse(): void {
    this.toggleCollapse.emit();
  }

  onCategoryChange(value: string): void {
    const category = value ? value as OperatorMacroCategory : null;
    this.macroCategoryChange.emit(category);
  }

  /**
   * Verifica se un operatore non ha template assegnato.
   * Usa il campo hasTemplate sul modello User.
   */
  hasNoTemplate(user: User): boolean {
    return !user.hasTemplate;
  }
}

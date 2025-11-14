import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../../models/user.model';

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

  @Output() userToggle = new EventEmitter<User>();
  @Output() selectAll = new EventEmitter<void>();
  @Output() deselectAll = new EventEmitter<void>();
  @Output() toggleCollapse = new EventEmitter<void>();

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
}

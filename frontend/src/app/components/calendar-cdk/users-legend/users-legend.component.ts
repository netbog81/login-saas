import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '../../../models/user.model';

@Component({
  selector: 'app-users-legend',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users-legend.component.html',
  styleUrls: ['./users-legend.component.scss']
})
export class UsersLegendComponent {
  @Input() users: User[] = [];
  @Input() selectedUsers: User[] = [];
  @Input() showToggle: boolean = true;
  @Output() userToggle = new EventEmitter<User>();

  isUserSelected(user: User): boolean {
    return this.selectedUsers.some(u => u.id === user.id);
  }

  onUserClick(user: User): void {
    if (this.showToggle) {
      this.userToggle.emit(user);
    }
  }
}
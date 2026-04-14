import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { AppUser, AppUserType, UpdateAppUserInput } from '../../../../../services/app-user.service';

const USER_TYPE_LABELS: Record<AppUserType, string> = {
  OPERATOR: 'Operatore',
  SECRETARY: 'Segreteria',
  PRIVACY_OFFICER: 'Responsabile Privacy',
  IT_MANAGER: 'IT Manager',
};

@Component({
  selector: 'app-users-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
  ],
  template: `
    @if (loading) {
      <div class="loading-row">
        <mat-spinner diameter="32"></mat-spinner>
        <span>Caricamento utenti...</span>
      </div>
    } @else {
      <div class="table-wrapper">
        <table mat-table [dataSource]="users" class="users-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Nome</th>
            <td mat-cell *matCellDef="let u">{{ u.name }} {{ u.surname }}</td>
          </ng-container>

          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef class="hide-mobile">Email</th>
            <td mat-cell *matCellDef="let u" class="hide-mobile">{{ u.email || '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef>Tipo</th>
            <td mat-cell *matCellDef="let u">
              <mat-chip>{{ userTypeLabel(u.userType) }}</mat-chip>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Stato</th>
            <td mat-cell *matCellDef="let u">
              <div class="status-chip" [class.linked]="u.keycloakId" [class.unlinked]="!u.keycloakId">
                <mat-icon>{{ u.keycloakId ? 'link' : 'link_off' }}</mat-icon>
                {{ u.keycloakId ? 'Collegato' : 'Non collegato' }}
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="roles">
            <th mat-header-cell *matHeaderCellDef>Ruoli</th>
            <td mat-cell *matCellDef="let u">
              <div class="role-chips">
                @for (ur of u.userRoles; track ur.role.id) {
                  <mat-chip class="role-chip">{{ ur.role.name }}</mat-chip>
                }
                @if (!u.userRoles?.length) { <span class="no-roles">Nessun ruolo</span> }
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Azioni</th>
            <td mat-cell *matCellDef="let u">
              <div class="actions-row">
                <button mat-icon-button matTooltip="Modifica" (click)="onStartEdit(u)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button matTooltip="Gestione Ruoli" (click)="manageRoles.emit(u)">
                  <mat-icon>manage_accounts</mat-icon>
                </button>
                <button mat-icon-button
                  [matTooltip]="u.isActive ? 'Disattiva' : 'Attiva'"
                  (click)="toggleActive.emit(u)">
                  <mat-icon>{{ u.isActive ? 'person_off' : 'person' }}</mat-icon>
                </button>
                @if (u.keycloakId) {
                  <button mat-icon-button matTooltip="Scollega da Keycloak"
                    (click)="unlink.emit(u)">
                    <mat-icon>link_off</mat-icon>
                  </button>
                }
                <button mat-icon-button matTooltip="Elimina utente" color="warn"
                  (click)="delete.emit(u)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>

              <!-- Pannello inline modifica utente -->
              @if (editingUserId === u.id && editForm) {
                <div class="inline-edit-panel">
                  <mat-divider></mat-divider>
                  <p class="edit-title">Modifica Utente</p>
                  <div class="edit-form-grid">
                    <mat-form-field appearance="outline">
                      <mat-label>Nome</mat-label>
                      <input matInput [(ngModel)]="editForm.name">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Cognome</mat-label>
                      <input matInput [(ngModel)]="editForm.surname">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Email</mat-label>
                      <input matInput [(ngModel)]="editForm.email">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Telefono</mat-label>
                      <input matInput [(ngModel)]="editForm.phone">
                    </mat-form-field>
                  </div>
                  <div class="edit-actions-row">
                    <button mat-raised-button color="primary" (click)="onSaveEdit(u.id)">
                      <mat-icon>save</mat-icon>
                      Salva
                    </button>
                    <button mat-stroked-button (click)="editingUserId = null; editForm = null">
                      Annulla
                    </button>
                  </div>
                </div>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </div>

      @if (!users.length) {
        <p class="empty-state">Nessun utente trovato.</p>
      }
    }
  `,
  styles: [`
    .loading-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      color: rgba(0,0,0,0.6);
    }
    .table-wrapper {
      overflow-x: auto;
    }
    .users-table { width: 100%; }
    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      font-weight: 500;
      &.linked { color: #2e7d32; }
      &.unlinked { color: #c62828; }
    }
    .role-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .role-chip { font-size: 0.8rem; }
    .no-roles { color: rgba(0,0,0,0.4); font-size: 0.85rem; }
    .empty-state { text-align: center; color: rgba(0,0,0,0.4); padding: 24px; }
    @media (max-width: 599px) {
      .hide-mobile { display: none !important; }
      .edit-form-grid { grid-template-columns: 1fr; }
    }
    .delete-btn { color: #c62828; }
    .actions-row { display: flex; align-items: center; flex-wrap: wrap; }
    .inline-edit-panel { padding: 12px 0; }
    .edit-title { font-weight: 500; font-size: 0.9rem; margin: 8px 0; }
    .edit-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      margin: 8px 0;
    }
    .edit-actions-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
  `],
})
export class AppUsersTableComponent {
  @Input() users: AppUser[] = [];
  @Input() loading = false;

  @Output() toggleActive = new EventEmitter<AppUser>();
  @Output() manageRoles = new EventEmitter<AppUser>();
  @Output() delete = new EventEmitter<AppUser>();
  @Output() unlink = new EventEmitter<AppUser>();
  @Output() edit = new EventEmitter<{ id: string; input: UpdateAppUserInput }>();

  // Edit state
  editingUserId: string | null = null;
  editForm: { name: string; surname: string; email: string; phone: string } | null = null;

  displayedColumns = ['name', 'email', 'type', 'status', 'roles', 'actions'];

  userTypeLabel(type: AppUserType): string {
    return USER_TYPE_LABELS[type] ?? type;
  }

  onStartEdit(user: AppUser): void {
    this.editingUserId = user.id;
    this.editForm = {
      name: user.name || '',
      surname: user.surname || '',
      email: user.email || '',
      phone: user.phone || '',
    };
  }

  onSaveEdit(userId: string): void {
    if (!this.editForm) return;
    this.edit.emit({ id: userId, input: this.editForm });
    this.editingUserId = null;
    this.editForm = null;
  }
}

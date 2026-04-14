import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  AppUser,
  AppUserType,
  KeycloakOrgMember,
  KeycloakRealmRole,
} from '../../../../../services/app-user.service';

const USER_TYPE_LABELS: Record<AppUserType, string> = {
  OPERATOR: 'Operatore',
  SECRETARY: 'Segreteria',
  PRIVACY_OFFICER: 'Responsabile Privacy',
  IT_MANAGER: 'IT Manager',
};

@Component({
  selector: 'app-kc-members-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatDividerModule,
    MatCheckboxModule,
    MatTooltipModule,
  ],
  template: `
    @if (loading) {
      <div class="loading-row">
        <mat-spinner diameter="32"></mat-spinner>
        <span>Caricamento membri Keycloak...</span>
      </div>
    } @else {
      <!-- Desktop: mat-table -->
      <div class="table-wrapper desktop-only">
        <table mat-table [dataSource]="members" class="kc-table">
          <ng-container matColumnDef="username">
            <th mat-header-cell *matHeaderCellDef>Username</th>
            <td mat-cell *matCellDef="let m">{{ m.username }}</td>
          </ng-container>

          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let m">
              <div class="email-cell">
                {{ m.email || '—' }}
                @if (m.emailVerified) {
                  <mat-icon class="email-verified" matTooltip="Email verificata">verified</mat-icon>
                } @else {
                  <button mat-icon-button class="email-unverified-btn"
                    matTooltip="Email non verificata — clicca per verificare"
                    (click)="verifyEmail.emit(m.id)">
                    <mat-icon class="email-unverified">gpp_bad</mat-icon>
                  </button>
                }
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="kcName">
            <th mat-header-cell *matHeaderCellDef>Nome</th>
            <td mat-cell *matCellDef="let m">{{ m.firstName }} {{ m.lastName }}</td>
          </ng-container>

          <ng-container matColumnDef="linkStatus">
            <th mat-header-cell *matHeaderCellDef>Collegamento</th>
            <td mat-cell *matCellDef="let m">
              @if (m.isLinked) {
                <div class="status-chip linked">
                  <mat-icon>link</mat-icon>
                  {{ m.linkedAppUserName }}
                </div>
              } @else {
                <div class="status-chip unlinked">
                  <mat-icon>link_off</mat-icon>
                  Non collegato
                </div>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="kcRoles">
            <th mat-header-cell *matHeaderCellDef>Ruoli KC</th>
            <td mat-cell *matCellDef="let m">
              <div class="role-chips">
                @for (r of m.realmRoles; track r.id) {
                  <mat-chip class="role-chip">{{ r.name }}</mat-chip>
                }
                @if (!m.realmRoles?.length) {
                  <span class="no-roles">Nessuno</span>
                }
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="kcActions">
            <th mat-header-cell *matHeaderCellDef>Azioni</th>
            <td mat-cell *matCellDef="let m">
              <ng-container *ngTemplateOutlet="actionsTpl; context: { $implicit: m }"></ng-container>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </div>

      <!-- Mobile: card layout -->
      <div class="mobile-only cards-container">
        @for (m of members; track m.id) {
          <mat-card class="member-card">
            <mat-card-header>
              <mat-icon mat-card-avatar class="member-avatar">
                {{ m.isLinked ? 'person' : 'person_outline' }}
              </mat-icon>
              <mat-card-title>{{ m.firstName }} {{ m.lastName }}</mat-card-title>
              <mat-card-subtitle>
                {{ m.username }} · {{ m.email || '—' }}
                @if (m.emailVerified) {
                  <mat-icon class="email-verified" style="font-size: 16px; height: 16px; width: 16px; vertical-align: middle;">verified</mat-icon>
                } @else {
                  <button mat-icon-button class="email-unverified-btn"
                    matTooltip="Email non verificata — clicca per verificare"
                    (click)="verifyEmail.emit(m.id)" style="width: 24px; height: 24px; line-height: 24px;">
                    <mat-icon class="email-unverified" style="font-size: 16px;">gpp_bad</mat-icon>
                  </button>
                }
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              @if (m.isLinked) {
                <div class="status-chip linked">
                  <mat-icon>link</mat-icon>
                  Collegato a: {{ m.linkedAppUserName }}
                </div>
              } @else {
                <div class="status-chip unlinked">
                  <mat-icon>link_off</mat-icon>
                  Non collegato
                </div>
              }
              <div class="role-chips" style="margin-top: 8px;">
                @for (r of m.realmRoles; track r.id) {
                  <mat-chip class="role-chip">{{ r.name }}</mat-chip>
                }
                @if (!m.realmRoles?.length) {
                  <span class="no-roles">Nessun ruolo KC</span>
                }
              </div>
            </mat-card-content>
            <mat-card-actions>
              <ng-container *ngTemplateOutlet="actionsTpl; context: { $implicit: m }"></ng-container>
            </mat-card-actions>
          </mat-card>
        }
      </div>

      @if (!members.length) {
        <p class="empty-state">Nessun membro trovato nell'organizzazione Keycloak.</p>
      }
    }

    <!-- Template condiviso per azioni (desktop/mobile) -->
    <ng-template #actionsTpl let-m>
      <div class="actions-row">
        @if (!m.isLinked) {
          @if (assigningMemberId === m.id) {
            <div class="inline-assign">
              <mat-form-field appearance="outline" class="assign-select">
                <mat-label>Seleziona utente</mat-label>
                <mat-select (selectionChange)="onAssign(m.id, $event.value)">
                  @for (u of unlinkedAppUsers; track u.id) {
                    <mat-option [value]="u.id">
                      {{ u.name }} {{ u.surname }} ({{ userTypeLabel(u.userType) }})
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <button mat-icon-button (click)="cancelAssign.emit()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          } @else {
            <button mat-stroked-button color="primary"
              (click)="startAssign.emit(m.id)"
              [disabled]="!unlinkedAppUsers.length">
              <mat-icon>person_add</mat-icon>
              Assegna
            </button>
          }
        }
        <button mat-stroked-button (click)="onManageRoles(m.id)">
          <mat-icon>security</mat-icon>
          Ruoli
        </button>
        <button mat-stroked-button (click)="onStartEdit(m)">
          <mat-icon>edit</mat-icon>
          Modifica
        </button>
        <button mat-stroked-button (click)="onStartResetPassword(m.id)">
          <mat-icon>lock_reset</mat-icon>
          Reset Password
        </button>
        @if (m.isLinked) {
          <button mat-stroked-button (click)="unlinkKcUser.emit(m.id)">
            <mat-icon>link_off</mat-icon>
            Scollega
          </button>
        }
        <button mat-stroked-button color="warn" (click)="deleteKcUser.emit(m.id)">
          <mat-icon>delete</mat-icon>
          Elimina
        </button>
      </div>

      <!-- Pannello inline gestione ruoli KC -->
      @if (managingRolesMemberId === m.id) {
        <div class="inline-roles-panel">
          <mat-divider></mat-divider>
          <p class="roles-title">Gestione Ruoli Keycloak</p>
          <div class="role-chips">
            @for (r of m.realmRoles; track r.id) {
              <mat-chip class="role-chip">
                {{ r.name }}
                <button matChipRemove (click)="revokeKcRole.emit({ keycloakUserId: m.id, roleName: r.name })">
                  <mat-icon>cancel</mat-icon>
                </button>
              </mat-chip>
            }
            @if (!m.realmRoles?.length) {
              <span class="no-roles">Nessun ruolo assegnato</span>
            }
          </div>
          <div class="assign-role-row">
            <mat-form-field appearance="outline" class="role-select">
              <mat-label>Aggiungi ruolo</mat-label>
              <mat-select (selectionChange)="onAssignRole(m.id, $event.value)">
                @for (r of getAvailableRoles(m); track r.id) {
                  <mat-option [value]="r.name">{{ r.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <button mat-icon-button (click)="onManageRoles(null)">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>
      }

      <!-- Pannello inline modifica utente KC -->
      @if (editingMemberId === m.id && editForm) {
        <div class="inline-edit-panel">
          <mat-divider></mat-divider>
          <p class="roles-title">Modifica Utente Keycloak</p>
          <div class="edit-form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Username</mat-label>
              <input matInput [value]="editForm.username" disabled>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput [(ngModel)]="editForm.email">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Nome</mat-label>
              <input matInput [(ngModel)]="editForm.firstName">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Cognome</mat-label>
              <input matInput [(ngModel)]="editForm.lastName">
            </mat-form-field>
          </div>
          <div class="edit-actions-row">
            <button mat-raised-button color="primary" (click)="onSaveEdit(m.id)">
              <mat-icon>save</mat-icon>
              Salva
            </button>
            <button mat-stroked-button (click)="editingMemberId = null; editForm = null">
              Annulla
            </button>
          </div>
        </div>
      }

      <!-- Pannello inline reset password KC -->
      @if (resettingPasswordMemberId === m.id) {
        <div class="inline-edit-panel">
          <mat-divider></mat-divider>
          <p class="roles-title">Reset Password — {{ m.firstName }} {{ m.lastName }}</p>
          <div class="edit-form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Nuova password</mat-label>
              <input matInput [type]="showPassword ? 'text' : 'password'" [(ngModel)]="resetPasswordValue">
              <button mat-icon-button matSuffix (click)="showPassword = !showPassword" type="button">
                <mat-icon>{{ showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>
            <mat-checkbox [(ngModel)]="resetPasswordTemporary">
              Password temporanea (l'utente dovrà cambiarla al primo accesso)
            </mat-checkbox>
          </div>
          <div class="edit-actions-row">
            <button mat-raised-button color="warn"
              [disabled]="!resetPasswordValue"
              (click)="onConfirmResetPassword(m.id)">
              <mat-icon>lock_reset</mat-icon>
              Conferma Reset
            </button>
            <button mat-stroked-button (click)="resettingPasswordMemberId = null; resetPasswordValue = ''">
              Annulla
            </button>
          </div>
        </div>
      }
    </ng-template>
  `,
  styles: [`
    .loading-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      color: rgba(0,0,0,0.6);
    }
    .table-wrapper { overflow-x: auto; }
    .kc-table { width: 100%; }
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
    .email-cell { display: flex; align-items: center; gap: 4px; }
    .email-verified { color: #2e7d32; font-size: 18px; height: 18px; width: 18px; }
    .email-unverified { color: #c62828; font-size: 18px; }
    .email-unverified-btn { width: 28px; height: 28px; line-height: 28px; }
    .role-chip { font-size: 0.8rem; }
    .no-roles { color: rgba(0,0,0,0.4); font-size: 0.85rem; }
    .actions-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .inline-assign {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .assign-select {
      min-width: 200px;
      font-size: 0.85rem;
    }
    .inline-roles-panel {
      padding: 12px 0;
    }
    .roles-title {
      font-weight: 500;
      font-size: 0.9rem;
      margin: 8px 0;
    }
    .assign-role-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .role-select { min-width: 200px; font-size: 0.85rem; }
    .empty-state { text-align: center; color: rgba(0,0,0,0.4); padding: 24px; }

    /* Responsive */
    .desktop-only { display: block; }
    .mobile-only { display: none; }
    @media (max-width: 599px) {
      .desktop-only { display: none !important; }
      .mobile-only { display: flex !important; flex-direction: column; gap: 12px; }
    }
    .cards-container { padding: 8px 0; }
    .member-card { margin-bottom: 0; }
    .member-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(0,0,0,0.54);
    }
    .inline-edit-panel {
      padding: 12px 0;
    }
    .edit-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      margin: 8px 0;
    }
    @media (max-width: 599px) {
      .edit-form-grid {
        grid-template-columns: 1fr;
      }
    }
    .edit-actions-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
  `],
})
export class KcMembersTableComponent {
  @Input() members: KeycloakOrgMember[] = [];
  @Input() unlinkedAppUsers: AppUser[] = [];
  @Input() realmRoles: KeycloakRealmRole[] = [];
  @Input() loading = false;
  @Input() assigningMemberId: string | null = null;
  @Input() managingRolesMemberId: string | null = null;

  @Output() assign = new EventEmitter<{ keycloakUserId: string; appUserId: string }>();
  @Output() startAssign = new EventEmitter<string>();
  @Output() cancelAssign = new EventEmitter<void>();
  @Output() manageRoles = new EventEmitter<string | null>();
  @Output() assignKcRole = new EventEmitter<{ keycloakUserId: string; roleName: string }>();
  @Output() revokeKcRole = new EventEmitter<{ keycloakUserId: string; roleName: string }>();
  @Output() deleteKcUser = new EventEmitter<string>();
  @Output() unlinkKcUser = new EventEmitter<string>();
  @Output() updateKcUser = new EventEmitter<{ keycloakUserId: string; email: string; firstName: string; lastName: string }>();
  @Output() resetPassword = new EventEmitter<{ keycloakUserId: string; newPassword: string; temporary: boolean }>();
  @Output() verifyEmail = new EventEmitter<string>();

  // Edit state
  editingMemberId: string | null = null;
  editForm: { username: string; email: string; firstName: string; lastName: string } | null = null;

  // Reset password state
  resettingPasswordMemberId: string | null = null;
  resetPasswordValue = '';
  resetPasswordTemporary = true;
  showPassword = false;

  displayedColumns = ['username', 'email', 'kcName', 'linkStatus', 'kcRoles', 'kcActions'];

  userTypeLabel(type: AppUserType): string {
    return USER_TYPE_LABELS[type] ?? type;
  }

  onAssign(keycloakUserId: string, appUserId: string): void {
    this.assign.emit({ keycloakUserId, appUserId });
  }

  onManageRoles(memberId: string | null): void {
    this.manageRoles.emit(memberId);
  }

  onAssignRole(keycloakUserId: string, roleName: string): void {
    this.assignKcRole.emit({ keycloakUserId, roleName });
  }

  getAvailableRoles(member: KeycloakOrgMember): KeycloakRealmRole[] {
    const assignedNames = new Set(member.realmRoles?.map(r => r.name) ?? []);
    return this.realmRoles.filter(r => !assignedNames.has(r.name));
  }

  onStartEdit(member: KeycloakOrgMember): void {
    this.editingMemberId = member.id;
    this.editForm = {
      username: member.username,
      email: member.email || '',
      firstName: member.firstName || '',
      lastName: member.lastName || '',
    };
    // Chiudi altri pannelli
    this.resettingPasswordMemberId = null;
    this.managingRolesMemberId = null;
  }

  onSaveEdit(keycloakUserId: string): void {
    if (!this.editForm) return;
    const { username, ...data } = this.editForm;
    this.updateKcUser.emit({ keycloakUserId, ...data });
    this.editingMemberId = null;
    this.editForm = null;
  }

  onStartResetPassword(memberId: string): void {
    this.resettingPasswordMemberId = memberId;
    this.resetPasswordValue = '';
    this.resetPasswordTemporary = true;
    this.showPassword = false;
    // Chiudi altri pannelli
    this.editingMemberId = null;
    this.editForm = null;
    this.managingRolesMemberId = null;
  }

  onConfirmResetPassword(keycloakUserId: string): void {
    if (!this.resetPasswordValue) return;
    this.resetPassword.emit({
      keycloakUserId,
      newPassword: this.resetPasswordValue,
      temporary: this.resetPasswordTemporary,
    });
    this.resettingPasswordMemberId = null;
    this.resetPasswordValue = '';
  }
}

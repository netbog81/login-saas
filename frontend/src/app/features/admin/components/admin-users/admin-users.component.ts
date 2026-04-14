/**
 * Container (Layer 2) - Gestione Utenti Admin
 *
 * APPROACH: Architettura a 5 layer (architettura-componenti.md)
 * - Dumb components: AppUsersTable, KcMembersTable, CreateAppUserForm, CreateKcUserForm
 * - Container: questo componente (solo UI state + coordinamento)
 * - Service: AppUserService (Layer 3, BaseGraphQLService)
 */
import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { firstValueFrom } from 'rxjs';
import {
  AppUserService,
  AppUser,
  AppUserType,
  Role,
  CreateAppUserInput,
  UpdateAppUserInput,
  KeycloakOrgMember,
  KeycloakRealmRole,
  CreateKeycloakUserInput,
} from '../../../../services/app-user.service';
// Dumb components (Layer 1)
import { AppUsersTableComponent } from './components/app-users-table.component';
import { KcMembersTableComponent } from './components/kc-members-table.component';
import { CreateAppUserFormComponent } from './components/create-app-user-form.component';
import { CreateKcUserFormComponent } from './components/create-kc-user-form.component';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatDividerModule,
    MatChipsModule,
    // Dumb components
    AppUsersTableComponent,
    KcMembersTableComponent,
    CreateAppUserFormComponent,
    CreateKcUserFormComponent,
  ],
  template: `
    <div class="users-section">

      <!-- Pannello 1: Lista Utenti App -->
      <mat-expansion-panel [expanded]="true">
        <mat-expansion-panel-header>
          <mat-panel-title>
            <mat-icon>people</mat-icon>
            Lista Utenti ({{ users().length }})
          </mat-panel-title>
        </mat-expansion-panel-header>

        <div class="panel-content">
          <app-users-table
            [users]="users()"
            [loading]="loadingUsers()"
            (toggleActive)="onToggleActive($event)"
            (manageRoles)="openAssignRole($event)"
            (edit)="onEditUser($event)"
            (delete)="onDeleteUser($event)"
            (unlink)="onUnlinkUser($event)">
          </app-users-table>
        </div>
      </mat-expansion-panel>

      <!-- Pannello 2: Membri Organizzazione Keycloak -->
      <mat-expansion-panel (opened)="loadKcMembers()">
        <mat-expansion-panel-header>
          <mat-panel-title>
            <mat-icon>group</mat-icon>
            Membri Organizzazione Keycloak
          </mat-panel-title>
          <mat-panel-description>
            {{ kcMembers().length }} membri
          </mat-panel-description>
        </mat-expansion-panel-header>

        <div class="panel-content">
          <app-kc-members-table
            [members]="kcMembers()"
            [unlinkedAppUsers]="unlinkedUsers()"
            [realmRoles]="kcRealmRoles()"
            [loading]="loadingKcMembers()"
            [assigningMemberId]="assigningMember()"
            [managingRolesMemberId]="managingKcRolesMemberId()"
            (assign)="onAssignKeycloakMember($event)"
            (startAssign)="assigningMember.set($event)"
            (cancelAssign)="assigningMember.set(null)"
            (manageRoles)="managingKcRolesMemberId.set($event)"
            (assignKcRole)="onAssignKcRole($event)"
            (revokeKcRole)="onRevokeKcRole($event)"
            (deleteKcUser)="onDeleteKcUser($event)"
            (unlinkKcUser)="onUnlinkKcUser($event)"
            (updateKcUser)="onUpdateKcUser($event)"
            (resetPassword)="onResetKcPassword($event)"
            (verifyEmail)="onVerifyKcEmail($event)">
          </app-kc-members-table>
        </div>
      </mat-expansion-panel>

      <!-- Pannello 3: Crea Utente App -->
      <mat-expansion-panel>
        <mat-expansion-panel-header>
          <mat-panel-title>
            <mat-icon>person_add</mat-icon>
            Crea Nuovo Utente App
          </mat-panel-title>
        </mat-expansion-panel-header>

        <div class="panel-content">
          <app-create-app-user-form
            [userTypes]="userTypes"
            [submitting]="creatingUser()"
            (create)="onCreateUser($event)">
          </app-create-app-user-form>
        </div>
      </mat-expansion-panel>

      <!-- Pannello 4: Crea Utente Keycloak -->
      <mat-expansion-panel (opened)="loadKcRealmRoles()">
        <mat-expansion-panel-header>
          <mat-panel-title>
            <mat-icon>person_add</mat-icon>
            Crea Utente Keycloak
          </mat-panel-title>
        </mat-expansion-panel-header>

        <div class="panel-content">
          <app-create-kc-user-form
            [realmRoles]="kcRealmRoles()"
            [submitting]="creatingKcUser()"
            (create)="onCreateKeycloakUser($event)">
          </app-create-kc-user-form>
        </div>
      </mat-expansion-panel>

      <!-- Pannello 5: Gestione Ruoli (contestuale) -->
      @if (selectedUser()) {
        <mat-expansion-panel [expanded]="true">
          <mat-expansion-panel-header>
            <mat-panel-title>
              <mat-icon>manage_accounts</mat-icon>
              Gestione Ruoli App: {{ selectedUser()!.name }} {{ selectedUser()!.surname }}
            </mat-panel-title>
          </mat-expansion-panel-header>

          <div class="panel-content">
            <p>Ruoli attuali:</p>
            <div class="role-chips">
              @for (ur of selectedUser()!.userRoles; track ur.role.id) {
                <mat-chip class="role-chip">
                  {{ ur.role.name }}
                  <button matChipRemove (click)="onRevokeRole(selectedUser()!.id, ur.role.id)">
                    <mat-icon>cancel</mat-icon>
                  </button>
                </mat-chip>
              }
              @if (!selectedUser()!.userRoles?.length) {
                <span class="no-roles">Nessun ruolo assegnato</span>
              }
            </div>

            <mat-divider style="margin: 16px 0"></mat-divider>

            <div class="assign-role-row">
              <mat-form-field appearance="outline" class="role-select">
                <mat-label>Assegna Ruolo</mat-label>
                <mat-select [(ngModel)]="roleToAssign">
                  @for (r of availableRoles(); track r.id) {
                    <mat-option [value]="r.id">{{ r.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <button mat-raised-button color="primary"
                [disabled]="!roleToAssign"
                (click)="onAssignRole()">
                <mat-icon>add</mat-icon>
                Assegna
              </button>
              <button mat-stroked-button (click)="selectedUser.set(null)">
                Chiudi
              </button>
            </div>
          </div>
        </mat-expansion-panel>
      }

    </div>
  `,
  styles: [`
    .users-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 0;
    }
    mat-expansion-panel-header mat-icon { margin-right: 8px; }
    .panel-content { padding: 16px 0; }
    .role-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .role-chip { font-size: 0.8rem; }
    .no-roles { color: rgba(0,0,0,0.4); font-size: 0.85rem; }
    .assign-role-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .role-select { flex: 1; min-width: 200px; }
    @media (max-width: 599px) {
      .assign-role-row {
        flex-direction: column;
        align-items: stretch;
      }
      .role-select { min-width: unset; }
    }
  `],
})
export class AdminUsersComponent implements OnInit {
  private readonly userService = inject(AppUserService);
  private readonly snackBar = inject(MatSnackBar);

  // ─── UI State (signals) ─────────────────────────────────────
  users = signal<AppUser[]>([]);
  unlinkedUsers = signal<AppUser[]>([]);
  roles = signal<Role[]>([]);
  kcMembers = signal<KeycloakOrgMember[]>([]);
  kcRealmRoles = signal<KeycloakRealmRole[]>([]);

  loadingUsers = signal(false);
  creatingUser = signal(false);
  loadingKcMembers = signal(false);
  creatingKcUser = signal(false);
  assigningMember = signal<string | null>(null);
  managingKcRolesMemberId = signal<string | null>(null);

  selectedUser = signal<AppUser | null>(null);
  roleToAssign: string | null = null;

  userTypes: AppUserType[] = ['OPERATOR', 'SECRETARY', 'PRIVACY_OFFICER', 'IT_MANAGER'];

  availableRoles = computed(() => {
    const user = this.selectedUser();
    if (!user) return this.roles();
    const assignedIds = new Set(user.userRoles?.map((ur) => ur.role.id) ?? []);
    return this.roles().filter((r) => !assignedIds.has(r.id));
  });

  // ─── Lifecycle ──────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadUsers(), this.loadRoles()]);
  }

  // ─── Data Loading ───────────────────────────────────────────

  async loadUsers(): Promise<void> {
    this.loadingUsers.set(true);
    try {
      const [all, unlinked] = await Promise.all([
        firstValueFrom(this.userService.getUsers()),
        firstValueFrom(this.userService.getUnlinkedUsers()),
      ]);
      this.users.set(all);
      this.unlinkedUsers.set(unlinked);
    } catch (err: any) {
      this.snackBar.open(`Errore caricamento utenti: ${err?.message}`, 'Chiudi', { duration: 5000 });
    } finally {
      this.loadingUsers.set(false);
    }
  }

  async loadRoles(): Promise<void> {
    try {
      const roles = await firstValueFrom(this.userService.getRoles());
      this.roles.set(roles);
    } catch { /* ignora */ }
  }

  async loadKcMembers(): Promise<void> {
    this.loadingKcMembers.set(true);
    try {
      const [members, roles] = await Promise.all([
        firstValueFrom(this.userService.getKeycloakOrgMembers()),
        firstValueFrom(this.userService.getKeycloakRealmRoles()),
      ]);
      this.kcMembers.set(members);
      this.kcRealmRoles.set(roles);
    } catch (err: any) {
      this.snackBar.open(`Errore caricamento membri Keycloak: ${err?.message}`, 'Chiudi', { duration: 5000 });
    } finally {
      this.loadingKcMembers.set(false);
    }
  }

  async loadKcRealmRoles(): Promise<void> {
    if (this.kcRealmRoles().length > 0) return; // già caricati
    try {
      const roles = await firstValueFrom(this.userService.getKeycloakRealmRoles());
      this.kcRealmRoles.set(roles);
    } catch { /* ignora */ }
  }

  // ─── Event Handlers (delegano al service) ───────────────────

  async onCreateUser(input: CreateAppUserInput): Promise<void> {
    this.creatingUser.set(true);
    try {
      await firstValueFrom(this.userService.createUser(input));
      this.snackBar.open('Utente creato con successo.', 'OK', { duration: 3000 });
      await this.loadUsers();
    } catch (err: any) {
      this.snackBar.open(`Errore: ${err?.message}`, 'Chiudi', { duration: 5000 });
    } finally {
      this.creatingUser.set(false);
    }
  }

  async onCreateKeycloakUser(input: CreateKeycloakUserInput): Promise<void> {
    this.creatingKcUser.set(true);
    try {
      await firstValueFrom(this.userService.createKeycloakUser(input));
      this.snackBar.open('Utente Keycloak creato con successo.', 'OK', { duration: 3000 });
      await this.loadKcMembers();
    } catch (err: any) {
      this.snackBar.open(`Errore creazione utente: ${err?.message}`, 'Chiudi', { duration: 5000 });
    } finally {
      this.creatingKcUser.set(false);
    }
  }

  async onAssignKeycloakMember(event: { keycloakUserId: string; appUserId: string }): Promise<void> {
    try {
      await firstValueFrom(this.userService.linkKeycloakUser({
        appUserId: event.appUserId,
        keycloakUserId: event.keycloakUserId,
      }));
      this.assigningMember.set(null);
      this.snackBar.open('Utente collegato con successo.', 'OK', { duration: 3000 });
      await Promise.all([this.loadUsers(), this.loadKcMembers()]);
    } catch (err: any) {
      this.snackBar.open(`Errore: ${err?.message}`, 'Chiudi', { duration: 5000 });
    }
  }

  async onEditUser(event: { id: string; input: UpdateAppUserInput }): Promise<void> {
    try {
      await firstValueFrom(this.userService.updateUser(event.id, event.input));
      this.snackBar.open('Utente aggiornato con successo.', 'OK', { duration: 3000 });
      await this.loadUsers();
    } catch (err: any) {
      this.snackBar.open(`Errore aggiornamento: ${err?.message}`, 'Chiudi', { duration: 5000 });
    }
  }

  async onToggleActive(user: AppUser): Promise<void> {
    try {
      await firstValueFrom(this.userService.updateUser(user.id, { isActive: !user.isActive }));
      this.snackBar.open(`Utente ${user.isActive ? 'disattivato' : 'attivato'}.`, 'OK', { duration: 3000 });
      await this.loadUsers();
    } catch (err: any) {
      this.snackBar.open(`Errore: ${err?.message}`, 'Chiudi', { duration: 5000 });
    }
  }

  openAssignRole(user: AppUser): void {
    this.selectedUser.set(user);
    this.roleToAssign = null;
  }

  async onAssignRole(): Promise<void> {
    const user = this.selectedUser();
    if (!user || !this.roleToAssign) return;
    try {
      await firstValueFrom(this.userService.assignRole({ appUserId: user.id, roleId: this.roleToAssign }));
      this.snackBar.open('Ruolo assegnato.', 'OK', { duration: 3000 });
      await this.loadUsers();
      const updated = this.users().find((u) => u.id === user.id);
      this.selectedUser.set(updated ?? null);
      this.roleToAssign = null;
    } catch (err: any) {
      this.snackBar.open(`Errore: ${err?.message}`, 'Chiudi', { duration: 5000 });
    }
  }

  async onRevokeRole(userId: string, roleId: string): Promise<void> {
    try {
      await firstValueFrom(this.userService.revokeRole({ appUserId: userId, roleId }));
      this.snackBar.open('Ruolo rimosso.', 'OK', { duration: 3000 });
      await this.loadUsers();
      const updated = this.users().find((u) => u.id === userId);
      this.selectedUser.set(updated ?? null);
    } catch (err: any) {
      this.snackBar.open(`Errore: ${err?.message}`, 'Chiudi', { duration: 5000 });
    }
  }

  // ─── Keycloak Realm Roles ─────────────────────────────────────

  async onAssignKcRole(event: { keycloakUserId: string; roleName: string }): Promise<void> {
    try {
      await firstValueFrom(this.userService.assignKcRealmRole(event.keycloakUserId, event.roleName));
      this.snackBar.open('Ruolo KC assegnato.', 'OK', { duration: 3000 });
      await this.loadKcMembers();
    } catch (err: any) {
      this.snackBar.open(`Errore: ${err?.message}`, 'Chiudi', { duration: 5000 });
    }
  }

  async onRevokeKcRole(event: { keycloakUserId: string; roleName: string }): Promise<void> {
    try {
      await firstValueFrom(this.userService.revokeKcRealmRole(event.keycloakUserId, event.roleName));
      this.snackBar.open('Ruolo KC rimosso.', 'OK', { duration: 3000 });
      await this.loadKcMembers();
    } catch (err: any) {
      this.snackBar.open(`Errore: ${err?.message}`, 'Chiudi', { duration: 5000 });
    }
  }

  // ─── Update & Reset Password KC ────────────────────────────────

  async onUpdateKcUser(event: { keycloakUserId: string; email: string; firstName: string; lastName: string }): Promise<void> {
    try {
      await firstValueFrom(this.userService.updateKeycloakUser(event));
      this.snackBar.open('Utente Keycloak aggiornato.', 'OK', { duration: 3000 });
      await this.loadKcMembers();
    } catch (err: any) {
      this.snackBar.open(`Errore aggiornamento: ${err?.message}`, 'Chiudi', { duration: 5000 });
    }
  }

  async onResetKcPassword(event: { keycloakUserId: string; newPassword: string; temporary: boolean }): Promise<void> {
    try {
      await firstValueFrom(this.userService.resetKeycloakPassword(event));
      this.snackBar.open('Password reimpostata con successo.', 'OK', { duration: 3000 });
    } catch (err: any) {
      this.snackBar.open(`Errore reset password: ${err?.message}`, 'Chiudi', { duration: 5000 });
    }
  }

  async onVerifyKcEmail(keycloakUserId: string): Promise<void> {
    try {
      await firstValueFrom(this.userService.verifyKeycloakEmail(keycloakUserId));
      this.snackBar.open('Email verificata con successo.', 'OK', { duration: 3000 });
      await this.loadKcMembers();
    } catch (err: any) {
      this.snackBar.open(`Errore verifica email: ${err?.message}`, 'Chiudi', { duration: 5000 });
    }
  }

  // ─── Delete & Unlink ─────────────────────────────────────────

  async onDeleteUser(user: AppUser): Promise<void> {
    const msg = user.keycloakId
      ? `Eliminare ${user.name} ${user.surname || ''}? L'utente Keycloak collegato NON verra' eliminato.`
      : `Eliminare ${user.name} ${user.surname || ''}?`;
    if (!confirm(msg)) return;
    try {
      await firstValueFrom(this.userService.deleteUser(user.id));
      this.snackBar.open('Utente eliminato.', 'OK', { duration: 3000 });
      if (this.selectedUser()?.id === user.id) this.selectedUser.set(null);
      await this.loadUsers();
    } catch (err: any) {
      this.snackBar.open(`Errore: ${err?.message}`, 'Chiudi', { duration: 5000 });
    }
  }

  async onUnlinkUser(user: AppUser): Promise<void> {
    if (!confirm(`Scollegare ${user.name} ${user.surname || ''} dall'utente Keycloak?`)) return;
    try {
      await firstValueFrom(this.userService.unlinkKeycloakUser(user.id));
      this.snackBar.open('Utente scollegato da Keycloak.', 'OK', { duration: 3000 });
      await Promise.all([this.loadUsers(), this.loadKcMembers()]);
    } catch (err: any) {
      this.snackBar.open(`Errore: ${err?.message}`, 'Chiudi', { duration: 5000 });
    }
  }

  async onDeleteKcUser(keycloakUserId: string): Promise<void> {
    if (!confirm('Eliminare questo utente da Keycloak? Se collegato, il collegamento verra\' rimosso.')) return;
    try {
      await firstValueFrom(this.userService.deleteKeycloakUser(keycloakUserId));
      this.snackBar.open('Utente Keycloak eliminato.', 'OK', { duration: 3000 });
      await Promise.all([this.loadKcMembers(), this.loadUsers()]);
    } catch (err: any) {
      this.snackBar.open(`Errore: ${err?.message}`, 'Chiudi', { duration: 5000 });
    }
  }

  async onUnlinkKcUser(keycloakUserId: string): Promise<void> {
    // Trova l'app user collegato
    const member = this.kcMembers().find(m => m.id === keycloakUserId);
    if (!member?.linkedAppUserId) return;
    if (!confirm(`Scollegare ${member.firstName} ${member.lastName} dall'utente app?`)) return;
    try {
      await firstValueFrom(this.userService.unlinkKeycloakUser(member.linkedAppUserId));
      this.snackBar.open('Utente scollegato.', 'OK', { duration: 3000 });
      await Promise.all([this.loadUsers(), this.loadKcMembers()]);
    } catch (err: any) {
      this.snackBar.open(`Errore: ${err?.message}`, 'Chiudi', { duration: 5000 });
    }
  }
}

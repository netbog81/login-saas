import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import {
  AppUserService,
  AppUser,
  AppUserType,
  Role,
  CreateAppUserInput,
} from '../../../../services/app-user.service';

const USER_TYPE_LABELS: Record<AppUserType, string> = {
  OPERATOR: 'Operatore',
  SECRETARY: 'Segreteria',
  PRIVACY_OFFICER: 'Responsabile Privacy',
  IT_MANAGER: 'IT Manager',
};

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatSelectModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  template: `
    <div class="users-section">

      <!-- Lista Utenti -->
      <mat-expansion-panel [expanded]="true">
        <mat-expansion-panel-header>
          <mat-panel-title>
            <mat-icon>people</mat-icon>
            Lista Utenti ({{ users().length }})
          </mat-panel-title>
        </mat-expansion-panel-header>

        <div class="panel-content">
          @if (loadingUsers()) {
            <div class="loading-row">
              <mat-spinner diameter="32"></mat-spinner>
              <span>Caricamento utenti...</span>
            </div>
          } @else {
            <table mat-table [dataSource]="users()" class="users-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Nome</th>
                <td mat-cell *matCellDef="let u">{{ u.name }} {{ u.surname }}</td>
              </ng-container>

              <ng-container matColumnDef="email">
                <th mat-header-cell *matHeaderCellDef>Email</th>
                <td mat-cell *matCellDef="let u">{{ u.email || '—' }}</td>
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
                  <button mat-icon-button
                    matTooltip="Assegna Ruolo"
                    (click)="openAssignRole(u)">
                    <mat-icon>manage_accounts</mat-icon>
                  </button>
                  <button mat-icon-button
                    [matTooltip]="u.isActive ? 'Disattiva' : 'Attiva'"
                    (click)="toggleActive(u)">
                    <mat-icon>{{ u.isActive ? 'person_off' : 'person' }}</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>

            @if (!users().length) {
              <p class="empty-state">Nessun utente trovato.</p>
            }
          }
        </div>
      </mat-expansion-panel>

      <!-- Crea Utente -->
      <mat-expansion-panel>
        <mat-expansion-panel-header>
          <mat-panel-title>
            <mat-icon>person_add</mat-icon>
            Crea Nuovo Utente
          </mat-panel-title>
        </mat-expansion-panel-header>

        <div class="panel-content">
          <form [formGroup]="createForm" (ngSubmit)="onCreateUser()" class="create-form">
            <mat-form-field appearance="outline">
              <mat-label>Nome *</mat-label>
              <input matInput formControlName="name">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Cognome</mat-label>
              <input matInput formControlName="surname">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Telefono</mat-label>
              <input matInput formControlName="phone">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Tipo Utente *</mat-label>
              <mat-select formControlName="userType">
                @for (type of userTypes; track type) {
                  <mat-option [value]="type">{{ userTypeLabel(type) }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <div class="form-actions">
              <button mat-stroked-button type="button" (click)="createForm.reset()">Annulla</button>
              <button mat-raised-button color="primary" type="submit"
                [disabled]="createForm.invalid || creatingUser()">
                @if (creatingUser()) {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  <mat-icon>save</mat-icon>
                }
                Crea Utente
              </button>
            </div>
          </form>
        </div>
      </mat-expansion-panel>

      <!-- Link Utente a Keycloak -->
      <mat-expansion-panel>
        <mat-expansion-panel-header>
          <mat-panel-title>
            <mat-icon>link</mat-icon>
            Collega Utente a Account Keycloak
          </mat-panel-title>
          <mat-panel-description>
            Utenti non collegati: {{ unlinkedUsers().length }}
          </mat-panel-description>
        </mat-expansion-panel-header>

        <div class="panel-content">
          <form [formGroup]="linkForm" (ngSubmit)="onLinkUser()" class="create-form">
            <mat-form-field appearance="outline">
              <mat-label>Utente App (non collegato)</mat-label>
              <mat-select formControlName="appUserId">
                @for (u of unlinkedUsers(); track u.id) {
                  <mat-option [value]="u.id">{{ u.name }} {{ u.surname }} ({{ userTypeLabel(u.userType) }})</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Keycloak User ID</mat-label>
              <input matInput formControlName="keycloakUserId" placeholder="UUID dell'utente in Keycloak">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Mapping ID</mat-label>
              <input matInput formControlName="userMappingId" placeholder="ID mapping nell'Auth Microservice">
            </mat-form-field>

            <div class="form-actions">
              <button mat-raised-button color="accent" type="submit"
                [disabled]="linkForm.invalid || linkingUser()">
                @if (linkingUser()) {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  <mat-icon>link</mat-icon>
                }
                Collega Utente
              </button>
            </div>
          </form>
        </div>
      </mat-expansion-panel>

      <!-- Assegna Ruolo (pannello contestuale) -->
      @if (selectedUser()) {
        <mat-expansion-panel [expanded]="true">
          <mat-expansion-panel-header>
            <mat-panel-title>
              <mat-icon>manage_accounts</mat-icon>
              Gestione Ruoli: {{ selectedUser()!.name }} {{ selectedUser()!.surname }}
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
              <mat-form-field appearance="outline" style="flex: 1">
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
    .loading-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      color: rgba(0,0,0,0.6);
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
    .create-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 16px;
    }
    .form-actions {
      grid-column: 1 / -1;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .assign-role-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  `],
})
export class AdminUsersComponent implements OnInit {
  private readonly userService = inject(AppUserService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  users = signal<AppUser[]>([]);
  unlinkedUsers = signal<AppUser[]>([]);
  roles = signal<Role[]>([]);
  loadingUsers = signal(false);
  creatingUser = signal(false);
  linkingUser = signal(false);
  selectedUser = signal<AppUser | null>(null);
  roleToAssign: string | null = null;

  displayedColumns = ['name', 'email', 'type', 'status', 'roles', 'actions'];
  userTypes: AppUserType[] = ['OPERATOR', 'SECRETARY', 'PRIVACY_OFFICER', 'IT_MANAGER'];

  availableRoles = computed(() => {
    const user = this.selectedUser();
    if (!user) return this.roles();
    const assignedIds = new Set(user.userRoles?.map((ur) => ur.role.id) ?? []);
    return this.roles().filter((r) => !assignedIds.has(r.id));
  });

  createForm = this.fb.group({
    name: ['', Validators.required],
    surname: [''],
    email: ['', Validators.email],
    phone: [''],
    userType: ['OPERATOR' as AppUserType, Validators.required],
  });

  linkForm = this.fb.group({
    appUserId: ['', Validators.required],
    keycloakUserId: ['', Validators.required],
    userMappingId: ['', Validators.required],
  });

  userTypeLabel(type: AppUserType): string {
    return USER_TYPE_LABELS[type] ?? type;
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadUsers(), this.loadRoles()]);
  }

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

  async onCreateUser(): Promise<void> {
    if (this.createForm.invalid) return;
    this.creatingUser.set(true);
    try {
      const input = this.createForm.value as CreateAppUserInput;
      await firstValueFrom(this.userService.createUser(input));
      this.createForm.reset({ userType: 'OPERATOR' });
      this.snackBar.open('Utente creato con successo.', 'OK', { duration: 3000 });
      await this.loadUsers();
    } catch (err: any) {
      this.snackBar.open(`Errore: ${err?.message}`, 'Chiudi', { duration: 5000 });
    } finally {
      this.creatingUser.set(false);
    }
  }

  async onLinkUser(): Promise<void> {
    if (this.linkForm.invalid) return;
    this.linkingUser.set(true);
    try {
      const { appUserId, keycloakUserId, userMappingId } = this.linkForm.value;
      await firstValueFrom(this.userService.linkKeycloakUser({
        appUserId: appUserId!,
        keycloakUserId: keycloakUserId!,
        userMappingId: userMappingId!,
      }));
      this.linkForm.reset();
      this.snackBar.open('Utente collegato con successo.', 'OK', { duration: 3000 });
      await this.loadUsers();
    } catch (err: any) {
      this.snackBar.open(`Errore: ${err?.message}`, 'Chiudi', { duration: 5000 });
    } finally {
      this.linkingUser.set(false);
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
      // Aggiorna il selectedUser con i dati freschi
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

  async toggleActive(user: AppUser): Promise<void> {
    try {
      await firstValueFrom(this.userService.updateUser(user.id, { isActive: !user.isActive }));
      this.snackBar.open(`Utente ${user.isActive ? 'disattivato' : 'attivato'}.`, 'OK', { duration: 3000 });
      await this.loadUsers();
    } catch (err: any) {
      this.snackBar.open(`Errore: ${err?.message}`, 'Chiudi', { duration: 5000 });
    }
  }
}

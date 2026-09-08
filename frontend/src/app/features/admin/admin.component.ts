import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { AdminDatabaseComponent } from './components/admin-database/admin-database.component';
import { AdminSitesComponent } from './components/admin-sites/admin-sites.component';
import { AdminUsersComponent } from './components/admin-users/admin-users.component';
import { AdminPermissionsComponent } from './components/admin-permissions/admin-permissions.component';
import { AdminBackupComponent } from './components/admin-backup/admin-backup.component';
import { AdminRecycleBinComponent } from './components/admin-recycle-bin/admin-recycle-bin.component';
import { AdminSystemHealthComponent } from './components/admin-system-health/admin-system-health.component';
import { AdminPatientCalendarsComponent } from './components/admin-patient-calendars/admin-patient-calendars.component';
import { OidcAuthService } from '../../core/auth/oidc-auth.service';

const TAB_NAMES = ['database', 'utenti', 'permessi', 'backup', 'cestino', 'calendari', 'sedi', 'sistema'] as const;
type TabName = typeof TAB_NAMES[number];

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    MatToolbarModule,
    MatButtonModule,
    AdminDatabaseComponent,
    AdminSitesComponent,
    AdminUsersComponent,
    AdminPermissionsComponent,
    AdminBackupComponent,
    AdminRecycleBinComponent,
    AdminSystemHealthComponent,
    AdminPatientCalendarsComponent,
  ],
  template: `
    <div class="admin-container">
      <mat-toolbar color="primary" class="admin-toolbar">
        <mat-icon>admin_panel_settings</mat-icon>
        <span class="toolbar-title">Amministrazione Tenant</span>
        <span class="toolbar-spacer"></span>
        <span class="tenant-badge">{{ tenantId }}</span>
        <button mat-icon-button (click)="goToApp()" matTooltip="Torna all'applicazione">
          <mat-icon>apps</mat-icon>
        </button>
      </mat-toolbar>

      <mat-tab-group
        [selectedIndex]="selectedTabIndex"
        (selectedIndexChange)="onTabChange($event)"
        animationDuration="200ms"
        class="admin-tabs">

        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">storage</mat-icon>
            Database
          </ng-template>
          <div class="tab-content">
            <app-admin-database></app-admin-database>
          </div>
        </mat-tab>

        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">people</mat-icon>
            Utenti
          </ng-template>
          <div class="tab-content-wide">
            <app-admin-users></app-admin-users>
          </div>
        </mat-tab>

        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">key</mat-icon>
            Permessi
          </ng-template>
          <div class="tab-content-wide">
            <app-admin-permissions></app-admin-permissions>
          </div>
        </mat-tab>

        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">backup</mat-icon>
            Backup
          </ng-template>
          <div class="tab-content">
            <app-admin-backup></app-admin-backup>
          </div>
        </mat-tab>

        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">delete_sweep</mat-icon>
            Cestino
          </ng-template>
          <div class="tab-content-wide">
            <app-admin-recycle-bin></app-admin-recycle-bin>
          </div>
        </mat-tab>

        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">event_available</mat-icon>
            Calendari
          </ng-template>
          <div class="tab-content-wide">
            <app-admin-patient-calendars></app-admin-patient-calendars>
          </div>
        </mat-tab>

        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">apartment</mat-icon>
            Sedi
          </ng-template>
          <div class="tab-content-wide">
            <app-admin-sites></app-admin-sites>
          </div>
        </mat-tab>

        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">monitor_heart</mat-icon>
            Sistema
          </ng-template>
          <div class="tab-content">
            <app-admin-system-health></app-admin-system-health>
          </div>
        </mat-tab>

      </mat-tab-group>
    </div>
  `,
  styles: [`
    .admin-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: #f5f5f5;
    }
    .admin-toolbar {
      flex-shrink: 0;
    }
    .toolbar-title {
      margin-left: 12px;
      font-size: 1.1rem;
      font-weight: 500;
    }
    .toolbar-spacer { flex: 1; }
    .tenant-badge {
      background: rgba(255,255,255,0.2);
      padding: 2px 12px;
      border-radius: 12px;
      font-size: 0.85rem;
      margin-right: 8px;
      font-family: monospace;
    }
    .admin-tabs {
      flex: 1;
      overflow: hidden;
      background: white;
    }
    .tab-icon { margin-right: 6px; font-size: 18px; }
    .tab-content {
      padding: 24px;
      max-width: 960px;
      margin: 0 auto;
    }
    .tab-content-wide {
      padding: 24px;
      padding-bottom: 80px;
      max-width: 1400px;
      margin: 0 auto;
    }
  `],
})
export class AdminComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly authService = inject(OidcAuthService);

  selectedTabIndex = 0;

  get tenantId(): string {
    return this.authService.currentUser()?.tenantId ?? '';
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const tab = (params['tab'] as TabName) ?? 'database';
      const idx = TAB_NAMES.indexOf(tab);
      this.selectedTabIndex = idx >= 0 ? idx : 0;
    });
  }

  onTabChange(index: number): void {
    const tab = TAB_NAMES[index] ?? 'database';
    this.router.navigate([], {
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  goToApp(): void {
    this.router.navigate(['/calendar']);
  }
}

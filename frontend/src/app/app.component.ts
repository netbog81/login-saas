import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { ContextPreservationService } from './core/services/context-preservation.service';
import { OidcAuthService } from './core/auth/oidc-auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
  ],
  template: `
    <div class="app-container">
      @if (authService.isAuthenticated()) {
        <nav class="app-nav">
          <div class="nav-brand">
            <h1>Curandis</h1>
          </div>
          <div class="nav-menu">
            <a class="nav-item" routerLink="/calendar" routerLinkActive="active">
              Calendario
            </a>
            <a class="nav-item" routerLink="/patients" routerLinkActive="active">
              Pazienti
            </a>
            @if (authService.hasRole(['operatore', 'medico', 'admin', 'amministratore', 'superadmin', 'it_manager'])) {
              <a class="nav-item" routerLink="/operatori-new" routerLinkActive="active">
                Operatori
              </a>
            }
            <a class="nav-item" routerLink="/availability" routerLinkActive="active">
              Configurazioni
            </a>
            <a class="nav-item" routerLink="/conflicts" routerLinkActive="active">
              Conflitti
            </a>
            @if (authService.hasRole(['admin', 'amministratore', 'superadmin', 'it_manager'])) {
              <a class="nav-item" routerLink="/admin" routerLinkActive="active">
                Admin
              </a>
            }
            @if (authService.hasRole(['admin', 'amministratore', 'superadmin'])) {
              <a class="nav-item" routerLink="/settings" routerLinkActive="active">
                Impostazioni
              </a>
            }
          </div>
          <div class="nav-user">
            <button mat-button [matMenuTriggerFor]="userMenu" class="user-button">
              <mat-icon>account_circle</mat-icon>
              <span class="user-name">{{ authService.currentUser()?.name }}</span>
              <mat-icon>arrow_drop_down</mat-icon>
            </button>
            <mat-menu #userMenu="matMenu">
              <div class="menu-header" (click)="$event.stopPropagation()">
                <div class="menu-user-name">{{ authService.currentUser()?.name }}</div>
                <div class="menu-user-email">{{ authService.currentUser()?.email }}</div>
                <div class="menu-user-roles">
                  @for (role of authService.currentUser()?.roles; track role) {
                    <span class="role-chip">{{ role }}</span>
                  }
                </div>
              </div>
              <mat-divider></mat-divider>
              <button mat-menu-item (click)="onLogout()">
                <mat-icon>logout</mat-icon>
                <span>Esci</span>
              </button>
            </mat-menu>
          </div>
        </nav>
      }

      <main class="app-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: auto;
    }

    .app-nav {
      background: #2c3e50;
      color: white;
      padding: 0 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      flex-shrink: 0;
      z-index: 100;
    }

    .nav-brand h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
    }

    .nav-menu {
      display: flex;
      gap: 0;
    }

    .nav-item {
      display: inline-block;
      background: none;
      border: none;
      color: rgba(255,255,255,0.8);
      padding: 20px 24px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
      position: relative;
    }

    .nav-item:hover {
      background: rgba(255,255,255,0.1);
      color: white;
    }

    .nav-item.active {
      color: white;
      background: rgba(255,255,255,0.15);
    }

    .nav-item.active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: #3498db;
    }

    .nav-user {
      flex-shrink: 0;
    }

    .user-button {
      color: rgba(255,255,255,0.9) !important;
    }

    .user-name {
      margin: 0 4px;
      font-size: 14px;
    }

    .menu-header {
      padding: 12px 16px;
    }

    .menu-user-name {
      font-weight: 500;
      font-size: 15px;
    }

    .menu-user-email {
      color: #666;
      font-size: 13px;
      margin-top: 2px;
    }

    .menu-user-roles {
      margin-top: 8px;
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .role-chip {
      display: inline-block;
      background: #e3f2fd;
      color: #1565c0;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
    }

    .app-content {
      flex: 1;
      background: #f5f5f5;
      overflow: hidden;
      min-height: 0;
    }

    @media (max-width: 768px) {
      .nav-brand h1 { font-size: 18px; }
      .nav-item { padding: 16px 12px; font-size: 13px; }
      .user-name { display: none; }
    }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  readonly authService = inject(OidcAuthService);
  private readonly contextService = inject(ContextPreservationService);
  private cleanupContext: (() => void) | null = null;

  ngOnInit(): void {
    this.cleanupContext = this.contextService.preserveContext('AppComponent');
  }

  ngOnDestroy(): void {
    this.cleanupContext?.();
  }

  onLogout(): void {
    this.authService.logout();
  }
}

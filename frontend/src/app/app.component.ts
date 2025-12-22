import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive
  ],
  template: `
    <div class="app-container">
      <nav class="app-nav">
        <div class="nav-brand">
          <h1>{{ title }}</h1>
        </div>
        <div class="nav-menu">
          <a
            class="nav-item"
            routerLink="/calendar"
            routerLinkActive="active">
            Calendario
          </a>
          <a
            class="nav-item"
            routerLink="/patients"
            routerLinkActive="active">
            Gestione Pazienti
          </a>
          <a
            class="nav-item"
            routerLink="/operatori"
            routerLinkActive="active">
            Operatori
          </a>
          <a
            class="nav-item"
            routerLink="/availability"
            routerLinkActive="active">
            Disponibilità
          </a>
          <a
            class="nav-item"
            routerLink="/conflicts"
            routerLinkActive="active">
            Conflitti
          </a>
          <a
            class="nav-item"
            routerLink="/settings"
            routerLinkActive="active">
            Impostazioni
          </a>
        </div>
      </nav>

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
      overflow: hidden;
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

    .app-content {
      flex: 1;
      background: #f5f5f5;
      overflow: auto;
      min-height: 0;
    }

    @media (max-width: 768px) {
      .nav-brand h1 {
        font-size: 18px;
      }

      .nav-item {
        padding: 16px 12px;
        font-size: 13px;
      }
    }
  `]
})
export class AppComponent {
  title = 'Calendario Poliambulatorio CDK';
}

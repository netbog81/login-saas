import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-whatsapp-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatTabsModule,
    MatIconModule,
  ],
  template: `
    <div class="whatsapp-layout">
      <div class="whatsapp-header">
        <mat-icon class="header-icon">chat</mat-icon>
        <h2>WhatsApp Gateway</h2>
      </div>

      <nav mat-tab-nav-bar [tabPanel]="tabPanel" class="whatsapp-nav">
        <a mat-tab-link
           routerLink="chat"
           routerLinkActive
           #rla0="routerLinkActive"
           [active]="rla0.isActive">
          <mat-icon>forum</mat-icon>
          <span>Chat</span>
        </a>
        <a mat-tab-link
           routerLink="monitor"
           routerLinkActive
           #rla1="routerLinkActive"
           [active]="rla1.isActive">
          <mat-icon>monitoring</mat-icon>
          <span>Monitor</span>
        </a>
        <a mat-tab-link
           routerLink="scheduled"
           routerLinkActive
           #rla4="routerLinkActive"
           [active]="rla4.isActive">
          <mat-icon>schedule_send</mat-icon>
          <span>In programma</span>
        </a>
        <a mat-tab-link
           routerLink="settings"
           routerLinkActive
           #rla2="routerLinkActive"
           [active]="rla2.isActive">
          <mat-icon>settings</mat-icon>
          <span>Configurazione</span>
        </a>
        <a mat-tab-link
           routerLink="log-management"
           routerLinkActive
           #rla3="routerLinkActive"
           [active]="rla3.isActive">
          <mat-icon>admin_panel_settings</mat-icon>
          <span>Gestione Log</span>
        </a>
      </nav>

      <mat-tab-nav-panel #tabPanel>
        <div class="whatsapp-content">
          <router-outlet></router-outlet>
        </div>
      </mat-tab-nav-panel>
    </div>
  `,
  styles: [`
    .whatsapp-layout {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: auto;
    }

    .whatsapp-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px 0;
      background: white;
    }

    .whatsapp-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
      color: #333;
    }

    .header-icon {
      color: #25d366;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .whatsapp-nav {
      background: white;
    }

    .whatsapp-nav a {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .whatsapp-content {
      flex: 1;
      padding: 24px;
      overflow: auto;
    }

    @media (max-width: 768px) {
      .whatsapp-header {
        padding: 12px 16px 0;
      }

      .whatsapp-header h2 {
        font-size: 18px;
      }

      .whatsapp-content {
        padding: 16px;
      }
    }
  `],
})
export class WhatsappLayoutComponent {}

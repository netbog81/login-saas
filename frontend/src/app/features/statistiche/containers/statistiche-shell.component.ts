import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

/**
 * Shell della sezione Statistiche: barra a tab (Voucher FE | Conti FE |
 * No Show) sopra le sotto-pagine. Le sotto-sezioni sono feature lazy
 * autonome.
 */
@Component({
  selector: 'app-statistiche-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule],
  template: `
    <nav class="stats-tabs">
      <a routerLink="voucher-fe" routerLinkActive="active">
        <mat-icon>card_giftcard</mat-icon>
        Voucher FE
      </a>
      <a routerLink="conti-fe" routerLinkActive="active">
        <mat-icon>groups</mat-icon>
        Conti FE
      </a>
      <a routerLink="no-show" routerLinkActive="active">
        <mat-icon>person_off</mat-icon>
        No Show
      </a>
    </nav>
    <router-outlet />
  `,
  styles: [`
    :host { display: block; }
    .stats-tabs {
      display: flex; gap: 4px; padding: 8px 24px 0;
      border-bottom: 1px solid rgba(0,0,0,0.12);
      background: #fff;
    }
    .stats-tabs a {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 16px; text-decoration: none;
      color: rgba(0,0,0,0.65); font-size: 14px; font-weight: 500;
      border-bottom: 2px solid transparent; margin-bottom: -1px;
    }
    .stats-tabs a mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .stats-tabs a.active {
      color: #3f51b5; border-bottom-color: #3f51b5;
    }
    .stats-tabs a:hover { color: rgba(0,0,0,0.85); }
  `],
})
export class StatisticheShellComponent {}

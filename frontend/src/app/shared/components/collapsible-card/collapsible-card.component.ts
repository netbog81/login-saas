/**
 * Collapsible Card
 * Layer 1: Dumb Component
 *
 * Riquadro con intestazione cliccabile che apre e chiude il proprio contenuto.
 *
 * Nasce per i due modi di sincronizzare l'agenda — abbonamento ICS e account
 * Google — che stanno nella stessa scheda e insieme occupano piu' schermo di
 * quanto meritino: chi apre un operatore quasi sempre viene per altro. Chiusi,
 * la riga di intestazione con il pastiglia di stato dice gia' l'essenziale
 * ("Attivo", "Collegato") senza far scorrere nulla.
 *
 * Lo stato aperto/chiuso e' apparenza, non dato: vive qui e non risale al
 * padre, che non ha motivo di saperlo.
 */

import {
  Component, Input, ChangeDetectionStrategy, OnChanges, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type CollapsibleCardTone = 'on' | 'off' | 'warn' | 'error';

@Component({
  selector: 'app-collapsible-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
  template: `
    <section class="cc-card" [class.cc-open]="open">
      <!-- <button> e non <div>: si apre da tastiera e lo screen reader lo
           annuncia come comando, con lo stato che porta con se'. -->
      <button type="button"
              class="cc-head"
              [attr.aria-expanded]="open"
              (click)="toggle()">
        <mat-icon class="cc-icon" [ngClass]="'cc-icon-' + tone">{{ icon }}</mat-icon>

        <span class="cc-titles">
          <span class="cc-title">{{ title }}</span>
          <span class="cc-sub" *ngIf="subtitle">{{ subtitle }}</span>
        </span>

        <span class="cc-badge" *ngIf="badge" [ngClass]="'cc-badge-' + tone">{{ badge }}</span>

        <mat-icon class="cc-chevron">expand_more</mat-icon>
      </button>

      <div class="cc-body" *ngIf="open">
        <ng-content></ng-content>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }

    .cc-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #fff;
      overflow: hidden;
      transition: border-color .15s ease, box-shadow .15s ease;
    }
    .cc-card.cc-open { border-color: #cbd5e1; box-shadow: 0 1px 3px rgba(15, 23, 42, .06); }

    .cc-head {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      background: transparent;
      border: 0;
      cursor: pointer;
      text-align: left;
      font: inherit;
      color: inherit;
    }
    .cc-head:hover { background: #f8fafc; }
    .cc-head:focus-visible { outline: 2px solid #6366f1; outline-offset: -2px; }

    .cc-icon { flex: 0 0 auto; }
    .cc-icon-on { color: #16a34a; }
    .cc-icon-off { color: #64748b; }
    .cc-icon-warn { color: #d97706; }
    .cc-icon-error { color: #dc2626; }

    .cc-titles { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
    .cc-title { font-weight: 600; color: #1e293b; line-height: 1.3; }
    .cc-sub {
      font-size: .78rem;
      color: #64748b;
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cc-badge {
      flex: 0 0 auto;
      font-size: .72rem;
      font-weight: 600;
      padding: 3px 9px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .cc-badge-on { background: #dcfce7; color: #166534; }
    .cc-badge-off { background: #f1f5f9; color: #475569; }
    .cc-badge-warn { background: #fef3c7; color: #92400e; }
    .cc-badge-error { background: #fee2e2; color: #991b1b; }

    .cc-chevron {
      flex: 0 0 auto;
      color: #94a3b8;
      transition: transform .18s ease;
    }
    .cc-open .cc-chevron { transform: rotate(180deg); }

    .cc-body { padding: 0 14px 14px; border-top: 1px solid #f1f5f9; padding-top: 12px; }

    /* Su schermo stretto il sottotitolo e' il primo a diventare rumore:
       il titolo e la pastiglia bastano a capire dove si e'. */
    @media (max-width: 480px) {
      .cc-sub { display: none; }
      .cc-head { padding: 10px 12px; gap: 8px; }
    }
  `],
})
export class CollapsibleCardComponent implements OnChanges {
  @Input() icon = 'settings';
  @Input() title = '';
  @Input() subtitle = '';
  @Input() badge: string | null = null;
  @Input() tone: CollapsibleCardTone = 'off';

  /**
   * Se il riquadro debba mostrarsi gia' aperto.
   *
   * Segue l'input finche' nessuno ha toccato l'intestazione. Non basta
   * guardare il primo cambiamento: al primo giro lo stato e' ancora in
   * caricamento e arriva sempre `false`, cosi' il riquadro davvero attivo non
   * si aprirebbe mai da solo. Dal primo clic in poi comanda l'utente, e un
   * aggiornamento dei dati non gli richiude in faccia quello che stava
   * leggendo.
   */
  @Input() expanded = false;

  open = false;

  private userToggled = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['expanded'] && !this.userToggled) {
      this.open = this.expanded;
    }
  }

  toggle(): void {
    this.userToggled = true;
    this.open = !this.open;
  }
}

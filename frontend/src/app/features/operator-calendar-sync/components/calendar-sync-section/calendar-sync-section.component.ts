/**
 * Calendar Sync Section
 * Layer 1: Dumb Component
 *
 * Il riquadro "Sincronizzazione agenda" della scheda operatore: raccoglie in
 * un posto solo la parte comune — cosa di un paziente esce dal gestionale — e
 * sotto i due modi di portare l'agenda sul telefono.
 *
 * Sta insieme perche' la decisione di riservatezza e' UNA e vale per
 * entrambi: separarla per canale inviterebbe a pensare che si possa mostrare
 * il nome "solo su Google", cosa che non esiste. I due modi invece sono
 * alternativi e vanno letti come tali, non come una lista di campi.
 *
 * Solo struttura e proiezione di contenuto: nessuna logica, nessun @Input.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-calendar-sync-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
  template: `
    <section class="sync-section">
      <header class="sync-head">
        <mat-icon class="sync-icon">event_available</mat-icon>
        <div class="sync-titles">
          <h4 class="sync-title">Sincronizzazione agenda</h4>
          <p class="sync-sub">
            L'operatore ritrova i propri appuntamenti nel calendario del telefono.
            Due modi, si possono usare anche insieme.
          </p>
        </div>
      </header>

      <!-- Parte comune, in alto: vale per entrambi i modi qui sotto. -->
      <div class="sync-common">
        <ng-content select="[syncCommon]"></ng-content>
      </div>

      <div class="sync-methods">
        <ng-content select="[syncIcs]"></ng-content>
        <ng-content select="[syncGoogle]"></ng-content>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }

    .sync-section {
      border: 1px solid #dbe3ec;
      border-radius: 12px;
      background: #f8fafc;
      padding: 14px;
    }

    .sync-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
    .sync-icon { color: #0284c7; flex: 0 0 auto; }
    .sync-titles { min-width: 0; }
    .sync-title { margin: 0; font-size: 1rem; font-weight: 600; color: #0f172a; }
    .sync-sub { margin: 2px 0 0; font-size: .8rem; color: #64748b; line-height: 1.4; }

    .sync-common { margin-bottom: 14px; }

    /* Separatore etichettato: dice che qui sotto si sceglie COME, dopo aver
       deciso COSA. Senza, i due riquadri sembrerebbero altre due opzioni
       della privacy. */
    .sync-methods {
      display: flex;
      flex-direction: column;
      gap: 10px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 14px;
      position: relative;
    }
    .sync-methods::before {
      content: 'Come arriva sul telefono';
      position: absolute;
      top: -9px;
      left: 10px;
      padding: 0 8px;
      background: #f8fafc;
      font-size: .7rem;
      font-weight: 600;
      letter-spacing: .03em;
      text-transform: uppercase;
      color: #94a3b8;
    }

    @media (max-width: 480px) {
      .sync-section { padding: 12px 10px; }
    }
  `],
})
export class CalendarSyncSectionComponent {}

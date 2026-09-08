/**
 * Operator Sync Badges
 * Layer 1: Dumb Component
 *
 * Riga di pastiglie nella card dell'operatore: da dove riceve l'agenda, e cosa
 * gli manca in scheda perché possa riceverla.
 *
 * Sta nell'elenco e non solo dentro la scheda perché la domanda "chi è
 * coperto e chi no" si fa guardando tutti insieme: aprire venti schede per
 * scoprire che a tre manca il telefono non lo fa nessuno.
 *
 * Solo @Input, nessuna logica di dominio, nessun GraphQL.
 */

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OperatorSyncSummary } from '../../models/operator-google-calendar.model';

@Component({
  selector: 'app-operator-sync-badges',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="osb-row" *ngIf="summary || !hasEmail || !hasPhone">
      @if (summary?.feedEnabled) {
        <span class="osb osb-on" matTooltip="Abbonamento al calendario attivo (iPhone, Android, Outlook)">
          <mat-icon>rss_feed</mat-icon> ICS
        </span>
      }

      @if (summary?.googleNeedsReconnect) {
        <span class="osb osb-bad" matTooltip="L'autorizzazione è scaduta: il calendario non si aggiorna più">
          <mat-icon>sync_problem</mat-icon> Google da ricollegare
        </span>
      } @else if (summary?.googleConnected) {
        <span class="osb osb-on"
              [matTooltip]="googleTooltip">
          <mat-icon>sync</mat-icon>
          Google{{ daysSuffix }}
        </span>
      } @else if (summary?.declaredEmail) {
        <!-- Indirizzo inserito ma mai autorizzato: è in attesa della persona,
             non una dimenticanza dell'amministratore. -->
        <span class="osb osb-wait" [matTooltip]="'Indirizzo indicato (' + summary?.declaredEmail + '), autorizzazione non ancora data'">
          <mat-icon>hourglass_empty</mat-icon> Google da autorizzare
        </span>
      }

      <!-- Recapiti mancanti: non è un errore, è una cosa da sapere. Senza
           email non parte l'avviso per posta, senza numero non parte WhatsApp. -->
      @if (!hasEmail) {
        <span class="osb osb-miss" matTooltip="Senza email non può ricevere avvisi per posta">
          <mat-icon>mail_off</mat-icon> manca email
        </span>
      }
      @if (!hasPhone) {
        <span class="osb osb-miss" matTooltip="Senza numero non può ricevere avvisi su WhatsApp">
          <mat-icon>phone_disabled</mat-icon> manca telefono
        </span>
      }
    </div>

    <!-- L'indirizzo Google in chiaro, non solo nel suggerimento: è la cosa
         che si va a cercare — con quale account è collegato — e nasconderla
         dietro il passaggio del mouse la rende invisibile a chi scorre
         l'elenco, e del tutto irraggiungibile da telefono. È anche un campo
         DIVERSO dall'email dell'operatore mostrata qui sopra: possono
         coincidere, ma non è detto. -->
    <p class="osb-account" *ngIf="googleAccount">
      <mat-icon>account_circle</mat-icon>
      <span class="osb-account-value">{{ googleAccount }}</span>
    </p>
  `,
  styles: [`
    :host { display: block; }
    .osb-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .osb {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: .7rem; font-weight: 600; padding: 3px 8px;
      border-radius: 999px; white-space: nowrap; line-height: 1.4;
    }
    .osb mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .osb-on { background: #dcfce7; color: #166534; }
    .osb-wait { background: #ede9fe; color: #5b21b6; }
    .osb-bad { background: #fee2e2; color: #991b1b; }
    /* Volutamente tenue: è un promemoria, non un allarme. */
    .osb-miss { background: #f8fafc; color: #94a3b8; border: 1px dashed #cbd5e1; }

    .osb-account {
      display: flex; align-items: center; gap: 4px;
      font-size: .72rem; color: #64748b; margin: 6px 0 0; min-width: 0;
    }
    .osb-account mat-icon { font-size: 14px; width: 14px; height: 14px; flex: 0 0 auto; }
    /* Un indirizzo lungo non deve allargare la card: si accorcia in coda. */
    .osb-account-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `],
})
export class OperatorSyncBadgesComponent {
  @Input() summary: OperatorSyncSummary | null = null;
  @Input() hasEmail = true;
  @Input() hasPhone = true;

  /**
   * L'account Google da mostrare: quello che ha autorizzato, o in mancanza
   * quello dichiarato dall'amministratore e ancora in attesa di consenso.
   */
  get googleAccount(): string | null {
    return this.summary?.googleEmail || this.summary?.declaredEmail || null;
  }

  get googleTooltip(): string {
    const chi = this.summary?.googleEmail ? `Collegato con ${this.summary.googleEmail}` : 'Collegato';
    const giorni = this.summary?.googleDaysLeft;
    return giorni === null || giorni === undefined
      ? chi
      : `${chi} — il permesso vale ancora ${giorni} giorni`;
  }

  /** I giorni si mostrano solo quando stanno per finire: prima sono rumore. */
  get daysSuffix(): string {
    const giorni = this.summary?.googleDaysLeft;
    if (giorni === null || giorni === undefined || giorni > 2) return '';
    return giorni <= 0 ? ' · oggi' : ` · ${giorni}g`;
  }
}

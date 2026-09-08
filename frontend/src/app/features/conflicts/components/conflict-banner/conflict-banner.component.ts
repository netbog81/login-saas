/**
 * Conflict Banner
 * Layer 1: Dumb Component (presentazionale, OnPush)
 *
 * Il riquadro rosso che spiega un conflitto e offre le azioni per chiuderlo.
 * Usato in tre posti con la stessa forma: in cima al dialog di modifica
 * (operatori e palestra) e dentro i riquadri di riepilogo.
 *
 * DUE AZIONI INLINE, LE ALTRE NEL DIALOG. Accetta e Sposta coprono la quasi
 * totalità dei casi e meritano un click solo; riprogrammazione manuale,
 * cancellazione e nota di risoluzione stanno dietro "Gestisci", perché sono
 * scelte che richiedono di compilare qualcosa e un banner non è il posto per
 * un form. È anche il motivo per cui questo componente non conosce le
 * mutation: emette intenzioni, le esegue il container.
 *
 * `compact` serve ai riquadri di riepilogo, dove lo spazio è quello di un
 * popover: sparisce la descrizione estesa e restano motivo e azioni.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  ConflictInfo,
  conflictReasonLabel,
  conflictReasonDescription,
} from '../../models/conflict.model';

/** Intenzione emessa dal banner verso il container (Layer 2). */
export type ConflictBannerAction = 'accept' | 'move' | 'manage';

@Component({
  selector: 'app-conflict-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    @if (conflict?.hasConflict) {
      <div class="conflict-banner" [class.compact]="compact" role="alert">
        <mat-icon class="banner-icon">warning</mat-icon>

        <div class="banner-body">
          <div class="banner-title">{{ label }}</div>

          @if (!compact) {
            <div class="banner-text">{{ description }}</div>
          }

          @if (detectedLabel) {
            <div class="banner-meta">Rilevato il {{ detectedLabel }}</div>
          }
        </div>

        @if (!readOnly) {
          <div class="banner-actions">
            <button mat-flat-button type="button" class="btn-accept"
                    matTooltip="Mantieni l'appuntamento dov'è e togli la segnalazione"
                    (click)="action.emit('accept')">
              <mat-icon>check</mat-icon>
              Accetta
            </button>

            @if (canMove) {
              <button mat-stroked-button type="button"
                      [matTooltip]="moveTooltip"
                      (click)="action.emit('move')">
                <mat-icon>swap_horiz</mat-icon>
                Sposta
              </button>
            }

            <button mat-stroked-button type="button"
                    matTooltip="Riprogramma a mano, cancella, o aggiungi una nota"
                    (click)="action.emit('manage')">
              <mat-icon>tune</mat-icon>
              Gestisci
            </button>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .conflict-banner {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      margin-bottom: 16px;
      border: 1px solid #fca5a5;
      border-left: 4px solid #dc2626;
      border-radius: 8px;
      background: #fef2f2;
      color: #7f1d1d;
    }

    .conflict-banner.compact {
      padding: 8px 10px;
      gap: 8px;
      margin-bottom: 8px;
    }

    .banner-icon {
      flex: 0 0 auto;
      color: #dc2626;
    }

    .banner-body {
      /* Senza min-width:0 il testo lungo sfonda il flex e il dialog prende
         lo scroll orizzontale invece di andare a capo. */
      flex: 1 1 220px;
      min-width: 0;
    }

    .banner-title {
      font-weight: 600;
      font-size: 0.9375rem;
      line-height: 1.3;
    }

    .banner-text {
      margin-top: 4px;
      font-size: 0.8125rem;
      line-height: 1.4;
      color: #991b1b;
    }

    .banner-meta {
      margin-top: 4px;
      font-size: 0.75rem;
      color: #b91c1c;
      opacity: 0.85;
    }

    .banner-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      /* Va a capo sotto il testo quando il dialog si stringe, invece di
         schiacciare i pulsanti fino a renderli illeggibili. */
      flex: 0 1 auto;
    }

    .banner-actions button {
      /* Material impone 64px minimi: con l'icona dentro i pulsanti brevi
         restano comunque leggibili solo alzando la densità del testo. */
      font-size: 0.8125rem;
      line-height: 32px;
      padding: 0 12px;
      min-width: 0;
    }

    .banner-actions mat-icon {
      font-size: 17px;
      width: 17px;
      height: 17px;
      margin-right: 4px;
      vertical-align: middle;
    }

    .btn-accept {
      background: #dc2626;
      color: #fff;
    }

    @media (max-width: 599px) {
      .banner-actions {
        width: 100%;
      }

      .banner-actions button {
        flex: 1 1 auto;
      }
    }
  `],
})
export class ConflictBannerComponent {
  @Input() conflict: ConflictInfo | null = null;

  /** Nasconde le azioni: consultazione in sola lettura. */
  @Input() readOnly = false;

  /** Riduce il riquadro per i popover di riepilogo. */
  @Input() compact = false;

  /**
   * "Sposta" è offerto solo dove esiste un pannello di ricerca slot che sappia
   * cosa proporre. In palestra cerca slot liberi per sala, nella vista
   * operatori per operatore: sono due pannelli diversi, e dove non c'è né
   * l'uno né l'altro il pulsante non deve comparire.
   */
  @Input() canMove = true;

  /** Testo del tooltip di "Sposta": cambia fra vista operatori e palestra. */
  @Input() moveTooltip = 'Cerca uno slot libero e spostalo lì';

  @Output() action = new EventEmitter<ConflictBannerAction>();

  get label(): string {
    return conflictReasonLabel(this.conflict?.reason);
  }

  get description(): string {
    return conflictReasonDescription(this.conflict?.reason);
  }

  get detectedLabel(): string | null {
    const raw = this.conflict?.detectedAt;
    if (!raw) return null;
    const d = raw instanceof Date ? raw : new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}

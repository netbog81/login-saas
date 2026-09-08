/**
 * Conflict Badge
 * Layer 1: Dumb Component (presentazionale, OnPush)
 *
 * Il triangolo di allarme che segnala un appuntamento in conflitto, dentro il
 * chip del calendario operatori e il mini-chip della palestra.
 *
 * Vive in spazi minuscoli — chip alti 18px in modalità compatta — quindi:
 * non ha padding proprio, non ha background, e la dimensione è un @Input
 * invece che una media query: chi lo ospita sa quanto spazio c'è, lui no.
 *
 * L'accento visivo è un doppio contorno (icona rossa + alone bianco) perché
 * il chip sotto ha il colore dell'operatore, che può essere qualsiasi cosa,
 * rosso compreso. Senza l'alone il triangolo sparirebbe proprio sugli
 * operatori dal colore più simile.
 */

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConflictInfo, conflictReasonLabel } from '../../models/conflict.model';

@Component({
  selector: 'app-conflict-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    @if (conflict?.hasConflict) {
      <mat-icon
        class="conflict-badge"
        [class.size-sm]="size === 'sm'"
        [class.size-lg]="size === 'lg'"
        [matTooltip]="tooltip"
        matTooltipPosition="above"
        aria-hidden="false"
        [attr.aria-label]="tooltip">warning</mat-icon>
    }
  `,
  styles: [`
    .conflict-badge {
      /* Material dà a mat-icon 24px fissi in tre proprietà diverse: senza
         sovrascriverle tutte e tre il chip si deforma. */
      font-size: 15px;
      width: 15px;
      height: 15px;
      line-height: 15px;
      flex: 0 0 auto;
      color: #dc2626;
      /* Alone chiaro: il chip sotto ha il colore dell'operatore, che può
         essere rosso quanto il triangolo. */
      text-shadow:
        0 0 2px #fff, 0 0 2px #fff, 0 0 3px rgba(255, 255, 255, 0.9);
      cursor: help;
    }

    .conflict-badge.size-sm {
      font-size: 12px;
      width: 12px;
      height: 12px;
      line-height: 12px;
    }

    .conflict-badge.size-lg {
      font-size: 20px;
      width: 20px;
      height: 20px;
      line-height: 20px;
    }
  `],
})
export class ConflictBadgeComponent {
  @Input() conflict: ConflictInfo | null = null;

  /** Dimensione del triangolo: la sceglie chi lo ospita, in base allo spazio. */
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  get tooltip(): string {
    return `Conflitto: ${conflictReasonLabel(this.conflict?.reason)}`;
  }
}

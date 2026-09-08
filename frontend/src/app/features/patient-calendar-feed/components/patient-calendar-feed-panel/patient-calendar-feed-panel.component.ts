/**
 * Patient Calendar Feed Panel
 * Layer 1: Dumb Component
 *
 * Riquadro "Calendario del paziente" nella scheda appuntamenti: dice se il
 * paziente riceve i propri appuntamenti sul telefono, e permette di mandargli
 * o rimandargli il link, o di togliergli la sottoscrizione.
 *
 * La distinzione fra "inviato" e "attivo sul telefono" è mostrata di
 * proposito: sono due cose diverse — la mail può essere finita nello spam, o
 * il paziente può non aver completato i passaggi — e senza vederle la
 * segreteria non saprebbe se rimandare il link o no.
 *
 * Solo @Input/@Output, nessuna logica, nessun GraphQL.
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import {
  PatientCalendarFeedStatus,
  PatientCalendarFeedState,
  FEED_STATE_LABELS,
  FEED_STATE_ICONS,
  REVOKED_BY_LABELS,
  feedState,
} from '../../models/patient-calendar-feed.model';

@Component({
  selector: 'app-patient-calendar-feed-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule,
    MatProgressSpinnerModule, MatFormFieldModule, MatInputModule, MatExpansionModule,
  ],
  template: `
    <div class="cal-panel">
      <div class="cal-header">
        <mat-icon class="cal-icon" [class.on]="state() === 'subscribed'">
          {{ stateIcon() }}
        </mat-icon>
        <div class="cal-title">
          <span class="cal-name">Calendario del paziente</span>
          <span class="cal-sub">{{ stateLabel() }}</span>
        </div>
        @if (loading) {
          <mat-spinner diameter="20"></mat-spinner>
        }
      </div>

      @if (error) {
        <!-- Un errore di lettura non deve somigliare a "mai inviato": chi lo
             legge rimanderebbe un link che magari il paziente ha già. -->
        <p class="cal-warning">
          <mat-icon>error_outline</mat-icon>
          <span>Impossibile leggere lo stato.<br><small>{{ error }}</small></span>
        </p>
      } @else if (!loading) {
        @switch (state()) {
          @case ('none') {
            <p class="cal-explain">
              Il paziente può ricevere i propri appuntamenti sul calendario del
              telefono. Gli arriva <strong>una email sola</strong>: da lì in poi il
              calendario si aggiorna da solo a ogni spostamento o disdetta.
            </p>
          }
          @case ('sent') {
            <p class="cal-explain">
              Link inviato {{ status?.emailSentTo ? 'a ' + status?.emailSentTo : '' }}
              il {{ status?.emailSentAt | date: 'dd/MM/yyyy HH:mm' }}, ma il calendario
              non è ancora stato aggiunto a nessun telefono.
            </p>
            <p class="cal-hint">
              Può essere finito nello spam, oppure il paziente non ha completato
              i passaggi. Chi usa Google deve farlo <strong>una volta da computer</strong>:
              l'app di Google Calendar non sa aggiungere un calendario da un indirizzo.
            </p>
          }
          @case ('subscribed') {
            <p class="cal-explain">
              Attivo dal {{ status?.subscribedAt | date: 'dd/MM/yyyy' }}. Il calendario
              del paziente si aggiorna da solo: non serve avvisarlo degli spostamenti
              per questa via.
            </p>
            @if (status?.lastAccessAt) {
              <p class="cal-hint">
                Ultimo aggiornamento scaricato il
                {{ status?.lastAccessAt | date: 'dd/MM/yyyy HH:mm' }}.
              </p>
            }
          }
          @case ('revoked') {
            <p class="cal-explain">
              Revocato il {{ status?.revokedAt | date: 'dd/MM/yyyy' }}
              {{ revokedByLabel() }}. Il link non funziona più.
            </p>
            @if (status?.revokedBy === 'patient') {
              <p class="cal-hint">
                Si è tolto da solo dal link in fondo all'email: rimandarglielo
                senza che l'abbia chiesto non è una buona idea.
              </p>
            }
          }
        }

        <div class="cal-actions">
          <button mat-flat-button color="primary" [disabled]="sending"
                  (click)="sendLink.emit(altEmail.trim() || undefined)">
            <mat-icon>{{ state() === 'none' ? 'send' : 'refresh' }}</mat-icon>
            {{ state() === 'none' ? 'Invia il link' : 'Rimanda il link' }}
          </button>

          @if (status?.active) {
            <button mat-stroked-button [disabled]="sending" (click)="revoke.emit()">
              <mat-icon>block</mat-icon>
              Revoca
            </button>
          }
        </div>

        <mat-expansion-panel class="cal-alt" [expanded]="false">
          <mat-expansion-panel-header>
            <mat-panel-title>Manda a un altro indirizzo</mat-panel-title>
          </mat-expansion-panel-header>
          <mat-form-field appearance="outline" class="cal-email">
            <mat-label>Email</mat-label>
            <input matInput type="email" [(ngModel)]="altEmail"
                   placeholder="lascia vuoto per usare quella in anagrafica">
          </mat-form-field>
          <p class="cal-hint">
            Serve solo per questo invio: l'indirizzo dell'anagrafica non cambia.
          </p>
        </mat-expansion-panel>
      }
    </div>
  `,
  styles: [`
    .cal-panel { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #fff; }
    .cal-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .cal-icon { color: #94a3b8; }
    .cal-icon.on { color: #16a34a; }
    .cal-title { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .cal-name { font-weight: 600; font-size: 0.95rem; }
    .cal-sub { font-size: 0.78rem; color: #64748b; }
    .cal-explain { font-size: 0.86rem; line-height: 1.45; margin: 0 0 8px; color: #334155; }
    .cal-hint { font-size: 0.78rem; line-height: 1.45; color: #64748b; margin: 0 0 8px; }
    .cal-warning { display: flex; gap: 8px; align-items: flex-start; font-size: 0.82rem;
                   color: #92400e; background: #fffbeb; border: 1px solid #fde68a;
                   border-radius: 6px; padding: 8px 10px; }
    .cal-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
    .cal-alt { box-shadow: none !important; border: none; margin-top: 8px; }
    .cal-email { width: 100%; }
  `],
})
export class PatientCalendarFeedPanelComponent {
  @Input() status: PatientCalendarFeedStatus | null = null;
  @Input() loading = false;
  @Input() sending = false;
  @Input() error: string | null = null;

  /** Indirizzo alternativo, valido solo per questo invio. */
  @Output() sendLink = new EventEmitter<string | undefined>();
  @Output() revoke = new EventEmitter<void>();

  altEmail = '';

  state(): PatientCalendarFeedState {
    return this.status ? feedState(this.status) : 'none';
  }

  stateLabel(): string {
    return FEED_STATE_LABELS[this.state()];
  }

  stateIcon(): string {
    return FEED_STATE_ICONS[this.state()];
  }

  revokedByLabel(): string {
    const by = this.status?.revokedBy;
    return by ? REVOKED_BY_LABELS[by] : '';
  }
}

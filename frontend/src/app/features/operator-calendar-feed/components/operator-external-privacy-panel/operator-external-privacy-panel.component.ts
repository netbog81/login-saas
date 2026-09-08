/**
 * Operator External Privacy Panel
 * Layer 1: Dumb Component
 *
 * Cosa esce dal gestionale e finisce nel calendario personale dell'operatore.
 *
 * Blocco a sé, e non dentro il pannello del feed ICS dov'era prima, per due
 * ragioni: vale per **entrambi** i canali (feed ICS e Google Calendar), e
 * stando dentro il feed era irraggiungibile per chi usa solo Google — cioè
 * proprio chi ne aveva bisogno.
 *
 * È una decisione sola, non due: "quanto di un paziente esce da qui" non
 * cambia a seconda di quale strada prende il calendario.
 *
 * Solo @Input/@Output, nessuna logica, nessun GraphQL.
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
  ViewChild, OnChanges, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule, MatSlideToggle } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-operator-external-privacy-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatSlideToggleModule, MatProgressSpinnerModule],
  template: `
    <div class="privacy-panel">
      <div class="privacy-header">
        <mat-icon class="privacy-icon">visibility</mat-icon>
        <div class="privacy-title">
          <span class="privacy-name">Cosa vede l'operatore nel suo calendario</span>
          <span class="privacy-sub">
            Vale per entrambi i modi qui sotto, ICS e Google
          </span>
        </div>
      </div>

      @if (loading) {
        <div class="privacy-state"><mat-spinner diameter="22"></mat-spinner></div>
      } @else {
        <div class="toggle-row">
          <mat-slide-toggle
            #nameSwitch
            [checked]="showPatientName"
            (change)="patientNameToggle.emit($event.checked)">
            Nome del paziente
          </mat-slide-toggle>
          <span class="toggle-hint">
            {{ showPatientName
                ? 'Gli appuntamenti riportano nome del paziente e servizio.'
                : 'Gli appuntamenti riportano solo il servizio e lo studio.' }}
          </span>
        </div>

        <div class="toggle-row">
          <mat-slide-toggle
            #phoneSwitch
            [checked]="showPatientPhone"
            (change)="patientPhoneToggle.emit($event.checked)">
            Numeri di telefono del paziente
          </mat-slide-toggle>
          <span class="toggle-hint">
            {{ showPatientPhone
                ? 'Cellulare e fisso compaiono nei dettagli degli appuntamenti futuri.'
                : 'Nessun numero nel calendario.' }}
          </span>
        </div>

        <p class="privacy-note">
          <mat-icon>privacy_tip</mat-icon>
          <span>
            Spenti, gli appuntamenti restano utili — orario, servizio, studio — e
            nessun dato del paziente lascia il gestionale.
          </span>
        </p>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .privacy-panel {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      background: #fff;
    }
    .privacy-header { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 10px; }
    .privacy-icon { color: #7c3aed; }
    .privacy-title { display: flex; flex-direction: column; }
    .privacy-name { font-weight: 600; color: #1e293b; }
    .privacy-sub { font-size: 0.78rem; color: #64748b; }
    .privacy-state { display: flex; justify-content: center; padding: 12px; }
    .toggle-row { display: flex; flex-direction: column; gap: 2px; margin-bottom: 10px; }
    .toggle-hint { font-size: 0.74rem; color: #64748b; padding-left: 2px; }
    .privacy-note {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 0.76rem;
      color: #475569;
      background: #f1f5f9;
      border-radius: 6px;
      padding: 8px 10px;
      margin: 0;
    }
    .privacy-note mat-icon { font-size: 17px; width: 17px; height: 17px; flex: 0 0 auto; }
  `],
})
export class OperatorExternalPrivacyPanelComponent implements OnChanges {
  @Input() showPatientName = false;
  @Input() showPatientPhone = false;
  @Input() loading = false;

  @Output() patientNameToggle = new EventEmitter<boolean>();
  @Output() patientPhoneToggle = new EventEmitter<boolean>();

  @ViewChild('nameSwitch') nameSwitch?: MatSlideToggle;
  @ViewChild('phoneSwitch') phoneSwitch?: MatSlideToggle;

  /**
   * Riallinea gli interruttori allo stato che arriva dal padre.
   *
   * `mat-slide-toggle` cambia il proprio stato interno al clic, prima che il
   * padre abbia deciso. Se l'utente annulla l'avviso privacy il valore non
   * cambia (era false, resta false): Angular non vede differenze sul binding
   * e non ridisegna, lasciando l'interruttore acceso su un dato non vero.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showPatientName']) this.sync(this.nameSwitch, this.showPatientName);
    if (changes['showPatientPhone']) this.sync(this.phoneSwitch, this.showPatientPhone);
  }

  private sync(toggle: MatSlideToggle | undefined, target: boolean): void {
    if (toggle && toggle.checked !== target) toggle.checked = target;
  }
}

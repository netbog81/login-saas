/**
 * Diagnostics Panel
 * Layer 1: Dumb Component
 *
 * Cosa i pazienti non hanno ricevuto, e chi va riavvisato.
 *
 * Raggruppato per persona e non per appuntamento perché è l'unità in cui il
 * problema si ripara: chi ha otto appuntamenti scoperti riceverà UN riepilogo
 * con otto righe, non otto messaggi. Un elenco piatto di ottantuno righe
 * suggerirebbe ottantuno invii, che è esattamente il modo di farsi bloccare
 * il numero.
 *
 * Solo @Input/@Output: la selezione la tiene il container.
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import {
  CATEGORY_NAMES, CONTACT_WARNINGS, ISSUE_LABELS, WINDOW_CHOICES,
  PatientNotificationIssues, PhoneNumberIssue, WhatsappDiagnostics,
} from '../../models/whatsapp-diagnostics.model';

@Component({
  selector: 'app-diagnostics-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, MatIconModule, MatButtonModule, MatCheckboxModule,
    MatSelectModule, MatFormFieldModule, MatProgressSpinnerModule, MatTooltipModule,
    RouterLink,
  ],
  template: `
    <div class="dg-wrap">
      <!-- La causa a monte, prima di tutto il resto: finché una categoria non
           ha canali, riavvisare i singoli pazienti non serve a niente — il
           reinvio verrebbe scartato come l'invio originale. -->
      @if (data?.uncoveredCategories?.length) {
        <div class="dg-alarm">
          <mat-icon>report</mat-icon>
          <div>
            <strong>Questi messaggi non partono da nessun canale.</strong>
            <p>
              @for (c of data!.uncoveredCategories; track c; let last = $last) {
                {{ categoryNames[c] || c }}{{ last ? '' : ', ' }}
              }
              — nessun canale acceso li porta. Finché resta così, anche i
              reinvii verranno scartati in silenzio.
            </p>
            <button mat-flat-button color="warn" (click)="openSettings.emit()">
              <mat-icon>settings</mat-icon>
              Vai alle impostazioni dei canali
            </button>
          </div>
        </div>
      }

      <div class="dg-bar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dg-window">
          <mat-label>Prenotazioni degli</mat-label>
          <mat-select [value]="data?.windowDays ?? 7"
                      [disabled]="loading"
                      (selectionChange)="windowChange.emit($event.value)">
            @for (w of windowChoices; track w.days) {
              <mat-option [value]="w.days">{{ w.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <button mat-stroked-button [disabled]="loading" (click)="refresh.emit()">
          <mat-icon>refresh</mat-icon> Ricontrolla
        </button>

        @if (data) {
          <span class="dg-when">
            Controllato alle {{ data.generatedAt | date:'HH:mm:ss' }}
          </span>
        }
      </div>

      @if (loading) {
        <div class="dg-state"><mat-spinner diameter="30"></mat-spinner></div>
      } @else if (error) {
        <p class="dg-error">
          <mat-icon>error_outline</mat-icon>
          <span>Controllo non riuscito.<br><small>{{ error }}</small></span>
        </p>
      } @else if (data) {

        <div class="dg-tiles">
          @for (t of tiles; track t.kind) {
            @if (t.value > 0) {
              <div class="tile" [class.tile-alta]="t.severity === 'alta'">
                <mat-icon>{{ t.icon }}</mat-icon>
                <span class="tile-num">{{ t.value }}</span>
                <span class="tile-name">{{ t.name }}</span>
                <span class="tile-eff">{{ t.effect }}</span>
                <!-- La riga che mancava: cosa deve fare chi legge. Senza,
                     la pagina descrive un guaio e lascia lì chi la guarda. -->
                <span class="tile-act">
                  <mat-icon>arrow_forward</mat-icon>{{ t.action }}
                </span>
              </div>
            }
          }
        </div>

        <!-- Dati sporchi, non messaggi mancati: si riparano aprendo
             l'appuntamento, non premendo "rimanda". Per questo stanno in un
             riquadro loro e non fra le righe da selezionare. -->
        @if (data.phoneIssues.length) {
          <div class="ph-box">
            <h4 class="ph-title">
              <mat-icon>dialpad</mat-icon>
              Telefoni scritti male <em>sull'appuntamento</em>
            </h4>
            <!-- Dirlo esplicitamente: senza questa riga si va a correggere
                 l'anagrafica, che e' il posto sbagliato — e' successo. Il
                 campo qui sotto vive sull'appuntamento e l'anagrafica non lo
                 tocca. -->
            <p class="ph-intro">
              Questo campo sta <strong>sull'appuntamento</strong>, non in anagrafica:
              correggere il recapito nell'anagrafica <strong>non lo cambia</strong>.
              Dove l'anagrafica ha un numero valido te lo mostro qui accanto e
              puoi riportarlo su tutti gli appuntamenti in un colpo solo.
            </p>
            @for (p of data.phoneIssues; track p.clientPhone) {
              <div class="ph-row">
                <span class="ph-who">{{ p.patientName || 'Senza nome' }}</span>
                <code class="ph-num">{{ p.clientPhone }}</code>
                <span class="ph-count">
                  su {{ p.appointments }}
                  {{ p.appointments === 1 ? 'appuntamento' : 'appuntamenti' }}
                </span>
                @if (p.registryPhone) {
                  <!-- Il numero vero, in chiaro: serve a confrontarlo con
                       quello sbagliato prima di sostituirlo. -->
                  <span class="ph-found">
                    <mat-icon>how_to_reg</mat-icon>
                    in anagrafica: <strong>{{ p.registryPhone }}</strong>
                  </span>
                  <button mat-flat-button color="primary" class="ph-fix"
                          [disabled]="resending"
                          (click)="applyRegistryPhone.emit(p)">
                    <mat-icon>sync_alt</mat-icon>
                    Usa questo numero
                  </button>
                } @else if (p.registryPhoneDirty) {
                  <!-- Sporco anche di là: sostituire non riparerebbe niente,
                       e il posto da cui ripartire è l'anagrafica. -->
                  <span class="ph-note ph-bad">
                    <mat-icon>report_problem</mat-icon>
                    anche in anagrafica c'è <code>{{ p.registryPhoneDirty }}</code>:
                    non è un numero valido. Correggilo prima lì, poi torna qui.
                  </span>
                } @else if (p.hasRegistryFallback) {
                  <span class="ph-note">
                    <mat-icon>edit_note</mat-icon>
                    in anagrafica non c'è un numero: aggiungilo lì, poi torna qui
                    e potrai riportarlo sugli appuntamenti
                  </span>
                } @else {
                  <span class="ph-note ph-bad">
                    <mat-icon>block</mat-icon>
                    nessuna anagrafica dietro: per questa persona non parte nulla
                  </span>
                }
              </div>
            }
          </div>
        }

        @if (!data.groups.length) {
          <p class="dg-ok">
            <mat-icon>check_circle</mat-icon>
            Nessun problema nella finestra scelta: ogni appuntamento futuro
            prenotato in questo periodo è stato comunicato.
          </p>
        } @else {
          <div class="dg-actions">
            <mat-checkbox
              [checked]="allSelected"
              [indeterminate]="someSelected && !allSelected"
              [disabled]="resending"
              (change)="toggleAll.emit($event.checked)">
              {{ selectedCount }} di {{ totalAppointments }} appuntamenti selezionati
            </mat-checkbox>

            <button mat-flat-button color="primary"
                    [disabled]="!selectedCount || resending"
                    (click)="resend.emit()">
              @if (resending) {
                <mat-spinner diameter="18"></mat-spinner>
                Reinvio in corso…
              } @else {
                <mat-icon>send</mat-icon>
                Rimanda le conferme
              }
            </button>
          </div>

          <div class="dg-groups">
            @for (g of data.groups; track g.patientId || g.appointments[0].appointmentId) {
              <div class="grp">
                <div class="grp-head">
                  <mat-checkbox
                    [checked]="isGroupSelected(g)"
                    [indeterminate]="isGroupPartial(g)"
                    [disabled]="resending"
                    (change)="toggleGroup.emit(g)">
                  </mat-checkbox>
                  <div class="grp-who">
                    <span class="grp-name">{{ g.patientName || 'Senza nome' }}</span>
                    @if (g.phoneNumber) {
                      <span class="grp-phone">{{ g.phoneNumber }}</span>
                    }
                  </div>

                  <!-- Da qui si va a sistemare: l'anagrafica e' il posto dove
                       si aggiunge o si corregge il recapito. -->
                  <span class="grp-links">
                    @if (registryUrl(g); as url) {
                      <a mat-icon-button
                         [href]="url" target="_blank" rel="noopener"
                         matTooltip="Apri l'anagrafica di questa persona"
                         matTooltipPosition="above">
                        <mat-icon>badge</mat-icon>
                      </a>
                    }
                    <a mat-icon-button
                       routerLink="/patients" target="_blank"
                       matTooltip="Apri l'elenco pazienti del clinico"
                       matTooltipPosition="above">
                      <mat-icon>groups</mat-icon>
                    </a>
                  </span>
                  <!-- Il conteggio qui è il punto: dice che a questa persona
                       arriverà UN messaggio con N righe. -->
                  <!-- Chi non ha mai ricevuto niente quasi sempre non ha un
                       numero in anagrafica: il reinvio fallirebbe, e la
                       riparazione vera e' aggiungere il recapito. Dirlo prima
                       del clic, non dopo. -->
                  @if (contactWarnings[g.contactState]; as w) {
                    <span class="grp-never" [class.grp-grave]="w.level === 'grave'">
                      <mat-icon>{{ w.icon }}</mat-icon>
                      {{ w.text }}
                    </span>
                  }
                  <span class="grp-count"
                        matTooltip="Riceverà un solo riepilogo con questi appuntamenti">
                    {{ g.appointments.length }}
                    {{ g.appointments.length === 1 ? 'appuntamento' : 'appuntamenti' }}
                  </span>
                </div>

                <div class="grp-rows">
                  @for (a of visibleRows(g); track a.appointmentId) {
                    <div class="row" [class.row-sel]="isSelected(a.appointmentId)">
                      <mat-checkbox
                        [checked]="isSelected(a.appointmentId)"
                        [disabled]="resending || a.unreachable"
                        (change)="toggleOne.emit(a.appointmentId)">
                      </mat-checkbox>
                      <span class="row-when">
                        {{ a.appointmentDate }} · {{ a.startTime }}
                      </span>
                      <!-- Quando è stato fissato: è così che chi guarda
                           riconosce l'appuntamento — si ricorda della
                           telefonata, non dell'identificativo. -->
                      <span class="row-booked"
                            matTooltip="Giorno e ora in cui l'appuntamento è stato fissato">
                        <mat-icon>event_available</mat-icon>
                        prenotato il {{ a.bookedAt }}
                      </span>
                      <span class="row-kind" [class.kind-alta]="issueLabels[a.kind].severity === 'alta'"
                            [matTooltip]="issueLabels[a.kind].effect + ' ' + issueLabels[a.kind].action">
                        <mat-icon>{{ issueLabels[a.kind].icon }}</mat-icon>
                        {{ issueLabels[a.kind].name }}
                      </span>
                      <!-- La data che il paziente ha in mano: è il confronto
                           con la riga qui a sinistra a rendere evidente lo
                           spostamento, senza doverlo dedurre dall'etichetta. -->
                      @if (a.announcedFor) {
                        <span class="row-note row-warn">
                          <mat-icon>swap_horiz</mat-icon>
                          al paziente risulta {{ a.announcedFor }}
                        </span>
                      }
                      @if (a.cancelledAt) {
                        <span class="row-note row-warn">
                          <mat-icon>event_busy</mat-icon>
                          disdetto il {{ a.cancelledAt }}
                        </span>
                      }
                      @if (a.unreachable) {
                        <span class="row-note row-warn">
                          <mat-icon>person_off</mat-icon>
                          nessun recapito, va sistemato a mano
                        </span>
                      }
                    </div>
                  }
                  <!-- Una cura intensiva puo' essere tre sedute a settimana
                       per quattro mesi: cinquantadue righe di seguito rendono
                       illeggibile tutto il resto della pagina, e chi scorre
                       non sa nemmeno quante ne restano. -->
                  @if (g.appointments.length > collapseAfter) {
                    <button mat-button class="grp-more"
                            (click)="toggleExpanded(groupKey(g))">
                      <mat-icon>{{ isExpanded(groupKey(g)) ? 'expand_less' : 'expand_more' }}</mat-icon>
                      {{ isExpanded(groupKey(g))
                          ? 'Mostra meno'
                          : 'Mostra tutti i ' + g.appointments.length + ' appuntamenti' }}
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- Cosa NON è nell'elenco. Una pagina che tace su ciò che ha escluso
             si legge come "ho trovato tutto". -->
        @if (data.totals.outsideWindow || data.totals.unreachable) {
          <p class="dg-foot">
            <mat-icon>filter_alt</mat-icon>
            <span>
              @if (data.totals.outsideWindow) {
                Altri <strong>{{ data.totals.outsideWindow }}</strong> appuntamenti
                scoperti sono stati prenotati prima della finestra scelta:
                allarga il periodo per vederli.
              }
              @if (data.totals.unreachable) {
                <br>
                @if (data.totals.unreachable === data.totals.unreachableUnpaid) {
                  <strong>{{ data.totals.unreachable }}</strong> appuntamenti futuri
                  sono posti interni non retribuiti, senza anagrafica né telefono:
                  non c'è nessuno da avvisare, quindi restano fuori dal conteggio.
                } @else {
                  <strong>{{ data.totals.unreachable }}</strong> appuntamenti futuri
                  non hanno né anagrafica né telefono e restano fuori dal conteggio.
                  Di questi {{ data.totals.unreachableUnpaid }} sono posti interni
                  non retribuiti; gli altri
                  <strong>{{ data.totals.unreachable - data.totals.unreachableUnpaid }}</strong>
                  no — sono appuntamenti veri senza modo di essere comunicati, e
                  vale la pena guardarli.
                }
              }
            </span>
          </p>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .dg-wrap { display: flex; flex-direction: column; gap: 14px; }

    .dg-alarm {
      display: flex; gap: 12px; align-items: flex-start;
      background: #fee2e2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px;
      color: #7f1d1d;
    }
    .dg-alarm > mat-icon { color: #dc2626; flex: 0 0 auto; }
    .dg-alarm p { margin: 4px 0 10px; font-size: .85rem; line-height: 1.5; }

    .dg-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .dg-window { width: 200px; }
    .dg-when { font-size: .78rem; color: #64748b; margin-left: auto; }

    .dg-state { display: flex; justify-content: center; padding: 32px; }
    .dg-error, .dg-ok, .dg-foot {
      display: flex; gap: 8px; align-items: flex-start;
      font-size: .84rem; border-radius: 8px; padding: 12px 14px; margin: 0;
    }
    .dg-error { color: #991b1b; background: #fee2e2; }
    .dg-ok { color: #14532d; background: #dcfce7; }
    .dg-foot { color: #475569; background: #f1f5f9; line-height: 1.5; }
    .dg-error mat-icon, .dg-ok mat-icon, .dg-foot mat-icon {
      font-size: 19px; width: 19px; height: 19px; flex: 0 0 auto;
    }

    .dg-tiles { display: flex; gap: 10px; flex-wrap: wrap; }
    .tile {
      display: grid; grid-template-columns: auto auto; grid-template-rows: auto auto auto;
      gap: 0 8px; align-items: center;
      min-width: 210px; flex: 1 1 210px;
      border: 1px solid #e2e8f0; border-left: 3px solid #94a3b8;
      border-radius: 8px; padding: 10px 12px; background: #fff;
    }
    .tile-alta { border-left-color: #dc2626; }
    .tile mat-icon { grid-row: 1 / 3; color: #64748b; }
    .tile-alta mat-icon { color: #dc2626; }
    .tile-num { font-size: 1.5rem; font-weight: 700; color: #0f172a; line-height: 1.1; }
    .tile-name { font-size: .8rem; font-weight: 600; color: #334155; }
    .tile-eff {
      grid-column: 1 / 3; font-size: .74rem; color: #64748b;
      line-height: 1.35; margin-top: 4px;
    }
    .tile-act {
      grid-column: 1 / 3; display: flex; gap: 4px; align-items: flex-start;
      font-size: .74rem; color: #0369a1; line-height: 1.35; margin-top: 5px;
    }
    .tile-act mat-icon {
      font-size: 14px; width: 14px; height: 14px; flex: 0 0 auto; margin-top: 2px;
    }

    .dg-actions {
      display: flex; gap: 14px; align-items: center; flex-wrap: wrap;
      background: #f8fafc; border-radius: 8px; padding: 10px 12px;
    }
    .dg-actions button { margin-left: auto; }
    .dg-actions mat-spinner { display: inline-block; margin-right: 6px; }

    .ph-box {
      border: 1px solid #fde68a; background: #fffbeb;
      border-radius: 10px; padding: 12px 14px;
    }
    .ph-title {
      display: flex; align-items: center; gap: 6px; margin: 0 0 8px;
      font-size: .82rem; font-weight: 600; color: #92400e;
    }
    .ph-title mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .ph-intro {
      margin: 0 0 10px; font-size: .78rem; color: #92400e; line-height: 1.5;
    }
    .ph-row {
      display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
      padding: 6px 0; font-size: .82rem; border-top: 1px solid #fef3c7;
    }
    .ph-row:first-of-type { border-top: none; }
    .ph-who { font-weight: 600; color: #0f172a; min-width: 150px; }
    .ph-num {
      background: #fee2e2; color: #991b1b; border-radius: 5px;
      padding: 2px 7px; font-family: inherit; font-weight: 600;
    }
    .ph-count { color: #64748b; font-size: .78rem; }
    .ph-note {
      display: flex; align-items: center; gap: 4px;
      font-size: .76rem; color: #92400e;
    }
    .ph-bad { color: #991b1b; font-weight: 600; }
    .ph-found {
      display: flex; align-items: center; gap: 4px;
      font-size: .8rem; color: #14532d; background: #dcfce7;
      border-radius: 5px; padding: 2px 8px;
    }
    .ph-found mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .ph-fix { font-size: .76rem; line-height: 1.8; min-height: 30px; margin-left: auto; }
    .ph-fix mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 3px; }
    .ph-note mat-icon { font-size: 15px; width: 15px; height: 15px; }

    .dg-groups { display: flex; flex-direction: column; gap: 10px; }
    .grp { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #fff; }
    .grp-head {
      display: flex; gap: 10px; align-items: center;
      padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
    }
    .grp-who { display: flex; flex-direction: column; min-width: 0; }
    .grp-name { font-weight: 600; color: #0f172a; }
    .grp-phone { font-size: .76rem; color: #64748b; }
    .grp-never {
      display: flex; align-items: center; gap: 4px;
      font-size: .74rem; color: #92400e; background: #fef3c7;
      border-radius: 999px; padding: 3px 10px;
    }
    .grp-never mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .grp-grave { color: #991b1b; background: #fee2e2; }
    .grp-more {
      align-self: flex-start; margin: 4px 0 6px 10px;
      font-size: .78rem; color: #0284c7;
    }
    .grp-more mat-icon { font-size: 17px; width: 17px; height: 17px; margin-right: 2px; }
    .grp-links { display: flex; gap: 2px; margin-left: 4px; }
    .grp-links a { color: #64748b; }
    .grp-links mat-icon { font-size: 19px; width: 19px; height: 19px; }
    .grp-count {
      margin-left: auto; font-size: .76rem; color: #0369a1;
      background: #e0f2fe; border-radius: 999px; padding: 3px 10px; white-space: nowrap;
    }

    .grp-rows { display: flex; flex-direction: column; }
    .row {
      display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
      padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: .82rem;
    }
    .row:last-child { border-bottom: none; }
    .row-sel { background: #f0f9ff; }
    .row-when { font-variant-numeric: tabular-nums; color: #0f172a; min-width: 130px; }
    .row-booked {
      display: flex; align-items: center; gap: 4px;
      font-size: .76rem; color: #64748b; font-variant-numeric: tabular-nums;
    }
    .row-booked mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .row-kind { display: flex; align-items: center; gap: 4px; color: #475569; }
    .row-kind mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .kind-alta { color: #b91c1c; }
    .row-note { font-size: .76rem; color: #64748b; display: flex; align-items: center; gap: 4px; }
    .row-warn { color: #b45309; }
    .row-note mat-icon { font-size: 15px; width: 15px; height: 15px; }

    @media (max-width: 600px) {
      .dg-when { margin-left: 0; width: 100%; }
      .dg-actions button { margin-left: 0; width: 100%; }
      .row-when { min-width: 0; }
    }
  `],
})
export class DiagnosticsPanelComponent {
  @Input() data: WhatsappDiagnostics | null = null;
  @Input() loading = false;
  @Input() resending = false;
  @Input() error: string | null = null;
  /** Gli id scelti. Set e non array: qui si interroga, non si scorre. */
  @Input() selected = new Set<string>();

  @Output() windowChange = new EventEmitter<number>();
  @Output() refresh = new EventEmitter<void>();
  @Output() resend = new EventEmitter<void>();
  @Output() toggleOne = new EventEmitter<string>();
  @Output() toggleGroup = new EventEmitter<PatientNotificationIssues>();
  @Output() toggleAll = new EventEmitter<boolean>();
  @Output() openSettings = new EventEmitter<void>();
  /** Richiesta di riportare il numero dell'anagrafica sugli appuntamenti. */
  @Output() applyRegistryPhone = new EventEmitter<PhoneNumberIssue>();

  readonly issueLabels = ISSUE_LABELS;
  readonly categoryNames = CATEGORY_NAMES;
  readonly windowChoices = WINDOW_CHOICES;
  readonly contactWarnings = CONTACT_WARNINGS;

  get tiles() {
    const t = this.data?.totals;
    if (!t) return [];
    return [
      { kind: 'NEVER_NOTIFIED', value: t.neverNotified, ...ISSUE_LABELS.NEVER_NOTIFIED },
      { kind: 'CANCELLED_NOT_NOTIFIED', value: t.cancelledNotNotified, ...ISSUE_LABELS.CANCELLED_NOT_NOTIFIED },
      { kind: 'STALE_INFO', value: t.staleInfo, ...ISSUE_LABELS.STALE_INFO },
      { kind: 'STUCK', value: t.stuck, ...ISSUE_LABELS.STUCK },
    ];
  }

  /** Solo i selezionabili: quelli senza recapito non si possono rimandare. */
  private get selectableIds(): string[] {
    return (this.data?.groups ?? [])
      .flatMap(g => g.appointments)
      .filter(a => !a.unreachable)
      .map(a => a.appointmentId);
  }

  get totalAppointments(): number { return this.selectableIds.length; }
  get selectedCount(): number { return this.selected.size; }
  get allSelected(): boolean {
    const ids = this.selectableIds;
    return ids.length > 0 && ids.every(id => this.selected.has(id));
  }
  get someSelected(): boolean { return this.selected.size > 0; }

  isSelected(id: string): boolean { return this.selected.has(id); }

  /**
   * L'anagrafica della persona nella suite unificata.
   *
   * Alias dal sottodominio, come gia' fa la scheda paziente: su localhost non
   * c'e' un tenant e il pulsante semplicemente non compare, invece di portare
   * a un indirizzo che non esiste.
   */
  registryUrl(g: PatientNotificationIssues): string | null {
    if (!g.patientId) return null;
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return null;
    const alias = host.split('.')[0];
    if (!alias) return null;
    return `https://gestione.${alias}.curandis.cloud/anagrafiche/subjects/${g.patientId}`;
  }

  /** Oltre questa soglia il gruppo nasce richiuso. */
  readonly collapseAfter = 5;

  /** Solo stato visivo, non di dominio: resta qui e non nel container. */
  private espansi = new Set<string>();

  groupKey(g: PatientNotificationIssues): string {
    return g.patientId ?? g.appointments[0]?.appointmentId ?? '';
  }

  isExpanded(key: string): boolean { return this.espansi.has(key); }

  toggleExpanded(key: string): void {
    this.espansi.has(key) ? this.espansi.delete(key) : this.espansi.add(key);
  }

  /**
   * Le righe da disegnare. Il gruppo resta selezionabile per intero anche
   * quando e' richiuso: la casella in testata agisce su tutti gli
   * appuntamenti, non solo su quelli in vista — altrimenti "seleziona questa
   * persona" ne prenderebbe cinque su cinquantadue senza dirlo.
   */
  visibleRows(g: PatientNotificationIssues) {
    if (this.isExpanded(this.groupKey(g))) return g.appointments;
    return g.appointments.slice(0, this.collapseAfter);
  }

  isGroupSelected(g: PatientNotificationIssues): boolean {
    const ids = g.appointments.filter(a => !a.unreachable).map(a => a.appointmentId);
    return ids.length > 0 && ids.every(id => this.selected.has(id));
  }

  isGroupPartial(g: PatientNotificationIssues): boolean {
    const ids = g.appointments.filter(a => !a.unreachable).map(a => a.appointmentId);
    const n = ids.filter(id => this.selected.has(id)).length;
    return n > 0 && n < ids.length;
  }
}

/**
 * Calendar V2 Sidebar Component
 * Layer 1: Dumb Component
 *
 * Tre sezioni espandibili:
 * 1. Operatori (lista con toggle)
 * 2. Ricerca Disponibilita' (filtri completi come v1)
 * 3. Trattamenti in corso
 * Scrollbar verticale quando il contenuto eccede l'altezza.
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatRadioModule } from '@angular/material/radio';
import { CalendarOperator, SearchFilters } from '../../models/calendar-v2.model';
import {
  Treatment, PaymentMethod,
  getTreatmentStatusLabel, getTreatmentStatusColor, getPaymentMethodLabel,
} from '../../../../models/treatment.model';
import { InstrumentCategory } from '../../../../graphql/generated/types';
import { ParkedChatsPanelComponent } from '../../../whatsapp-chat/components/parked-chats-panel/parked-chats-panel.component';
import { WhatsappConversation } from '../../../whatsapp-chat/models/whatsapp-chat.model';

@Component({
  selector: 'app-calendar-v2-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    MatCheckboxModule, MatButtonModule, MatIconModule,
    MatSelectModule, MatFormFieldModule, MatDividerModule,
    MatExpansionModule, MatRadioModule,
    ParkedChatsPanelComponent,
  ],
  template: `
    <div class="sidebar" [class.collapsed]="collapsed">
      <div class="sidebar-header">
        <button mat-icon-button (click)="toggleCollapsed.emit()">
          <mat-icon>{{ collapsed ? 'chevron_right' : 'chevron_left' }}</mat-icon>
        </button>
        @if (!collapsed) {
          <span class="sidebar-title">Pannello</span>
        }
      </div>

      @if (!collapsed) {
        <div class="sidebar-scroll">

          <!-- ===== 1. OPERATORI ===== -->
          <mat-expansion-panel [expanded]="true" class="sidebar-panel">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon>people</mat-icon>
                Operatori ({{ selectedCount }}/{{ operatorsCount }})
              </mat-panel-title>
            </mat-expansion-panel-header>

            <!-- Filtro categoria -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
              <mat-label>Categoria</mat-label>
              <mat-select [(ngModel)]="selectedCategory" (ngModelChange)="onCategoryChange()">
                <mat-option value="">Tutte</mat-option>
                @for (cat of categories; track cat) {
                  <mat-option [value]="cat">{{ getCategoryLabel(cat) }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <div class="operator-actions">
              <button mat-stroked-button class="action-btn" (click)="onSelectAll()">
                <mat-icon>select_all</mat-icon> Tutti
              </button>
              <button mat-stroked-button class="action-btn" (click)="onDeselectAll()">
                <mat-icon>deselect</mat-icon> Nessuno
              </button>
            </div>

            <div class="operator-list">
              @for (op of filteredOperators; track op.operatorId) {
                <div class="operator-item" (click)="toggleOperator.emit(op.operatorId)">
                  <div class="operator-color" [style.background]="op.color"></div>
                  <mat-checkbox [checked]="op.selected" (click)="$event.stopPropagation()"
                                (change)="toggleOperator.emit(op.operatorId)">
                  </mat-checkbox>
                  <span class="operator-name" [class.selected]="op.selected">{{ op.name }}</span>
                </div>
              }
            </div>
          </mat-expansion-panel>

          <!-- ===== 2. RICERCA DISPONIBILITA' ===== -->
          <mat-expansion-panel class="sidebar-panel">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon>search</mat-icon>
                Ricerca Disponibilità
              </mat-panel-title>
            </mat-expansion-panel-header>

            <div class="search-filters">
              <!-- Toggle master -->
              <mat-checkbox [(ngModel)]="slotSearchEnabled"
                            (ngModelChange)="slotSearchToggle.emit($event)">
                Mostra slot disponibili
              </mat-checkbox>

              <!-- Durata -->
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
                <mat-label>Durata</mat-label>
                <mat-select [(ngModel)]="filters.duration" (ngModelChange)="emitFilters()"
                            [disabled]="!slotSearchEnabled">
                  <mat-option [value]="15">15 minuti</mat-option>
                  <mat-option [value]="30">30 minuti</mat-option>
                  <mat-option [value]="45">45 minuti</mat-option>
                  <mat-option [value]="60">60 minuti</mat-option>
                </mat-select>
              </mat-form-field>

              <!-- Con strumento -->
              @if (slotSearchEnabled && filters.duration >= 30) {
                <mat-checkbox [(ngModel)]="filters.withInstrument"
                              (ngModelChange)="emitFilters()">
                  Con strumento
                </mat-checkbox>

                @if (filters.withInstrument) {
                  <!-- Numero strumenti -->
                  <div class="filter-group">
                    <label class="filter-label">Numero strumenti</label>
                    <mat-radio-group [(ngModel)]="filters.instrumentCount" (ngModelChange)="emitFilters()">
                      <mat-radio-button [value]="1">1 strumento</mat-radio-button>
                      @if (filters.duration >= 45) {
                        <mat-radio-button [value]="2">2 strumenti</mat-radio-button>
                      }
                    </mat-radio-group>
                  </div>

                  <!-- Posizione strumento (solo 1 strumento, durata > 30) -->
                  @if (filters.instrumentCount === 1 && filters.duration > 30) {
                    <div class="filter-group">
                      <label class="filter-label">Posizione strumento</label>
                      <mat-radio-group [(ngModel)]="filters.instrumentPosition" (ngModelChange)="emitFilters()">
                        <mat-radio-button value="first">Prima metà</mat-radio-button>
                        <mat-radio-button value="second">Seconda metà</mat-radio-button>
                      </mat-radio-group>
                    </div>
                  }

                  <!-- Ordine importante (solo 2 strumenti) -->
                  @if (filters.instrumentCount === 2) {
                    <mat-checkbox [(ngModel)]="filters.instrumentOrderMatters"
                                  (ngModelChange)="emitFilters()">
                      Ordine strumenti importante
                    </mat-checkbox>
                  }

                  <!-- Categoria strumento (1 strumento) -->
                  @if (filters.instrumentCount === 1 && instrumentCategories.length > 0) {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
                      <mat-label>Categoria strumento</mat-label>
                      <mat-select [(ngModel)]="filters.instrumentCategoryId" (ngModelChange)="emitFilters()">
                        <mat-option [value]="null">Qualsiasi</mat-option>
                        @for (cat of instrumentCategories; track cat.id) {
                          <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  }

                  <!-- 2 categorie strumenti -->
                  @if (filters.instrumentCount === 2 && instrumentCategories.length > 0) {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
                      <mat-label>Strumento 1</mat-label>
                      <mat-select [(ngModel)]="filters.instrumentCategoryId" (ngModelChange)="emitFilters()">
                        <mat-option [value]="null">Qualsiasi</mat-option>
                        @for (cat of instrumentCategories; track cat.id) {
                          <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
                      <mat-label>Strumento 2</mat-label>
                      <mat-select [(ngModel)]="filters.instrument2CategoryId" (ngModelChange)="emitFilters()">
                        <mat-option [value]="null">Qualsiasi</mat-option>
                        @for (cat of instrumentCategories; track cat.id) {
                          <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  }
                }
              }
            </div>
          </mat-expansion-panel>

          <!-- ===== 3. TRATTAMENTI ===== -->
          <mat-expansion-panel class="sidebar-panel" [expanded]="treatments.length > 0">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon>medical_services</mat-icon>
                Trattamenti ({{ treatments.length }})
              </mat-panel-title>
            </mat-expansion-panel-header>

            @if (treatments.length > 0) {
              @if (weekly) {
                <!-- Vista settimanale: gruppi per giorno espandibili -->
                @for (group of treatmentsByDay; track group.day) {
                  <div class="day-group">
                    <div class="day-group-header"
                         [class.selected]="isDaySelected(group.day)"
                         (click)="toggleDay(group.day)">
                      <mat-icon class="day-chevron">
                        {{ isDayExpanded(group.day) ? 'expand_more' : 'chevron_right' }}
                      </mat-icon>
                      <span class="day-group-label">{{ group.label }}</span>
                      <span class="day-group-count">{{ group.treatments.length }}</span>
                    </div>
                    @if (isDayExpanded(group.day)) {
                      <div class="day-group-body">
                        @for (t of group.treatments; track t.id) {
                          <ng-container *ngTemplateOutlet="treatmentCard; context: { $implicit: t }"></ng-container>
                        }
                      </div>
                    }
                  </div>
                }
              } @else {
                <!-- Vista giornaliera: lista piatta -->
                @for (t of treatments; track t.id) {
                  <ng-container *ngTemplateOutlet="treatmentCard; context: { $implicit: t }"></ng-container>
                }
              }
            } @else {
              <p class="empty-text">Nessun trattamento in corso</p>
            }

            <!-- Card trattamento riusabile (lista piatta e gruppi-giorno) -->
            <ng-template #treatmentCard let-t>
              <div class="treatment-item"
                   [class.selected]="isTreatmentSelected(t)"
                   (click)="onTreatmentCardClick(t, $event)">
                <div class="treatment-info">
                  <span class="treatment-patient-name">{{ getPatientName(t) }}</span>
                  <span class="treatment-status-badge"
                        [style.background-color]="getTreatmentStatusColor(t.status)">
                    {{ getTreatmentStatusLabel(t.status) }}
                  </span>
                </div>
                <div class="treatment-sub">
                  <span class="treatment-operator">{{ getOperatorName(t) }}</span>
                  @if (t.startedAt) {
                    <span class="treatment-time">{{ formatTreatmentTime(t.startedAt) }}</span>
                  }
                </div>

                <!-- Popup dettagli (solo se selezionato E status operator_completed) -->
                @if (isTreatmentSelected(t) && isOperatorCompleted(t)) {
                  <div class="treatment-details-popup" (click)="$event.stopPropagation()">
                    <div class="popup-title">Dettagli per la Segreteria</div>

                    @if (t.service) {
                      <div class="popup-row">
                        <span class="row-label">Servizio:</span>
                        <span class="row-value">{{ t.service.name }}</span>
                      </div>
                    }

                    @if (t.secretaryNotes) {
                      <div class="popup-row">
                        <span class="row-label">Note segreteria:</span>
                        <div class="row-value notes">{{ t.secretaryNotes }}</div>
                      </div>
                    }

                    @if (hasReschedulingInfo(t)) {
                      <div class="popup-row">
                        <span class="row-label">Riprogrammazione:</span>
                        <div class="row-value reschedule">
                          @if (t.suggestInDays) {
                            <span>Fra {{ t.suggestInDays }} giorni</span>
                          }
                          @if (t.suggestDateRangeStart && t.suggestDateRangeEnd) {
                            <span>Dal {{ formatShortDate(t.suggestDateRangeStart) }} al {{ formatShortDate(t.suggestDateRangeEnd) }}</span>
                          }
                          @if (t.reschedulingNotes) {
                            <span>{{ t.reschedulingNotes }}</span>
                          }
                        </div>
                      </div>
                    }

                    <div class="popup-row">
                      <span class="row-label">Prezzo:</span>
                      <span class="row-value">
                        {{ t.price | number:'1.2-2' }} &euro;
                        @if (t.scontoFE) { <span class="badge badge-sconto">Sconto FE</span> }
                      </span>
                    </div>

                    <div class="popup-row">
                      <span class="row-label">Pagamento:</span>
                      <span class="row-value">
                        @if (t.isPaid) {
                          <span class="badge badge-paid">
                            {{ isCollectedByOperator(t) ? 'Incassato dall\\'operatore' : 'Incassato dalla segreteria' }}
                          </span>
                          @if (t.paymentMethod) {
                            <span class="payment-method">({{ getPaymentMethodLabelForTreatment(t.paymentMethod) }})</span>
                          }
                        } @else {
                          <span class="badge badge-unpaid">Da incassare</span>
                        }
                      </span>
                    </div>
                  </div>
                }
              </div>
            </ng-template>
          </mat-expansion-panel>

          <!-- ===== 4. CHAT IN CORSO ===== -->
          <mat-expansion-panel class="sidebar-panel"
                               [expanded]="parkedChats.length > 0">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon>forum</mat-icon>
                Chat in corso ({{ parkedChats.length }})
                @if (parkedChatsUnread > 0) {
                  <span class="chat-unread-dot">{{ parkedChatsUnread }}</span>
                }
              </mat-panel-title>
            </mat-expansion-panel-header>

            <app-parked-chats-panel
              [conversations]="parkedChats"
              (open)="openParkedChat.emit($event)"
              (remove)="removeParkedChat.emit($event)"
              (newChat)="newParkedChat.emit()"
              (clearAll)="clearParkedChats.emit()">
            </app-parked-chats-panel>
          </mat-expansion-panel>

        </div><!-- /sidebar-scroll -->
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      height: 100%;
      min-height: 0;
    }

    .sidebar {
      width: 260px;
      min-width: 260px;
      height: 100%;
      background: white;
      border-right: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width 0.2s, min-width 0.2s;
    }

    .sidebar.collapsed { width: 48px; min-width: 48px; }

    .sidebar-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .sidebar-title {
      font-weight: 600;
      font-size: 0.9rem;
      color: #334155;
    }

    /* Area scrollabile */
    .sidebar-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
    }

    /* Panels */
    .sidebar-panel {
      box-shadow: none !important;
      border-radius: 0 !important;
      background: white;
    }

    .sidebar-panel ::ng-deep .mat-expansion-panel-body {
      padding: 0 12px 12px;
    }

    .sidebar-panel ::ng-deep .mat-expansion-panel-header {
      padding: 0 12px;
      height: 40px;
      font-size: 0.8rem;
    }

    .sidebar-panel ::ng-deep .mat-expansion-panel-header-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #334155;
    }

    .sidebar-panel ::ng-deep .mat-expansion-panel-header-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .full-width { width: 100%; }

    /* Pallino non letti sull'intestazione "Chat in corso". */
    .chat-unread-dot {
      margin-left: 6px;
      background: #25d366;
      color: #08312a;
      border-radius: 10px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      font-size: 11px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    /* ===== OPERATORI ===== */
    .operator-actions {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
    }

    .action-btn {
      flex: 1;
      font-size: 0.7rem;
      line-height: 1;
    }

    .action-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .operator-list {
      overflow-y: auto;
      resize: vertical;
      min-height: 60px;
      max-height: 50vh;
      padding-bottom: 4px;
      border-bottom: 2px solid #e2e8f0;
    }

    .operator-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 3px 0;
      cursor: pointer;
      &:hover { background: #f1f5f9; }
    }

    .operator-color {
      width: 12px;
      height: 12px;
      border-radius: 3px;
      flex-shrink: 0;
    }

    .operator-name {
      font-size: 0.8rem;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .operator-name.selected { color: #1e293b; font-weight: 500; }

    /* ===== RICERCA ===== */
    .search-filters {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .search-filters mat-checkbox { font-size: 0.8rem; }

    .filter-group {
      padding-left: 4px;
    }

    .filter-label {
      font-size: 0.7rem;
      color: #64748b;
      font-weight: 500;
      display: block;
      margin-bottom: 4px;
    }

    .filter-group mat-radio-button {
      font-size: 0.75rem;
    }

    .filter-group mat-radio-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    /* ===== TRATTAMENTI ===== */
    .treatment-item {
      padding: 6px 8px;
      background: #f8fafc;
      border-radius: 4px;
      border-left: 3px solid #6366f1;
      margin-bottom: 4px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .treatment-item:hover { background: #eef2ff; }
    .treatment-item.selected { background: #eef2ff; border-left-color: #4338ca; }

    .treatment-info { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
    .treatment-patient-name { font-size: 0.75rem; font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .treatment-sub { display: flex; justify-content: space-between; align-items: center; margin-top: 2px; }
    .treatment-operator { font-size: 0.65rem; color: #64748b; }
    .treatment-time { font-size: 0.65rem; color: #94a3b8; }
    .treatment-status-badge {
      font-size: 0.58rem; font-weight: 600; padding: 1px 6px; border-radius: 8px;
      color: #fff; flex-shrink: 0; white-space: nowrap;
    }

    /* Popup dettagli */
    .treatment-details-popup {
      margin-top: 8px;
      padding: 8px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.06);
    }
    .popup-title {
      font-size: 0.68rem; font-weight: 700; color: #4338ca;
      text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 6px;
    }
    .popup-row { display: flex; flex-direction: column; gap: 1px; margin-bottom: 6px; }
    .popup-row:last-child { margin-bottom: 0; }
    .row-label { font-size: 0.6rem; font-weight: 600; color: #64748b; }
    .row-value { font-size: 0.72rem; color: #1e293b; }
    .row-value.notes { white-space: pre-wrap; }
    .row-value.reschedule { display: flex; flex-direction: column; gap: 1px; }
    .payment-method { font-size: 0.65rem; color: #64748b; margin-left: 4px; }
    .badge {
      display: inline-block; font-size: 0.58rem; font-weight: 600;
      padding: 1px 6px; border-radius: 8px;
    }
    .badge-sconto { background: #fef3c7; color: #b45309; margin-left: 4px; }
    .badge-paid { background: #dcfce7; color: #15803d; }
    .badge-unpaid { background: #fee2e2; color: #b91c1c; }

    .empty-text { font-size: 0.75rem; color: #94a3b8; text-align: center; padding: 8px 0; margin: 0; }

    /* ===== GRUPPI GIORNO (vista settimanale) ===== */
    .day-group { margin-bottom: 6px; }
    .day-group-header {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 6px;
      background: #eef2ff;
      border-radius: 4px;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s;
    }
    .day-group-header:hover { background: #e0e7ff; }
    .day-group-header.selected {
      background: #c7d2fe;
      box-shadow: inset 0 0 0 1.5px #4338ca;
    }
    .day-chevron { font-size: 16px; width: 16px; height: 16px; color: #4338ca; }
    .day-group-label {
      flex: 1; font-size: 0.72rem; font-weight: 600; color: #312e81;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .day-group-count {
      font-size: 0.62rem; font-weight: 700; color: #4338ca;
      background: #fff; border-radius: 8px; padding: 0 6px; min-width: 18px; text-align: center;
    }
    .day-group-body { padding: 4px 0 0 6px; }
  `],
})
export class CalendarV2SidebarComponent {
  @Input()
  set operators(value: CalendarOperator[]) {
    this._operators = value || [];
    // Quando arrivano (o cambiano) gli operatori, prova a risolvere la
    // categoria iniziale richiesta dalle impostazioni tenant.
    this.applyPendingInitialCategory();
  }
  get operators(): CalendarOperator[] { return this._operators; }
  private _operators: CalendarOperator[] = [];

  @Input() treatments: Treatment[] = [];
  @Input() instrumentCategories: InstrumentCategory[] = [];
  @Input() collapsed = false;
  /**
   * Se false, la categoria "Istruttori palestra" (gym_instructor) e i relativi
   * operatori vengono nascosti dall'elenco operatori. Pilotato dalle impostazioni
   * del tenant (calendar.showGymInstructorsInOperators).
   */
  @Input() showGymInstructors = true;
  /** true in vista settimanale: i trattamenti vengono raggruppati per giorno. */
  @Input() weekly = false;
  /** Date visibili (YYYY-MM-DD), per ordinare i gruppi-giorno in vista settimanale. */
  @Input() visibleDates: string[] = [];
  /**
   * Giorno (YYYY-MM-DD) selezionato cliccando una colonna nella griglia:
   * il relativo gruppo trattamenti si espande e l'intestazione si evidenzia.
   */
  @Input()
  set selectedDate(value: string | null) {
    this._selectedDate = value;
    // Espandi automaticamente il gruppo del giorno selezionato.
    if (value) this.expandedDays.add(value);
  }
  get selectedDate(): string | null { return this._selectedDate; }
  private _selectedDate: string | null = null;

  /** Chat WhatsApp parcheggiate dalla segreteria, mostrate in "Chat in corso". */
  @Input() parkedChats: WhatsappConversation[] = [];

  @Output() toggleOperator = new EventEmitter<string>();
  @Output() setOperatorSelection = new EventEmitter<{ operatorIds: string[]; selected: boolean }>();
  @Output() toggleCollapsed = new EventEmitter<void>();
  @Output() slotSearchToggle = new EventEmitter<boolean>();
  @Output() searchFiltersChange = new EventEmitter<SearchFilters>();
  /** Riapre il riquadro flottante della chat parcheggiata. */
  @Output() openParkedChat = new EventEmitter<WhatsappConversation>();
  /** Toglie la chat dal pannello, senza chiuderne la conversazione. */
  @Output() removeParkedChat = new EventEmitter<WhatsappConversation>();
  @Output() newParkedChat = new EventEmitter<void>();
  @Output() clearParkedChats = new EventEmitter<void>();

  /** Totale non letti fra le chat parcheggiate, per il pallino sul pannello. */
  get parkedChatsUnread(): number {
    return this.parkedChats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }

  /**
   * Categoria iniziale del filtro operatori (dalle impostazioni tenant). Si
   * applica solo al dropdown, senza riemettere la selezione: gli operatori
   * sono già stati selezionati dal container in base alla stessa categoria.
   */
  @Input()
  set initialCategory(value: string | null) {
    // Normalizza al valore reale presente tra gli operatori (il dropdown usa
    // i valori grezzi, tipicamente in MAIUSCOLO come l'enum GraphQL). Senza
    // questo match il mat-select resterebbe vuoto e la lista non filtrerebbe.
    if (!value) { this.selectedCategory = ''; this._pendingInitialCategory = ''; return; }
    this._pendingInitialCategory = String(value).toLowerCase();
    this.applyPendingInitialCategory();
  }
  /** Categoria iniziale richiesta (lowercase) in attesa che arrivino gli operatori. */
  private _pendingInitialCategory = '';

  /** Risolve la categoria iniziale al valore grezzo corrispondente, se presente. */
  private applyPendingInitialCategory(): void {
    if (!this._pendingInitialCategory) return;
    const match = this.operators
      .map(o => o.macroCategory)
      .filter(Boolean)
      .find(c => String(c).toLowerCase() === this._pendingInitialCategory);
    if (match) {
      this.selectedCategory = match as string;
      this._pendingInitialCategory = '';
    }
  }

  selectedCategory = '';
  /**
   * "Mostra slot disponibili": abilitato di default (richiesta calendario v3).
   * L'utente può comunque disattivarlo manualmente.
   */
  slotSearchEnabled = true;

  filters: SearchFilters = {
    duration: 45,
    withInstrument: false,
    instrumentCount: 1,
    instrumentPosition: 'first',
    instrumentOrderMatters: false,
    instrumentCategoryId: null,
    instrument2CategoryId: null,
  };

  /**
   * Operatori effettivamente mostrabili: esclude gli istruttori palestra
   * quando il flag tenant è disattivo. Base per conteggi, categorie e lista.
   */
  get visibleOperators(): CalendarOperator[] {
    if (this.showGymInstructors) return this.operators;
    return this.operators.filter(o => String(o.macroCategory).toLowerCase() !== 'gym_instructor');
  }

  get selectedCount(): number {
    return this.visibleOperators.filter(o => o.selected).length;
  }

  get operatorsCount(): number {
    return this.visibleOperators.length;
  }

  get categories(): string[] {
    return [...new Set(this.visibleOperators.map(o => o.macroCategory).filter(Boolean))] as string[];
  }

  get filteredOperators(): CalendarOperator[] {
    if (!this.selectedCategory) return this.visibleOperators;
    const target = String(this.selectedCategory).toLowerCase();
    return this.visibleOperators.filter(o => String(o.macroCategory).toLowerCase() === target);
  }

  getCategoryLabel(cat: string): string {
    const labels: Record<string, string> = {
      'doctor': 'Medici', 'physiotherapist': 'Fisioterapisti',
      'gym_instructor': 'Istruttori Palestra', 'other': 'Altro',
    };
    // Normalizza il casing: a runtime il valore può arrivare come
    // 'gym_instructor' o 'GYM_INSTRUCTOR' a seconda della sorgente.
    return labels[String(cat).toLowerCase()] || cat;
  }

  onCategoryChange(): void {
    if (!this.selectedCategory) {
      // "Tutte" selezionato → attiva tutti quelli visibili
      const allIds = this.visibleOperators.map(o => o.operatorId);
      this.setOperatorSelection.emit({ operatorIds: allIds, selected: true });
    } else {
      // Categoria specifica → attiva solo quelli della categoria, disattiva gli altri
      const toActivate = this.visibleOperators.filter(o => o.macroCategory === this.selectedCategory).map(o => o.operatorId);
      const toDeactivate = this.visibleOperators.filter(o => o.macroCategory !== this.selectedCategory).map(o => o.operatorId);
      this.setOperatorSelection.emit({ operatorIds: toDeactivate, selected: false });
      this.setOperatorSelection.emit({ operatorIds: toActivate, selected: true });
    }
  }

  onSelectAll(): void {
    const ids = this.filteredOperators.map(o => o.operatorId);
    this.setOperatorSelection.emit({ operatorIds: ids, selected: true });
  }

  onDeselectAll(): void {
    const ids = this.filteredOperators.map(o => o.operatorId);
    this.setOperatorSelection.emit({ operatorIds: ids, selected: false });
  }

  emitFilters(): void {
    this.searchFiltersChange.emit({ ...this.filters });
  }

  // ==================== TRATTAMENTI ====================

  /** Trattamento selezionato per cui mostrare il popup dettagli. */
  selectedTreatmentForDetails: Treatment | null = null;

  /** Giorni (YYYY-MM-DD) con gruppo trattamenti espanso in vista settimanale. */
  expandedDays = new Set<string>();

  /** Chiave giorno YYYY-MM-DD a partire da una data/stringa. */
  private dayKey(date: Date | string | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Trattamenti raggruppati per giorno per la vista settimanale, ordinati
   * secondo visibleDates (o, in mancanza, per chiave giorno). Ogni gruppo
   * riporta giorno, label e i suoi trattamenti.
   */
  get treatmentsByDay(): { day: string; label: string; treatments: Treatment[] }[] {
    const groups = new Map<string, Treatment[]>();
    for (const t of this.treatments) {
      const key = this.dayKey(t.startedAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }

    // Ordina i giorni: prima quelli in visibleDates (nell'ordine dato), poi gli
    // eventuali altri in ordine crescente.
    const ordered: string[] = [];
    for (const d of this.visibleDates) {
      if (groups.has(d)) ordered.push(d);
    }
    for (const k of [...groups.keys()].sort()) {
      if (!ordered.includes(k)) ordered.push(k);
    }

    return ordered.map(day => ({
      day,
      label: this.formatDayLabel(day),
      treatments: groups.get(day) || [],
    }));
  }

  /** Etichetta separatore giorno: "Mercoledì 17 giu". */
  formatDayLabel(day: string): string {
    if (!day) return '';
    const d = new Date(day + 'T00:00:00');
    const s = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  isDayExpanded(day: string): boolean {
    return this.expandedDays.has(day);
  }

  isDaySelected(day: string): boolean {
    return this._selectedDate === day;
  }

  toggleDay(day: string): void {
    if (this.expandedDays.has(day)) this.expandedDays.delete(day);
    else this.expandedDays.add(day);
  }

  getTreatmentStatusLabel(status: string | undefined): string {
    return getTreatmentStatusLabel((status || '') as any);
  }

  getTreatmentStatusColor(status: string | undefined): string {
    return getTreatmentStatusColor((status || '') as any);
  }

  getPatientName(t: Treatment): string {
    const p: any = t.patient;
    if (!p) return '';
    if (p.displayName) return p.displayName;
    const subj = p.subject;
    if (subj) return `${subj.firstName ?? ''} ${subj.lastName ?? ''}`.trim();
    return `${p.nome ?? ''} ${p.cognome ?? ''}`.trim();
  }

  getOperatorName(t: Treatment): string {
    const op: any = t.operator;
    if (!op) return '';
    return `${op.name ?? ''}${op.surname ? ' ' + op.surname : ''}`.trim();
  }

  formatTreatmentTime(date: Date | string): string {
    return new Date(date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

  formatShortDate(date: Date | string | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  getPaymentMethodLabelForTreatment(method: PaymentMethod | string | undefined): string {
    if (!method) return '';
    return getPaymentMethodLabel(method as PaymentMethod);
  }

  /** Toggle del popup dettagli per la card cliccata. */
  onTreatmentCardClick(treatment: Treatment, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedTreatmentForDetails =
      this.selectedTreatmentForDetails?.id === treatment.id ? null : treatment;
  }

  isTreatmentSelected(treatment: Treatment): boolean {
    return this.selectedTreatmentForDetails?.id === treatment.id;
  }

  /** I dettagli estesi sono pensati per i trattamenti completati dall'operatore. */
  isOperatorCompleted(treatment: Treatment): boolean {
    return (treatment.status || '').toLowerCase() === 'operator_completed';
  }

  hasReschedulingInfo(treatment: Treatment): boolean {
    return !!(
      treatment.rescheduleRequested ||
      treatment.suggestInDays ||
      (treatment.suggestDateRangeStart && treatment.suggestDateRangeEnd) ||
      (treatment.reschedulingType && treatment.reschedulingType !== 'none')
    );
  }

  isCollectedByOperator(treatment: Treatment): boolean {
    if (!treatment.isPaid) return false;
    return treatment.collectedBy === treatment.operatorId;
  }

  /** Chiude il popup quando si clicca fuori da una card trattamento. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.selectedTreatmentForDetails && !target.closest('.treatment-item')) {
      this.selectedTreatmentForDetails = null;
    }
  }
}

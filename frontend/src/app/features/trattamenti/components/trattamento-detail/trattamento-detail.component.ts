import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Inject } from '@angular/core';
import {
  Trattamento,
  TrattamentoInvoiceLine,
  TrattamentoServizio,
  PaymentMethod,
  TreatmentStatus,
  TreatmentBillingStatus,
} from '../../models/trattamento.model';
import { TreatmentBillingSectionComponent } from '../treatment-billing-section/treatment-billing-section.component';

export interface DetailEditInvoiceLinePayload {
  mode: 'create' | 'update' | 'delete';
  line?: TrattamentoInvoiceLine;
  input?: { id?: string; description?: string; amount?: number };
}

export interface DetailUpdateServiceDescriptionPayload {
  treatmentServiceId: string;
  /** `undefined` o stringa vuota = ripristina all'auto-generato (cancella il custom). */
  description?: string;
}

export interface DetailUpdateEconomicsPayload {
  price?: number;
  scontoFE?: boolean;
  secretaryNotes?: string;
}

export interface DetailRecordPaymentPayload {
  paymentMethod: PaymentMethod;
  collectedBy: string;
  amount?: number;
}

export interface DetailDialogData {
  treatment: Trattamento;
  /** Se true, la UI mostra i controlli economici/fatturazione (segreteria/admin). */
  canEditEconomics: boolean;
  /** Se true, la UI mostra la sezione pagamento (solo se operatore può incassare o segreteria). */
  canRecordPayment: boolean;
  /** ID dell'AppUser corrente per collectedBy / createdBy. */
  currentUserId?: string;
}

/**
 * Dumb component di dettaglio trattamento, aperto come MatDialog.
 *
 * È un dumb component con gli Input/Output classici: NON chiama il backend
 * direttamente. Tutte le mutation passano tramite gli eventi che il
 * container "padre" ascolta e inoltra al service GraphQL.
 *
 * Il dialog è draggable+resizable: la logica è impostata dal container
 * che lo apre, tramite panelClass e uso di cdkDrag sull'header qui sotto.
 */
@Component({
  selector: 'app-trattamento-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TextFieldModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatCheckboxModule,
    MatSelectModule,
    MatDividerModule,
    MatExpansionModule,
    MatTabsModule,
    MatTooltipModule,
    TreatmentBillingSectionComponent,
  ],
  template: `
    <div class="detail-header" mat-dialog-title>
      <div class="title-wrap">
        <h2>
          Trattamento
          @if (treatment.patient) {
            — {{ treatment.patient.nome }} {{ treatment.patient.cognome }}
          }
          <span class="status-chip" [style.background]="statusColor">
            {{ statusLabel }}
          </span>
          @if (treatment.billingStatus === TreatmentBillingStatus.Sent
               || treatment.billingStatus === TreatmentBillingStatus.Pending) {
            <span class="status-chip status-chip-accent"
                  [matTooltip]="'Inviato al sistema di fatturazione' + (treatment.readyForBillingAt ? ' il ' + formatDateTime(treatment.readyForBillingAt) : '')">
              <mat-icon inline>send</mat-icon>
              Inviato
            </span>
          }
          @if (treatment.isInvoicedToPatient) {
            <span class="status-chip status-chip-accent" matTooltip="Fatturato">
              <mat-icon inline>receipt_long</mat-icon>
              Fatturato
            </span>
          }
          @if (treatment.forcedClosure) {
            <span class="status-chip status-chip-warn"
                  matTooltip="Chiusura forzata da segreteria/admin (operatore non ha completato il trattamento)">
              <mat-icon inline>lock_clock</mat-icon>
              Chiusura forzata
            </span>
          }
        </h2>
        <div class="subtitle">
          {{ formatDate(treatment.appointment?.appointmentDate || (treatment.startedAt || '').slice(0, 10)) }}
          • {{ treatment.appointment?.startTime || '—' }}
          • {{ treatment.operator?.name || 'Operatore rimosso' }} {{ treatment.operator?.surname || '' }}
          @if (treatment.operator?.professionalRegistration) {
            • {{ treatment.operator?.professionalRegistration }}
          }
          <!-- Link rapido alla scheda paziente nel registry (nuova tab): utile
               per completare dati anagrafici mancanti (indirizzo/CF) che
               bloccano la fatturazione. Uso un button + window.open (più
               affidabile di un <a> che in alcuni contesti scaricava il link). -->
          @if (registryPatientUrl) {
            • <button type="button" class="registry-link"
                      (click)="openRegistryPatient()"
                      matTooltip="Apri la scheda del paziente nel registro (nuova scheda)">
                <mat-icon inline>open_in_new</mat-icon> Scheda paziente
              </button>
          }
        </div>
      </div>
      <button mat-icon-button (click)="closeDialog()" aria-label="Chiudi">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="detail-content">
      <mat-tab-group>
        <!-- TAB FATTURAZIONE -->
        <mat-tab label="Fatturazione">
          <div class="tab-panel">
            <!-- RIGHE SERVIZIO (ogni riga legata a un servizio del catalogo:
                 accounting associa la natura IVA via serviceCode). -->
            <h3 class="section-h">
              Righe servizio
              @if (canAddServiceLine) {
                <button mat-icon-button color="primary" (click)="startNewServiceLine()"
                        matTooltip="Aggiungi riga servizio">
                  <mat-icon>add</mat-icon>
                </button>
              } @else if (canEditEconomics && treatment.status === TreatmentStatus.CLOSED) {
                <small class="hint-warn">Trattamento chiuso: riaprirlo per aggiungere righe.</small>
              }
            </h3>
            <table mat-table [dataSource]="treatment.treatmentServices || []"
                   [trackBy]="trackById" class="mini-table">
              <ng-container matColumnDef="service">
                <th mat-header-cell *matHeaderCellDef class="col-service">Servizio</th>
                <td mat-cell *matCellDef="let ts" class="col-service">{{ ts.service.name }}</td>
              </ng-container>
              <ng-container matColumnDef="description">
                <th mat-header-cell *matHeaderCellDef class="col-description">Descrizione riga fattura</th>
                <td mat-cell *matCellDef="let ts">
                  <div class="desc-cell">
                    @if (canEditEconomics) {
                      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="desc-input">
                        <textarea matInput
                          cdkTextareaAutosize
                          cdkAutosizeMinRows="1"
                          cdkAutosizeMaxRows="5"
                          [ngModel]="currentDescriptionFor(ts)"
                          (ngModelChange)="setDescriptionEdit(ts.id, $event)"
                          placeholder="Auto-generata">
                        </textarea>
                      </mat-form-field>
                      <div class="desc-actions">
                        @if (isPersonalized(ts)) {
                          <mat-icon class="personalized-dot"
                            matTooltip="Descrizione personalizzata (non più auto-generata)">
                            edit
                          </mat-icon>
                        } @else {
                          <span class="personalized-placeholder"></span>
                        }
                        <button mat-icon-button
                          color="primary"
                          [disabled]="!canSaveDescription(ts)"
                          (click)="saveDescription(ts)"
                          matTooltip="Salva modifica descrizione">
                          <mat-icon>save</mat-icon>
                        </button>
                        <button mat-icon-button
                          [disabled]="!canResetDescription(ts)"
                          (click)="resetDescription(ts)"
                          matTooltip="Ripristina descrizione auto-generata">
                          <mat-icon>restart_alt</mat-icon>
                        </button>
                      </div>
                    } @else {
                      <span class="desc-readonly">
                        {{ ts.invoiceLineDescription || ts.invoiceLineDescriptionAuto || '—' }}
                      </span>
                    }
                  </div>
                </td>
              </ng-container>
              <!-- ESEGUITO DA: a chi va il compenso della riga nei conteggi.
                   Default (—) = operatore del trattamento; override esplicito
                   per righe eseguite da un altro operatore. -->
              <ng-container matColumnDef="executor">
                <th mat-header-cell *matHeaderCellDef class="col-executor">Eseguito da</th>
                <td mat-cell *matCellDef="let ts" class="col-executor">
                  @if (canEditEconomics && operatorCatalog.length > 0) {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="executor-select">
                      <mat-select [ngModel]="ts.executorOperatorId ?? null"
                                  (ngModelChange)="onExecutorChange(ts, $event)"
                                  [matTooltip]="'A questo operatore va il compenso della riga'">
                        <mat-option [value]="null">{{ treatmentOperatorLabel }} — op. trattamento</mat-option>
                        @for (o of executorOptions; track o.id) {
                          <mat-option [value]="o.id">{{ o.label }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  } @else {
                    <span [class.executor-override]="!!ts.executorOperator"
                          [matTooltip]="ts.executorOperator ? 'Riga attribuita a un operatore diverso da quello del trattamento' : 'Operatore del trattamento'">
                      {{ executorLabelFor(ts) }}
                    </span>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="price">
                <th mat-header-cell *matHeaderCellDef class="col-price">Importo</th>
                <td mat-cell *matCellDef="let ts" class="col-price">
                  € {{ (ts.price || 0) | number:'1.2-2' }}
                  @if (ts.isCustomPrice) {
                    <mat-icon class="custom-icon" matTooltip="Prezzo personalizzato">edit</mat-icon>
                  }
                </td>
              </ng-container>
              <!-- Azioni riga servizio: rimuovi (solo se modificabile). -->
              <ng-container matColumnDef="sactions">
                <th mat-header-cell *matHeaderCellDef class="col-actions"></th>
                <td mat-cell *matCellDef="let ts" class="col-actions">
                  @if (canAddServiceLine) {
                    <button mat-icon-button color="warn"
                            (click)="removeServiceLine.emit(ts.id)"
                            matTooltip="Rimuovi riga">
                      <mat-icon>delete</mat-icon>
                    </button>
                  }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="svcCols"></tr>
              <tr mat-row *matRowDef="let row; columns: svcCols"></tr>
            </table>

            @if ((treatment.treatmentServices || []).length === 0 && !newServiceOpen) {
              <p class="empty-inline">Nessuna riga servizio.</p>
            }

            <!-- FORM AGGIUNGI RIGA SERVIZIO: seleziona un servizio dal catalogo.
                 Prezzo vuoto = tariffa del servizio (scontoFE se attivo). -->
            @if (newServiceOpen) {
              <div class="new-line-form">
                <mat-form-field appearance="outline" class="svc-select">
                  <mat-label>Servizio</mat-label>
                  <mat-select [(ngModel)]="newServiceId"
                              (selectionChange)="onNewServiceSelected()">
                    @for (s of serviceCatalog; track s.id) {
                      <mat-option [value]="s.id">{{ s.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" class="desc-input">
                  <mat-label>Descrizione (opzionale)</mat-label>
                  <input matInput [(ngModel)]="newServiceDescription"/>
                  <mat-hint>Lascia vuoto per la descrizione auto-generata secondo le regole impostate, oppure personalizzala qui.</mat-hint>
                </mat-form-field>
                <mat-form-field appearance="outline" class="amt-input">
                  <mat-label>Prezzo</mat-label>
                  <input matInput type="number" step="0.01"
                         [ngModel]="newServicePrice"
                         (ngModelChange)="onNewServicePriceChange($event)"
                         placeholder="Tariffa servizio"/>
                </mat-form-field>
                @if (operatorCatalog.length > 0) {
                  <mat-form-field appearance="outline" class="svc-select">
                    <mat-label>Eseguito da</mat-label>
                    <mat-select [(ngModel)]="newServiceExecutorId">
                      <mat-option [value]="null">{{ treatmentOperatorLabel }} — op. trattamento</mat-option>
                      @for (o of executorOptions; track o.id) {
                        <mat-option [value]="o.id">{{ o.label }}</mat-option>
                      }
                    </mat-select>
                    <mat-hint>A chi va il compenso della riga</mat-hint>
                  </mat-form-field>
                }
                <button mat-flat-button color="primary"
                        (click)="confirmNewServiceLine()" [disabled]="!newServiceId">
                  Aggiungi
                </button>
                <button mat-stroked-button (click)="cancelNewServiceLine()">Annulla</button>
              </div>
            }

            <!-- RIGHE AGGIUNTIVE LEGACY (testo libero): sola lettura + elimina.
                 Non se ne creano di nuove (accounting non le può mappare). -->
            @if ((treatment.invoiceLines?.length || 0) > 0) {
              <h3 class="section-h">Righe aggiuntive (testo libero — legacy)</h3>
              <table mat-table [dataSource]="treatment.invoiceLines || []"
                     [trackBy]="trackById" class="mini-table">
                <ng-container matColumnDef="cdescription">
                  <th mat-header-cell *matHeaderCellDef>Descrizione</th>
                  <td mat-cell *matCellDef="let l"><span>{{ l.description }}</span></td>
                </ng-container>
                <ng-container matColumnDef="camount">
                  <th mat-header-cell *matHeaderCellDef class="col-price">Importo</th>
                  <td mat-cell *matCellDef="let l" class="col-price">
                    € {{ l.amount | number:'1.2-2' }}
                  </td>
                </ng-container>
                <ng-container matColumnDef="cactions">
                  <th mat-header-cell *matHeaderCellDef class="col-actions"></th>
                  <td mat-cell *matCellDef="let l" class="col-actions">
                    @if (canAddServiceLine) {
                      <button mat-icon-button color="warn" (click)="deleteInvoiceLine.emit({ mode: 'delete', line: l })" matTooltip="Rimuovi">
                        <mat-icon>delete</mat-icon>
                      </button>
                    }
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="customCols"></tr>
                <tr mat-row *matRowDef="let row; columns: customCols"></tr>
              </table>
            }

            <!-- TOTALI -->
            <div class="totals-row">
              <div>
                <span class="totals-label">Totale a listino:</span>
                € {{ totalPreview | number:'1.2-2' }}
              </div>
              @if (treatment.scontoFE) {
                <div class="warn-banner">
                  <mat-icon>info</mat-icon>
                  Sconto FE attivo — il trattamento non è fatturabile. Rimuovere lo sconto FE per procedere.
                </div>
              }
            </div>

            <mat-divider></mat-divider>

            <!-- TOGGLE SCONTO FE + (se attivo) SEGNA INCASSATO IN CONTANTI -->
            @if (canEditEconomics && !treatment.isInvoicedToPatient) {
              <div class="sconto-fe-row">
                <mat-checkbox
                  [checked]="treatment.scontoFE"
                  [disabled]="treatment.status === TreatmentStatus.CLOSED || scontoFEBlockedByBilling"
                  (change)="onScontoFEToggle($event.checked)">
                  Sconto FE
                </mat-checkbox>
                <span class="hint hint-xs">
                  @if (scontoFEBlockedByBilling) {
                    Bloccato: trattamento già fatturato (serve nota di credito da accounting).
                  } @else if (treatment.status === TreatmentStatus.CLOSED) {
                    Trattamento chiuso: riaprirlo per modificare lo sconto FE.
                  } @else {
                    Se attivo, il trattamento non passa dal sistema di fatturazione (incasso solo nel clinico).
                  }
                </span>

                <!-- Solo con sconto FE: scorciatoia incasso contanti (solo clinico,
                     nessuna fattura). Disattivare annulla l'incasso. -->
                @if (treatment.scontoFE) {
                  <mat-checkbox
                    class="cash-toggle"
                    [checked]="isScontoFeCashPaid"
                    (change)="onMarkScontoFeCash($event.checked)"
                    matTooltip="Registra l'incasso in contanti sull'intero totale (solo clinico, nessuna fattura). Disattiva per annullare l'incasso.">
                    Segna come incassato in contanti
                  </mat-checkbox>
                }
              </div>
            }

            <!-- CTA CHIUDI/RIAPRI TRATTAMENTO (segreteria) -->
            @if (canEditEconomics && treatment.status === TreatmentStatus.OPERATOR_COMPLETED) {
              <div class="close-treatment-cta">
                <mat-icon class="info">done_all</mat-icon>
                <div style="flex: 1">
                  <strong>Trattamento chiuso dall'operatore.</strong>
                  Chiudilo dalla segreteria per marcarlo automaticamente come pronto per la fatturazione.
                </div>
                <button mat-flat-button color="primary" (click)="closeTreatment.emit()">
                  <mat-icon>done_all</mat-icon>
                  Chiudi trattamento
                </button>
              </div>
            }
            @if (canEditEconomics && treatment.status === TreatmentStatus.IN_PROGRESS) {
              <div class="close-treatment-cta">
                <mat-icon class="info">info</mat-icon>
                <div style="flex: 1">
                  <strong>Trattamento ancora in corso.</strong>
                  Normalmente è l'operatore che lo completa. Se l'operatore se ne è dimenticato,
                  puoi forzare la chiusura dopo l'orario di fine appuntamento.
                  @if (!canForceCloseNow()) {
                    <div class="force-close-wait">
                      <mat-icon>schedule</mat-icon>
                      Forza chiusura disponibile dopo le {{ formatAppointmentEnd() }}.
                    </div>
                  }
                </div>
                @if (canForceCloseTreatment) {
                  <button
                    mat-flat-button
                    color="warn"
                    [disabled]="!canForceCloseNow()"
                    (click)="forceCloseTreatment.emit()"
                    [matTooltip]="canForceCloseNow() ? 'Forza chiusura: il trattamento passa direttamente a CLOSED' : 'Disponibile dopo l\\'orario di fine appuntamento'">
                    <mat-icon>lock_clock</mat-icon>
                    Forza chiusura
                  </button>
                }
              </div>
            }
            @if (canEditEconomics && treatment.status === TreatmentStatus.CLOSED) {
              <div class="close-treatment-cta cta-closed">
                <mat-icon class="info">check_circle</mat-icon>
                <div style="flex: 1">
                  <strong>Trattamento chiuso dalla segreteria.</strong>
                  Se serve correggere qualcosa o modificare dati clinici, puoi riaprirlo.
                </div>
                <button mat-stroked-button (click)="reopenTreatment.emit()">
                  <mat-icon>undo</mat-icon>
                  Riapri trattamento
                </button>
              </div>
            }

            <!-- CTA INVIO A FATTURAZIONE -->
            @if (canEditEconomics && canSendToBilling) {
              <div class="send-to-billing-cta">
                <mat-icon class="info">send</mat-icon>
                <div style="flex: 1">
                  <strong>Trattamento chiuso, non ancora inviato.</strong>
                  Puoi inviarlo al sistema di fatturazione (coda "da fatturare"
                  di accounting), oppure usare "Fattura" per l'emissione immediata.
                </div>
                <button mat-flat-button color="accent" (click)="onSendToBilling()">
                  <mat-icon>send</mat-icon>
                  Invia al sistema di fatturazione
                </button>
              </div>
            }

            <!-- BILLING SECTION (sessione 6 — clinico ↔ accounting) -->
            <!-- Mostra status accounting + snapshot fattura/credit-note + alert + azioni.
                 Sopra il toggle "Pronto per fatturazione" per sequenza visiva
                 "stato → azione". I bottoni di azione (Annulla/Riapri/Fattura subito)
                 vivono qui dentro, NON duplicarli altrove. I flag disabled
                 arrivano dal container (Step 6.5) basati su billingStatus.
                 NASCOSTA per i trattamenti sconto FE: non vanno mai ad accounting,
                 lo stato fatturazione non serve e confonde. -->
            @if (!treatment.scontoFE) {
            <app-treatment-billing-section
              [treatment]="treatment"
              [actionsVisible]="canEditEconomics"
              [cancelDisabled]="billingCancelDisabled"
              [cancelDisabledReason]="billingCancelDisabledReason"
              [reopenDisabled]="billingReopenDisabled"
              [reopenDisabledReason]="billingReopenDisabledReason"
              [fatturaVisible]="billingFatturaVisible"
              [fatturaDisabled]="billingFatturaDisabled"
              [fatturaDisabledReason]="billingFatturaDisabledReason"
              [fatturaInFlight]="billingFatturaInFlight"
              [incassaVisible]="billingIncassaVisible"
              [incassaDisabled]="billingIncassaDisabled"
              [incassaDisabledReason]="billingIncassaDisabledReason"
              [incassaInFlight]="billingIncassaInFlight"
              [awaitingFiscalConfig]="billingAwaitingFiscalConfig"
              [retryInvoiceVisible]="billingRetryInvoiceVisible"
              [retryInvoiceDisabled]="billingRetryInvoiceDisabled"
              [retryInvoiceDisabledReason]="billingRetryInvoiceDisabledReason"
              [retryInvoiceInFlight]="billingRetryInvoiceInFlight"
              [recallDisabled]="billingRecallDisabled"
              [recallDisabledReason]="billingRecallDisabledReason"
              [recallInFlight]="billingRecallInFlight"
              [sentWarningLevel]="billingSentWarningLevel"
              [sentWarningMessage]="billingSentWarningMessage"
              [resendVisible]="billingResendVisible"
              [resendDisabled]="billingResendDisabled"
              [resendDisabledReason]="billingResendDisabledReason"
              (dismissAlert)="dismissBillingAlert.emit($event)"
              (cancelTreatment)="cancelTreatmentBilling.emit($event)"
              (reopenTreatment)="reopenTreatmentBilling.emit($event)"
              (invoiceTreatment)="invoiceTreatment.emit($event)"
              (collectPayment)="collectPaymentBilling.emit($event)"
              (retryInvoice)="retryInvoiceBilling.emit($event)"
              (requestRecall)="requestTreatmentRecall.emit($event)"
              (dismissReturnBanner)="dismissReturnFromAccountingBanner.emit($event)"
              (resendToAccounting)="resendToAccounting.emit($event)"
              (printInvoice)="printInvoice.emit($event)">
            </app-treatment-billing-section>
            }

            <!-- 2026-07-10: rimossa la checkbox "Pronto per fatturazione" —
                 faceva la stessa mutation della CTA "Invia al sistema di
                 fatturazione" (doppione che confondeva: sembrava un flag
                 locale ma inviava davvero ad accounting). L'invio passa
                 SOLO dalla CTA sopra o dal pulsante "Fattura". -->

            <!-- FATTURAZIONE STATUS — nascosto per sconto FE (non fatturabile). -->
            @if (!treatment.scontoFE) {
              <div class="invoice-status">
                <strong>Fatturato:</strong>
                @if (treatment.isInvoicedToPatient) {
                  <span class="badge-ok">Sì</span>
                  @if (treatment.patientInvoiceNumber) {
                    — fattura n. {{ treatment.patientInvoiceNumber }}
                  }
                  @if (treatment.invoicedToPatientAt) {
                    — {{ formatDateTime(treatment.invoicedToPatientAt) }}
                  }
                } @else {
                  <span class="badge-no">No</span>
                }
              </div>
            }
          </div>
        </mat-tab>

        <!-- TAB PAGAMENTO -->
        @if (canRecordPayment) {
          <mat-tab label="Pagamento">
            <div class="tab-panel">
              <!-- Fonte del pagamento: chiarisce QUALI metodi sono disponibili -->
              <div class="payment-source-banner" [class.fe]="treatment.scontoFE">
                @if (treatment.scontoFE) {
                  <mat-icon>info</mat-icon>
                  <span>Trattamento con <strong>sconto FE</strong>: il pagamento è gestito
                    solo nel clinico (contanti o voucher FE). Non viene inviato ad accounting.</span>
                } @else {
                  <mat-icon>info</mat-icon>
                  <span>Pagamento sincronizzato con la contabilità: metodi e voucher
                    provengono da <strong>accounting</strong> (anche split su più metodi).</span>
                }
              </div>

              <div class="payment-status">
                <strong>Stato:</strong>
                @if (treatment.isPaid) {
                  <span class="badge-ok">Pagato</span>
                  @if (treatment.paidAt) { il {{ formatDateTime(treatment.paidAt) }} }
                  @if (treatment.price != null) { — € {{ treatment.price | number:'1.2-2' }} }
                  @if (treatment.paymentMethod) { · {{ treatment.paymentMethod }} }
                } @else {
                  <span class="badge-no">Non pagato</span>
                }
              </div>

              <!-- 2026-07-08 — Flusso annulla-e-reinserisci: la vecchia "Modifica
                   pagamento" (replaceExisting) sovrascriveva metodo/data in silenzio,
                   incompatibile con la riconciliazione dei movimenti carte/banca.
                   Per i trattamenti FATTURATI lo storno si fa SOLO da Contabilità
                   (che rimanda payment-reversed): qui il bottone non compare. -->
              <div class="payment-actions">
                @if (!treatment.isPaid) {
                  <button mat-flat-button color="primary" (click)="openPaymentDialog.emit({ replace: false })">
                    <mat-icon>payments</mat-icon> Registra pagamento
                  </button>
                } @else if (!treatment.isInvoicedToPatient) {
                  <button mat-stroked-button color="warn" (click)="cancelPayment.emit()">
                    <mat-icon>money_off</mat-icon> Annulla pagamento
                  </button>
                } @else {
                  <span class="hint" matTooltip="La fattura è emessa: lo storno dell'incasso si fa dalla Contabilità (dettaglio documento → pagamenti registrati). Il trattamento si aggiornerà automaticamente.">
                    Incasso gestito dalla Contabilità
                  </span>
                }
              </div>
            </div>
          </mat-tab>
        }

        <!-- TAB DATI CLINICI (readonly segreteria, readonly per tutti qui) -->
        <mat-tab label="Clinici">
          <div class="tab-panel">
            <div class="clinical-field">
              <label>Note cliniche</label>
              <p>{{ treatment.clinicalNotes || '—' }}</p>
            </div>
            <div class="clinical-field">
              <label>Note operatore</label>
              <p>{{ treatment.operatorNotes || '—' }}</p>
            </div>
            <div class="clinical-field">
              <label>Note paziente</label>
              <p>{{ treatment.patientNotes || '—' }}</p>
            </div>
            <div class="clinical-field-row">
              <div>
                <label>Dolore prima</label>
                <p>{{ treatment.painBefore ?? '—' }}</p>
              </div>
              <div>
                <label>Dolore dopo</label>
                <p>{{ treatment.painAfter ?? '—' }}</p>
              </div>
              <div>
                <label>Dolore livello</label>
                <p>{{ treatment.painLevel ?? '—' }}</p>
              </div>
            </div>
            <div class="clinical-field">
              <label>Strumenti utilizzati</label>
              @if ((treatment.instruments || []).length === 0) {
                <p>—</p>
              } @else {
                <ul>
                  @for (i of treatment.instruments || []; track i.id) {
                    @if (i.wasUsed) {
                      <li>{{ i.instrument?.name || '—' }}</li>
                    }
                  }
                </ul>
              }
            </div>

            <mat-divider></mat-divider>

            <div class="clinical-field">
              <label>Note segreteria</label>
              @if (canEditEconomics) {
                <mat-form-field appearance="outline" class="full-width">
                  <textarea matInput rows="3"
                    [value]="treatment.secretaryNotes || ''"
                    (change)="onSecretaryNotesChange($event)">
                  </textarea>
                </mat-form-field>
              } @else {
                <p>{{ treatment.secretaryNotes || '—' }}</p>
              }
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="closeDialog()">
        <mat-icon>close</mat-icon>
        Chiudi dialog
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; max-height: 80vh; }
    .detail-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding-right: 0;
    }
    .detail-header h2 { margin: 0; }
    .title-wrap { flex: 1; }
    .subtitle {
      font-size: 0.85rem;
      color: rgba(0,0,0,0.6);
      margin-top: 4px;
    }
    .registry-link {
      /* reset stile button → link */
      background: none; border: none; padding: 0; cursor: pointer;
      font: inherit; display: inline-flex; align-items: center; gap: 2px;
      color: var(--curandis-primary, #5fbb47); font-weight: 500;
      text-decoration: none; white-space: nowrap;
    }
    .registry-link:hover { text-decoration: underline; }
    .registry-link mat-icon { font-size: 1rem; height: 1rem; width: 1rem; }
    .detail-content { overflow: auto; }
    .tab-panel { padding: 16px 4px; display: flex; flex-direction: column; gap: 12px; }
    h3 { margin: 16px 0 8px; }
    .section-h { display: flex; align-items: center; gap: 8px; }
    .mini-table { width: 100%; table-layout: fixed; }
    .mini-table th, .mini-table td { vertical-align: top; }
    /* Larghezze fisse per colonne: servizio e importo minimi così la
       descrizione si prende tutto il resto. 'description' senza width
       esplicita = spazio rimanente. */
    .mini-table .col-service { width: 170px; }
    .mini-table .col-description { /* width auto = fills remaining */ }
    .mini-table .col-executor { width: 190px; }
    .mini-table .col-price { width: 110px; text-align: right; }
    .mini-table .col-actions { width: 50px; }
    .executor-select { width: 100%; }
    /* Evidenzia le righe attribuite a un operatore DIVERSO da quello del
       trattamento: attribuzione compenso non standard, deve saltare all'occhio. */
    .executor-override { font-weight: 500; color: #7b1fa2; }
    .desc-input { width: 100%; }
    /* textarea: solo resize verticale (gestito da cdkTextareaAutosize);
       disabilitiamo il resize manuale che creerebbe inconsistenza. */
    .desc-input textarea {
      resize: none;
      line-height: 1.3;
    }
    .amt-input { width: 120px; }
    .svc-select { min-width: 200px; }
    .new-line-form {
      display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
      padding: 8px; background: rgba(0,0,0,0.03); border-radius: 4px;
    }
    .totals-row {
      display: flex; flex-direction: column; gap: 8px;
      padding: 12px; background: rgba(0,0,0,0.03); border-radius: 4px;
    }
    .totals-label { font-weight: 500; }
    .warn-banner {
      display: flex; align-items: center; gap: 8px;
      padding: 8px; background: #fff3cd; color: #856404; border-radius: 4px;
    }
    .sconto-fe-row, .ready-row {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 0;
      flex-wrap: wrap;
    }
    .hint { color: rgba(0,0,0,0.6); font-size: 0.85rem; }
    /* Testo hint compatto accanto allo sconto FE, per far spazio al toggle incasso. */
    .hint-xs { color: rgba(0,0,0,0.55); font-size: 0.72rem; line-height: 1.15; flex: 1 1 180px; min-width: 140px; }
    /* Toggle "incassato in contanti": evidenziato, va a capo se serve spazio. */
    .cash-toggle { margin-left: auto; font-weight: 500; }
    .hint-warn { color: #d32f2f; font-size: 0.85rem; }
    .invoice-status { padding: 8px 0; }
    .badge-ok { color: #2e7d32; font-weight: 500; }
    .badge-no { color: #9e9e9e; }
    .clinical-field { padding: 8px 0; }
    .clinical-field label {
      display: block;
      font-weight: 500;
      color: rgba(0,0,0,0.6);
      margin-bottom: 4px;
    }
    .clinical-field p { margin: 0; white-space: pre-wrap; }
    .clinical-field-row {
      display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;
    }
    .full-width { width: 100%; }
    .payment-status { padding: 8px 0; }
    .payment-form {
      display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;
      padding: 12px; background: rgba(0,0,0,0.03); border-radius: 4px;
    }
    .empty-inline { color: rgba(0,0,0,0.54); margin: 8px 0; }
    .custom-icon {
      font-size: 14px; vertical-align: middle;
      margin-left: 4px; color: rgba(0,0,0,0.54);
    }
    .desc-readonly { white-space: pre-wrap; }
    /* Layout del cell descrizione + azioni:
       - flex row senza wrap (evita che gli action buttons saltino di riga
         quando il textarea cresce in altezza, cosa che faceva variare la
         larghezza disponibile e quindi la resa del textarea stesso).
       - input occupa tutto lo spazio flessibile; gli action hanno larghezza
         fissa e sono allineati in alto per seguire il textarea quando cresce. */
    .desc-cell {
      display: flex;
      align-items: flex-start;
      gap: 4px;
      flex-wrap: nowrap;
      min-width: 0;
    }
    .desc-cell .desc-input {
      flex: 1 1 auto;
      min-width: 0;
    }
    .desc-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      flex: 0 0 auto;
      white-space: nowrap;
      padding-top: 4px;
    }
    /* Icona (18px) che indica la descrizione personalizzata. Segnaposto
       della stessa larghezza quando non personalizzata, così la riga
       non cambia layout al save/reset. */
    .personalized-dot,
    .personalized-placeholder {
      width: 18px;
      height: 18px;
      display: inline-block;
      flex: 0 0 18px;
    }
    .personalized-dot {
      color: #f57c00;
      font-size: 18px;
      line-height: 18px;
    }
    .close-treatment-cta {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px;
      background: #e3f2fd;
      border: 1px solid #1976d2;
      border-radius: 6px;
      margin: 8px 0;
    }
    .close-treatment-cta.cta-closed {
      background: #e8f5e9;
      border-color: #388e3c;
    }
    .close-treatment-cta.cta-closed mat-icon.info { color: #388e3c; }
    .close-treatment-cta mat-icon.info { color: #1976d2; }
    .force-close-wait {
      margin-top: 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      color: rgba(0, 0, 0, 0.55);
    }
    .force-close-wait mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px;
      margin-left: 8px;
      color: white;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
      vertical-align: middle;
    }
    .status-chip mat-icon {
      font-size: 14px; width: 14px; height: 14px;
    }
    .status-chip-accent {
      background: #f57c00 !important;
    }
    .status-chip-warn {
      background: #b91c1c !important;
    }
    .send-to-billing-cta {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px;
      background: #fff3e0;
      border: 1px solid #f57c00;
      border-radius: 6px;
      margin: 8px 0;
    }
    .send-to-billing-cta mat-icon.info { color: #f57c00; }
  `],
})
export class TrattamentoDetailComponent {
  readonly TreatmentStatus = TreatmentStatus;
  readonly TreatmentBillingStatus = TreatmentBillingStatus;

  /** Trattamento corrente. Esposto come campo pubblico perché il container
   * può aggiornarlo dopo una mutation; il setter triggera markForCheck per
   * far aggiornare la vista (il component è OnPush). */
  private _treatment!: Trattamento;
  @Input() set treatment(t: Trattamento) {
    this._treatment = t;
    this.cdr?.markForCheck();
  }
  get treatment(): Trattamento {
    return this._treatment;
  }

  @Input() canEditEconomics = false;
  @Input() canRecordPayment = false;
  /**
   * True se il chiamante ha il permesso `treatment_force_close`
   * (segreteria/admin). Quando false, il bottone "Forza chiusura" non
   * compare nemmeno: la regola di business rimane comunque enforced
   * a livello di backend dal guard.
   */
  @Input() canForceCloseTreatment = false;
  /**
   * Catalogo servizi per il dropdown "aggiungi riga servizio". Include la
   * tariffa di listino (`defaultPrice`) e quella scontoFE (`discountFE`), usate
   * per pre-riempire il prezzo alla selezione. La descrizione NON è pre-caricata
   * (resta auto-generata se lasciata vuota).
   */
  @Input() serviceCatalog: {
    id: string;
    name: string;
    defaultPrice?: number;
    discountFE?: number;
  }[] = [];
  /**
   * 2026-07-15 — Catalogo operatori per il selettore "Eseguito da" (a chi
   * va il compenso della riga). Vuoto per i non-segreteria: la riga resta
   * attribuita all'operatore del trattamento.
   */
  @Input() operatorCatalog: { id: string; label: string }[] = [];

  @Output() updateServiceDescription = new EventEmitter<DetailUpdateServiceDescriptionPayload>();
  @Output() createInvoiceLine = new EventEmitter<DetailEditInvoiceLinePayload>();
  @Output() updateInvoiceLine = new EventEmitter<DetailEditInvoiceLinePayload>();
  @Output() deleteInvoiceLine = new EventEmitter<DetailEditInvoiceLinePayload>();
  /** 2026-07-02 — Aggiungi riga servizio (dal catalogo). */
  @Output() addServiceLine = new EventEmitter<{
    serviceId: string;
    description?: string;
    price?: number;
    executorOperatorId?: string | null;
  }>();
  /** 2026-07-02 — Rimuovi riga servizio. Emette il TreatmentService.id. */
  @Output() removeServiceLine = new EventEmitter<string>();
  /** 2026-07-15 — Cambia l'operatore esecutore di una riga ("Eseguito da"). */
  @Output() changeServiceLineExecutor = new EventEmitter<{
    treatmentServiceId: string;
    executorOperatorId: string | null;
  }>();
  @Output() updateEconomics = new EventEmitter<DetailUpdateEconomicsPayload>();
  /** Toggle "Segna come incassato in contanti" (sconto FE). Emette il nuovo stato. */
  @Output() markScontoFeCash = new EventEmitter<boolean>();
  /**
   * Emesso per aprire il dialog di pagamento (split + voucher + fonte). Il
   * payload `replace` indica se si sta CORREGGENDO un pagamento già registrato.
   */
  @Output() openPaymentDialog = new EventEmitter<{ replace: boolean }>();
  /** 2026-07-08 — Annulla il pagamento registrato (solo se non fatturato). */
  @Output() cancelPayment = new EventEmitter<void>();
  @Output() sendToBilling = new EventEmitter<void>();
  @Output() closeTreatment = new EventEmitter<void>();

  // Vincoli BillingSection (Step 6.5). Default conservativo: tutto disabled
  // finché il container non sblocca esplicitamente sulla base di billingStatus.
  @Input() billingCancelDisabled = true;
  @Input() billingCancelDisabledReason: string | null = null;
  @Input() billingReopenDisabled = true;
  @Input() billingReopenDisabledReason: string | null = null;
  // Flusso "Fattura" → "Incassa" (due passi). Vedi treatment-billing-section.
  @Input() billingFatturaVisible = false;
  @Input() billingFatturaDisabled = true;
  @Input() billingFatturaDisabledReason: string | null = null;
  @Input() billingFatturaInFlight = false;
  @Input() billingIncassaVisible = false;
  @Input() billingIncassaDisabled = true;
  @Input() billingIncassaDisabledReason: string | null = null;
  @Input() billingIncassaInFlight = false;
  @Input() billingAwaitingFiscalConfig = false;
  // 2026-06-30 — "Verifica risoluzione e riprova" (invoice-blocked retry)
  @Input() billingRetryInvoiceVisible = false;
  @Input() billingRetryInvoiceDisabled = true;
  @Input() billingRetryInvoiceDisabledReason: string | null = null;
  @Input() billingRetryInvoiceInFlight = false;
  // Sessione 7 — recall flags
  @Input() billingRecallDisabled = true;
  @Input() billingRecallDisabledReason: string | null = null;
  @Input() billingRecallInFlight = false;
  // Sessione 7 — Warning SENT prolungato + Forza re-invio
  @Input() billingSentWarningLevel: 'none' | 'soft' | 'hard' = 'none';
  @Input() billingSentWarningMessage: string | null = null;
  @Input() billingResendVisible = false;
  @Input() billingResendDisabled = true;
  @Input() billingResendDisabledReason: string | null = null;

  // Output dalla BillingSection (sessione 6 — clinico ↔ accounting).
  // Emettono treatmentId; il container gestisce le mutation reali.
  @Output() dismissBillingAlert = new EventEmitter<string>();
  @Output() cancelTreatmentBilling = new EventEmitter<string>();
  @Output() reopenTreatmentBilling = new EventEmitter<string>();
  /** "Fattura": chiede ad accounting di emettere (no pagamento). */
  @Output() invoiceTreatment = new EventEmitter<string>();
  /** "Incassa": registra il pagamento sul totale confermato. */
  @Output() collectPaymentBilling = new EventEmitter<string>();
  /** "Verifica risoluzione e riprova": ri-tenta l'emissione fattura. */
  @Output() retryInvoiceBilling = new EventEmitter<string>();
  // Sessione 7 — recall outputs
  @Output() requestTreatmentRecall = new EventEmitter<string>();
  @Output() dismissReturnFromAccountingBanner = new EventEmitter<string>();
  // Sessione 7 — Forza re-invio ad accounting
  @Output() resendToAccounting = new EventEmitter<string>();
  @Output() printInvoice = new EventEmitter<string>();
  @Output() reopenTreatment = new EventEmitter<void>();
  /** Emette la richiesta di force-close (segreteria/admin). */
  @Output() forceCloseTreatment = new EventEmitter<void>();

  svcCols = ['service', 'description', 'executor', 'price', 'sactions'];
  customCols = ['cdescription', 'camount', 'cactions'];

  newLineOpen = false;
  newLineDescription = '';
  newLineAmount: number | null = null;

  // 2026-07-02 — Form "aggiungi riga servizio" (sostituisce il testo libero).
  newServiceOpen = false;
  newServiceId: string | null = null;
  newServiceDescription = '';
  newServicePrice: number | null = null;
  /** Esecutore della riga in creazione. null = operatore del trattamento. */
  newServiceExecutorId: string | null = null;
  /**
   * 2026-07-04 — True se l'operatore ha modificato a mano il prezzo della riga
   * in creazione. Finché è false, il toggle scontoFE riallinea il prezzo alla
   * tariffa giusta; una volta true, il prezzo manuale è rispettato.
   */
  newServicePriceEdited = false;

  /**
   * Map di edit in corso per le descrizioni delle righe servizio.
   * Chiave = TreatmentService.id. Quando l'utente edita, il valore qui
   * diverge dal ts.invoiceLineDescription salvato: il pulsante Salva
   * si abilita finché non vengono allineati.
   */
  private descriptionEdits: Map<string, string> = new Map();

  constructor(
    private dialogRef: MatDialogRef<TrattamentoDetailComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DetailDialogData,
    private cdr: ChangeDetectorRef,
  ) {
    this.treatment = data.treatment;
    this.canEditEconomics = data.canEditEconomics;
    this.canRecordPayment = data.canRecordPayment;
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  /**
   * True se l'orario di fine appuntamento è già passato.
   * Regola di business: la chiusura forzata è consentita SOLO dopo
   * la fine prevista del trattamento (es. appointment 15-16 del 22/4 →
   * disponibile dal 22/4 16:00 in poi). Prima il bottone è disabilitato e
   * mostriamo all'utente quando potrà essere usato.
   */
  canForceCloseNow(): boolean {
    const end = this.appointmentEndDateTime();
    if (!end) return false;
    return Date.now() >= end.getTime();
  }

  /** Etichetta leggibile dell'orario fine appuntamento per il messaggio UI. */
  formatAppointmentEnd(): string {
    const end = this.appointmentEndDateTime();
    if (!end) return '—';
    return end.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** Combina appointmentDate + endTime in un Date. Null se manca un campo. */
  private appointmentEndDateTime(): Date | null {
    const appt = this.treatment?.appointment;
    if (!appt?.appointmentDate || !appt?.endTime) return null;
    // ISO format con offset locale: "YYYY-MM-DDTHH:MM" è interpretato come ora locale.
    const iso = `${appt.appointmentDate}T${appt.endTime}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  get totalPreview(): number {
    const svc = (this.treatment.treatmentServices || []).reduce(
      (s, ts) => s + (Number(ts.price) || 0), 0);
    const cust = (this.treatment.invoiceLines || []).reduce(
      (s, l) => s + (Number(l.amount) || 0), 0);
    return svc + cust;
  }

  /**
   * True se lo sconto FE NON può essere abilitato perché il trattamento è già
   * fatturato (INVOICED+): in tal caso il backend rifiuta l'abilitazione finché
   * non si emette una nota di credito. Disabilitiamo il toggle per dare un
   * feedback immediato (il backend resta comunque la fonte di verità).
   * NB: per SENT/PENDING il toggle resta abilitato — abilitare lo sconto FE lì
   * scatena l'auto-recall (recupero da accounting), che è consentito.
   */
  get scontoFEBlockedByBilling(): boolean {
    const status = this.treatment.billingStatus;
    return (
      status === TreatmentBillingStatus.Invoiced ||
      status === TreatmentBillingStatus.PartiallyRefunded ||
      status === TreatmentBillingStatus.Refunded ||
      status === TreatmentBillingStatus.Reissued
    );
  }

  get statusLabel(): string {
    switch (this.treatment.status) {
      case TreatmentStatus.WAITING: return 'In attesa';
      case TreatmentStatus.IN_PROGRESS: return 'In corso';
      case TreatmentStatus.OPERATOR_COMPLETED: return 'Chiuso da operatore';
      case TreatmentStatus.CLOSED: return 'Chiuso dalla segreteria';
      default: return this.treatment.status as string;
    }
  }

  get statusColor(): string {
    switch (this.treatment.status) {
      case TreatmentStatus.WAITING: return '#9e9e9e';
      case TreatmentStatus.IN_PROGRESS: return '#2196f3';
      case TreatmentStatus.OPERATOR_COMPLETED: return '#ff9800';
      case TreatmentStatus.CLOSED: return '#4caf50';
      default: return '#9e9e9e';
    }
  }

  /**
   * CTA "Invia al sistema di fatturazione" disponibile SOLO se:
   * - status=CLOSED (chiuso dalla segreteria — la chiusura marca il
   *   billingStatus READY_FOR_BILLING)
   * - scontoFE=false (escluso da fatturazione)
   * - billingStatus IN (NOT_READY, READY_FOR_BILLING) — esclude i
   *   trattamenti già SENT/PENDING/INVOICED/CANCELLED. Una volta
   *   inviato non si può re-inviare (idempotenza UI). Per fattura
   *   immediata usare il bottone "Fattura" in BillingSection.
   */
  get canSendToBilling(): boolean {
    if (this.treatment.status !== TreatmentStatus.CLOSED) return false;
    if (this.treatment.scontoFE === true) return false;
    const status = this.treatment.billingStatus;
    return status == null
      || status === TreatmentBillingStatus.NotReady
      || status === TreatmentBillingStatus.ReadyForBilling;
  }

  /**
   * Emit `sendToBilling` al container parent, che chiama la mutation
   * `setReadyForBilling([id], true)`. Il backend marca readyForBilling
   * (= inviato, con timestamp), pubblica `treatment.closed.<tenant>` →
   * consumer accounting crea BillableEvent → `billable.received` aggiorna
   * il treatment a SENT/PENDING. AutoIssue non scatta
   * (requestImmediateInvoice=false); per l'emissione immediata usare il
   * bottone "Fattura" in BillingSection.
   */
  onSendToBilling(): void {
    this.sendToBilling.emit();
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  formatDateTime(isoOrDate: string | Date): string {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    return d.toLocaleString('it-IT');
  }

  // ==================== SERVICE DESCRIPTION EDIT ====================

  /**
   * Ritorna il valore da mostrare nell'input:
   * - l'edit in corso se presente;
   * - altrimenti la descrizione salvata (personalizzata);
   * - altrimenti quella auto-generata come fallback.
   */
  currentDescriptionFor(ts: TrattamentoServizio): string {
    if (this.descriptionEdits.has(ts.id)) {
      return this.descriptionEdits.get(ts.id) ?? '';
    }
    return ts.invoiceLineDescription ?? ts.invoiceLineDescriptionAuto ?? '';
  }

  setDescriptionEdit(treatmentServiceId: string, value: string): void {
    this.descriptionEdits.set(treatmentServiceId, value);
  }

  /**
   * True se il trattamento ha una descrizione personalizzata salvata
   * (cioè l'utente l'ha modificata rispetto all'auto-generata).
   */
  isPersonalized(ts: TrattamentoServizio): boolean {
    return ts.invoiceLineDescription != null && ts.invoiceLineDescription !== '';
  }

  /**
   * True se c'è un'edit non ancora salvata diversa dal valore persistito.
   */
  canSaveDescription(ts: TrattamentoServizio): boolean {
    if (!this.descriptionEdits.has(ts.id)) return false;
    const edit = this.descriptionEdits.get(ts.id) ?? '';
    const saved = ts.invoiceLineDescription ?? '';
    return edit !== saved;
  }

  /**
   * Si può ripristinare all'auto solo se c'è una descrizione personalizzata
   * salvata (altrimenti siamo già in modalità auto).
   */
  canResetDescription(ts: TrattamentoServizio): boolean {
    return this.isPersonalized(ts);
  }

  saveDescription(ts: TrattamentoServizio): void {
    const edit = (this.descriptionEdits.get(ts.id) ?? '').trim();
    this.updateServiceDescription.emit({
      treatmentServiceId: ts.id,
      description: edit.length > 0 ? edit : undefined,
    });
    // Consumato: finché arriva il refresh, togliamo l'edit locale.
    this.descriptionEdits.delete(ts.id);
  }

  resetDescription(ts: TrattamentoServizio): void {
    this.updateServiceDescription.emit({
      treatmentServiceId: ts.id,
      description: undefined,
    });
    this.descriptionEdits.delete(ts.id);
  }

  /**
   * trackBy per mat-table: evita che un refresh del dataSource distrugga
   * e ricrei le righe (e quindi i textarea dentro), cosa che causava un
   * flicker visivo durante il salva/reset.
   */
  trackById = (_index: number, item: { id: string }): string => item.id;

  onCustomDescriptionChange(line: TrattamentoInvoiceLine, ev: Event): void {
    const desc = (ev.target as HTMLInputElement).value;
    if (desc === line.description) return;
    this.updateInvoiceLine.emit({
      mode: 'update',
      line,
      input: { id: line.id, description: desc },
    });
  }

  onCustomAmountChange(line: TrattamentoInvoiceLine, ev: Event): void {
    const amt = Number((ev.target as HTMLInputElement).value);
    if (isNaN(amt) || amt === line.amount) return;
    this.updateInvoiceLine.emit({
      mode: 'update',
      line,
      input: { id: line.id, amount: amt },
    });
  }

  startNewInvoiceLine(): void {
    this.newLineOpen = true;
    this.newLineDescription = '';
    this.newLineAmount = null;
  }

  cancelNewInvoiceLine(): void {
    this.newLineOpen = false;
    this.newLineDescription = '';
    this.newLineAmount = null;
  }

  confirmNewInvoiceLine(): void {
    if (!this.newLineDescription) return;
    this.createInvoiceLine.emit({
      mode: 'create',
      input: {
        description: this.newLineDescription,
        amount: Number(this.newLineAmount ?? 0),
      },
    });
    this.cancelNewInvoiceLine();
  }

  /**
   * True se si possono aggiungere/rimuovere righe: segreteria, non fatturato,
   * e NON chiuso dalla segreteria (trattamento chiuso → riaprirlo prima).
   */
  get canAddServiceLine(): boolean {
    return (
      this.canEditEconomics &&
      !this.treatment.isInvoicedToPatient &&
      this.treatment.status !== TreatmentStatus.CLOSED
    );
  }

  /**
   * URL della scheda paziente nella sezione Anagrafiche della suite (nuova
   * tab). Il patientId del trattamento è il subjectId del registry. La suite
   * è su `gestione.<host-corrente>` (es. gestione.bdq.curandis.cloud). In
   * locale/dev (nessun sottodominio) ritorna null → link nascosto.
   * Vedi frontend/CLAUDE.md sezione "Link cross-modulo".
   */
  get registryPatientUrl(): string | null {
    const subjectId = this.treatment.patientId;
    if (!subjectId) return null;
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || !host.includes('.')) {
      return null;
    }
    return `https://gestione.${host}/anagrafiche/subjects/${subjectId}`;
  }

  /** Apre la scheda paziente nel registry in una nuova scheda. */
  openRegistryPatient(): void {
    const url = this.registryPatientUrl;
    if (url) {
      window.open(url, '_blank', 'noopener');
    }
  }

  startNewServiceLine(): void {
    this.newServiceOpen = true;
    this.newServiceId = null;
    this.newServiceDescription = '';
    this.newServicePrice = null;
    this.newServicePriceEdited = false;
    this.newServiceExecutorId = null;
  }

  cancelNewServiceLine(): void {
    this.newServiceOpen = false;
    this.newServiceId = null;
    this.newServiceDescription = '';
    this.newServicePrice = null;
    this.newServicePriceEdited = false;
    this.newServiceExecutorId = null;
  }

  /** Etichetta dell'operatore del trattamento (default "Eseguito da"). */
  get treatmentOperatorLabel(): string {
    const op = this.treatment?.operator;
    if (!op) return 'Operatore del trattamento';
    return `${op.name} ${op.surname ?? ''}`.trim();
  }

  /**
   * Opzioni del selettore "Eseguito da": tutti gli operatori tranne quello
   * del trattamento (rappresentato dall'opzione null di default).
   */
  get executorOptions(): { id: string; label: string }[] {
    const treatmentOpId = this.treatment?.operator?.id;
    return this.operatorCatalog.filter((o) => o.id !== treatmentOpId);
  }

  /** Nome mostrato in sola lettura nella colonna "Eseguito da". */
  executorLabelFor(ts: {
    executorOperator?: { name: string; surname?: string | null } | null;
  }): string {
    if (ts.executorOperator) {
      return `${ts.executorOperator.name} ${ts.executorOperator.surname ?? ''}`.trim();
    }
    return this.treatmentOperatorLabel;
  }

  onExecutorChange(ts: { id: string }, executorOperatorId: string | null): void {
    this.changeServiceLineExecutor.emit({
      treatmentServiceId: ts.id,
      executorOperatorId,
    });
  }

  /**
   * Tariffa del servizio secondo lo stato scontoFE indicato: usa `discountFE`
   * se scontoFE attivo e valorizzato, altrimenti la tariffa di listino
   * (`defaultPrice`). Rispecchia la logica del backend.
   */
  private tariffForService(
    svc: { defaultPrice?: number; discountFE?: number },
    scontoFE: boolean,
  ): number | null {
    if (scontoFE && svc.discountFE != null) return Number(svc.discountFE);
    return svc.defaultPrice != null ? Number(svc.defaultPrice) : null;
  }

  /**
   * 2026-07-04 — Alla selezione di un servizio pre-carica SOLO il prezzo
   * (tariffa di listino, o scontoFE se attivo). La descrizione resta vuota di
   * proposito: se lasciata così viene auto-generata al salvataggio secondo le
   * regole configurate; l'operatore può comunque personalizzarla qui.
   */
  onNewServiceSelected(): void {
    const svc = this.serviceCatalog.find((s) => s.id === this.newServiceId);
    if (!svc) return;
    this.newServicePrice = this.tariffForService(
      svc,
      this.treatment.scontoFE === true,
    );
    // Prezzo appena caricato dalla tariffa: non è una modifica manuale, così il
    // toggle scontoFE può ancora riallinearlo.
    this.newServicePriceEdited = false;
  }

  /** L'operatore ha modificato a mano il prezzo della riga in creazione. */
  onNewServicePriceChange(value: number | null): void {
    this.newServicePrice =
      value === null || (value as any) === '' ? null : Number(value);
    this.newServicePriceEdited = true;
  }

  confirmNewServiceLine(): void {
    if (!this.newServiceId) return;
    const desc = this.newServiceDescription.trim();
    const svc = this.serviceCatalog.find((s) => s.id === this.newServiceId);
    const tariff = svc
      ? this.tariffForService(svc, this.treatment.scontoFE === true)
      : null;
    // Invia un prezzo ESPLICITO (→ isCustomPrice=true lato backend) solo se
    // l'operatore lo ha portato via dalla tariffa corrente. Se è rimasto al
    // valore di listino/scontoFE, invia undefined: la riga continua a tracciare
    // la tariffa e si aggiorna da sola al variare dello scontoFE.
    const entered =
      this.newServicePrice === null || (this.newServicePrice as any) === ''
        ? null
        : Number(this.newServicePrice);
    const isCustom =
      entered !== null &&
      (tariff === null || Math.abs(entered - tariff) >= 0.005);
    this.addServiceLine.emit({
      serviceId: this.newServiceId,
      description: desc || undefined,
      price: isCustom ? entered : undefined,
      executorOperatorId: this.newServiceExecutorId,
    });
    this.cancelNewServiceLine();
  }

  onScontoFEToggle(checked: boolean): void {
    this.updateEconomics.emit({ scontoFE: checked });
    // Se il form "aggiungi riga" è aperto e il prezzo non è stato modificato a
    // mano, riallinealo alla tariffa giusta (scontoFE se attivo, altrimenti
    // listino). Resta comunque modificabile in locale.
    if (this.newServiceOpen && this.newServiceId && !this.newServicePriceEdited) {
      const svc = this.serviceCatalog.find((s) => s.id === this.newServiceId);
      if (svc) {
        this.newServicePrice = this.tariffForService(svc, checked);
      }
    }
  }

  /**
   * True se il trattamento è già incassato IN CONTANTI (per lo stato del toggle
   * "Segna come incassato in contanti"). Confronto case-insensitive: il valore
   * dell'enum può arrivare come 'CASH' o 'cash' a seconda della serializzazione.
   */
  get isScontoFeCashPaid(): boolean {
    return (
      !!this.treatment.isPaid &&
      String(this.treatment.paymentMethod ?? '').toUpperCase() === 'CASH'
    );
  }

  onMarkScontoFeCash(checked: boolean): void {
    this.markScontoFeCash.emit(checked);
  }

  onSecretaryNotesChange(ev: Event): void {
    const v = (ev.target as HTMLTextAreaElement).value;
    if (v === (this.treatment.secretaryNotes || '')) return;
    this.updateEconomics.emit({ secretaryNotes: v });
  }

}

// `BillingSubmitInfoDialog` rimosso 2026-05-09: era placeholder
// pre-Sessione 6 ("integrazione in fase di predisposizione"). Ora
// l'invio al sistema di fatturazione chiama davvero
// `setReadyForBilling([id], true)` via `sendToBilling.emit()`.

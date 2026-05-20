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
          @if (treatment.readyForBilling) {
            <span class="status-chip status-chip-accent" matTooltip="Pronto per fatturazione">
              <mat-icon inline>check_circle</mat-icon>
              Pronto
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
          {{ formatDate(treatment.appointment.appointmentDate) }}
          • {{ treatment.appointment.startTime }}
          • {{ treatment.operator.name }} {{ treatment.operator.surname }}
          @if (treatment.operator.professionalRegistration) {
            • {{ treatment.operator.professionalRegistration }}
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
            <!-- RIGHE SERVIZIO -->
            <h3>Righe servizio</h3>
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
              <ng-container matColumnDef="price">
                <th mat-header-cell *matHeaderCellDef class="col-price">Importo</th>
                <td mat-cell *matCellDef="let ts" class="col-price">
                  € {{ (ts.price || 0) | number:'1.2-2' }}
                  @if (ts.isCustomPrice) {
                    <mat-icon class="custom-icon" matTooltip="Prezzo personalizzato">edit</mat-icon>
                  }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="svcCols"></tr>
              <tr mat-row *matRowDef="let row; columns: svcCols"></tr>
            </table>

            <!-- RIGHE CUSTOM SEGRETERIA -->
            <h3 class="section-h">
              Righe aggiuntive (segreteria)
              @if (canEditEconomics && !treatment.isInvoicedToPatient) {
                <button mat-icon-button color="primary" (click)="startNewInvoiceLine()" matTooltip="Aggiungi riga">
                  <mat-icon>add</mat-icon>
                </button>
              }
            </h3>

            @if ((treatment.invoiceLines || []).length === 0 && !newLineOpen) {
              <p class="empty-inline">Nessuna riga aggiuntiva.</p>
            }

            @if ((treatment.invoiceLines?.length || 0) > 0) {
              <table mat-table [dataSource]="treatment.invoiceLines || []"
                     [trackBy]="trackById" class="mini-table">
                <ng-container matColumnDef="cdescription">
                  <th mat-header-cell *matHeaderCellDef>Descrizione</th>
                  <td mat-cell *matCellDef="let l">
                    @if (canEditEconomics && !treatment.isInvoicedToPatient) {
                      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="desc-input">
                        <textarea matInput
                          cdkTextareaAutosize
                          cdkAutosizeMinRows="1"
                          cdkAutosizeMaxRows="5"
                          [value]="l.description"
                          (change)="onCustomDescriptionChange(l, $event)">
                        </textarea>
                      </mat-form-field>
                    } @else {
                      <span>{{ l.description }}</span>
                    }
                  </td>
                </ng-container>
                <ng-container matColumnDef="camount">
                  <th mat-header-cell *matHeaderCellDef class="col-price">Importo</th>
                  <td mat-cell *matCellDef="let l" class="col-price">
                    @if (canEditEconomics && !treatment.isInvoicedToPatient) {
                      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="amt-input">
                        <input matInput type="number" step="0.01"
                          [value]="l.amount"
                          (change)="onCustomAmountChange(l, $event)"/>
                      </mat-form-field>
                    } @else {
                      € {{ l.amount | number:'1.2-2' }}
                    }
                  </td>
                </ng-container>
                <ng-container matColumnDef="cactions">
                  <th mat-header-cell *matHeaderCellDef class="col-actions"></th>
                  <td mat-cell *matCellDef="let l" class="col-actions">
                    @if (canEditEconomics && !treatment.isInvoicedToPatient) {
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

            @if (newLineOpen) {
              <div class="new-line-form">
                <mat-form-field appearance="outline" class="desc-input">
                  <mat-label>Descrizione</mat-label>
                  <input matInput [(ngModel)]="newLineDescription"/>
                </mat-form-field>
                <mat-form-field appearance="outline" class="amt-input">
                  <mat-label>Importo</mat-label>
                  <input matInput type="number" step="0.01" [(ngModel)]="newLineAmount"/>
                </mat-form-field>
                <button mat-flat-button color="primary" (click)="confirmNewInvoiceLine()" [disabled]="!newLineDescription">
                  Salva
                </button>
                <button mat-stroked-button (click)="cancelNewInvoiceLine()">Annulla</button>
              </div>
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

            <!-- TOGGLE SCONTO FE -->
            @if (canEditEconomics && !treatment.isInvoicedToPatient) {
              <div class="sconto-fe-row">
                <mat-checkbox
                  [checked]="treatment.scontoFE"
                  [disabled]="treatment.status === TreatmentStatus.CLOSED"
                  (change)="onScontoFEToggle($event.checked)">
                  Sconto FE
                </mat-checkbox>
                <span class="hint">
                  @if (treatment.status === TreatmentStatus.CLOSED) {
                    Trattamento chiuso dalla segreteria: per modificare lo sconto FE riaprirlo prima.
                  } @else {
                    Se attivo, il trattamento non sarà fatturabile e "Pronto per fatturazione" verrà disattivato.
                  }
                </span>
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
                  <strong>Pronto per la fatturazione.</strong>
                  Puoi inviare questo trattamento al sistema di fatturazione.
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
                 arrivano dal container (Step 6.5) basati su billingStatus. -->
            <app-treatment-billing-section
              [treatment]="treatment"
              [cancelDisabled]="billingCancelDisabled"
              [cancelDisabledReason]="billingCancelDisabledReason"
              [reopenDisabled]="billingReopenDisabled"
              [reopenDisabledReason]="billingReopenDisabledReason"
              [immediateInvoiceDisabled]="billingImmediateInvoiceDisabled"
              [immediateInvoiceDisabledReason]="billingImmediateInvoiceDisabledReason"
              (dismissAlert)="dismissBillingAlert.emit($event)"
              (cancelTreatment)="cancelTreatmentBilling.emit($event)"
              (reopenTreatment)="reopenTreatmentBilling.emit($event)"
              (immediateInvoice)="immediateInvoiceBilling.emit($event)">
            </app-treatment-billing-section>

            <!-- READY FOR BILLING -->
            @if (canEditEconomics) {
              <div class="ready-row">
                <mat-checkbox
                  [checked]="treatment.readyForBilling"
                  [disabled]="!canMarkReady"
                  (change)="toggleReadyForBilling.emit($event.checked)">
                  Pronto per fatturazione
                </mat-checkbox>
                @if (treatment.readyForBillingAt) {
                  <small class="hint">(marcato il {{ formatDateTime(treatment.readyForBillingAt) }})</small>
                }
                @if (treatment.status !== TreatmentStatus.CLOSED) {
                  <small class="hint-warn">Richiede trattamento chiuso dalla segreteria.</small>
                }
                @if (treatment.scontoFE) {
                  <small class="hint-warn">Disattivato: sconto FE attivo.</small>
                }
              </div>
            }

            <!-- FATTURAZIONE STATUS -->
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
          </div>
        </mat-tab>

        <!-- TAB PAGAMENTO -->
        @if (canRecordPayment) {
          <mat-tab label="Pagamento">
            <div class="tab-panel">
              <div class="payment-status">
                <strong>Stato:</strong>
                @if (treatment.isPaid) {
                  <span class="badge-ok">Pagato</span>
                  @if (treatment.paidAt) {
                    il {{ formatDateTime(treatment.paidAt) }}
                  }
                  @if (treatment.paymentMethod) {
                    via {{ treatment.paymentMethod }}
                  }
                } @else {
                  <span class="badge-no">Non pagato</span>
                }
              </div>

              @if (!treatment.isPaid && treatment.status !== TreatmentStatus.CLOSED) {
                <div class="payment-form">
                  <mat-form-field appearance="outline">
                    <mat-label>Metodo</mat-label>
                    <mat-select [(ngModel)]="newPaymentMethod">
                      @for (m of paymentMethods; track m) {
                        <mat-option [value]="m">{{ m }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Importo (opzionale)</mat-label>
                    <input matInput type="number" step="0.01" [(ngModel)]="newPaymentAmount"/>
                  </mat-form-field>
                  <button mat-flat-button color="primary" (click)="confirmPayment()" [disabled]="!newPaymentMethod">
                    <mat-icon>payments</mat-icon>
                    Registra pagamento
                  </button>
                </div>
              } @else if (treatment.status === TreatmentStatus.CLOSED) {
                <p class="hint-warn">Il trattamento è chiuso: pagamento non più modificabile.</p>
              }
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
                      <li>{{ i.instrument.name }}</li>
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
    .mini-table .col-price { width: 110px; text-align: right; }
    .mini-table .col-actions { width: 50px; }
    .desc-input { width: 100%; }
    /* textarea: solo resize verticale (gestito da cdkTextareaAutosize);
       disabilitiamo il resize manuale che creerebbe inconsistenza. */
    .desc-input textarea {
      resize: none;
      line-height: 1.3;
    }
    .amt-input { width: 120px; }
    .new-line-form {
      display: flex; gap: 8px; align-items: center;
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
    }
    .hint { color: rgba(0,0,0,0.6); font-size: 0.85rem; }
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
  readonly paymentMethods: PaymentMethod[] = [
    PaymentMethod.CASH,
    PaymentMethod.CARD,
    PaymentMethod.TRANSFER,
    PaymentMethod.SATISPAY,
    PaymentMethod.OTHER,
  ];

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

  @Output() updateServiceDescription = new EventEmitter<DetailUpdateServiceDescriptionPayload>();
  @Output() createInvoiceLine = new EventEmitter<DetailEditInvoiceLinePayload>();
  @Output() updateInvoiceLine = new EventEmitter<DetailEditInvoiceLinePayload>();
  @Output() deleteInvoiceLine = new EventEmitter<DetailEditInvoiceLinePayload>();
  @Output() updateEconomics = new EventEmitter<DetailUpdateEconomicsPayload>();
  @Output() recordPayment = new EventEmitter<DetailRecordPaymentPayload>();
  @Output() toggleReadyForBilling = new EventEmitter<boolean>();
  @Output() closeTreatment = new EventEmitter<void>();

  // Vincoli BillingSection (Step 6.5). Default conservativo: tutto disabled
  // finché il container non sblocca esplicitamente sulla base di billingStatus.
  @Input() billingCancelDisabled = true;
  @Input() billingCancelDisabledReason: string | null = null;
  @Input() billingReopenDisabled = true;
  @Input() billingReopenDisabledReason: string | null = null;
  @Input() billingImmediateInvoiceDisabled = true;
  @Input() billingImmediateInvoiceDisabledReason: string | null = null;

  // Output dalla BillingSection (sessione 6 — clinico ↔ accounting).
  // Emettono treatmentId; il container gestisce le mutation reali.
  @Output() dismissBillingAlert = new EventEmitter<string>();
  @Output() cancelTreatmentBilling = new EventEmitter<string>();
  @Output() reopenTreatmentBilling = new EventEmitter<string>();
  @Output() immediateInvoiceBilling = new EventEmitter<string>();
  @Output() reopenTreatment = new EventEmitter<void>();
  /** Emette la richiesta di force-close (segreteria/admin). */
  @Output() forceCloseTreatment = new EventEmitter<void>();

  svcCols = ['service', 'description', 'price'];
  customCols = ['cdescription', 'camount', 'cactions'];

  newLineOpen = false;
  newLineDescription = '';
  newLineAmount: number | null = null;

  newPaymentMethod: PaymentMethod = PaymentMethod.CASH;
  newPaymentAmount: number | null = null;

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

  get canMarkReady(): boolean {
    return this.treatment.status === TreatmentStatus.CLOSED
      && !this.treatment.scontoFE
      && !this.treatment.isInvoicedToPatient;
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
   * - readyForBilling=true (operatore ha cliccato il toggle)
   * - scontoFE=false (escluso da fatturazione)
   * - billingStatus IN (NOT_READY, READY_FOR_BILLING) — esclude i
   *   trattamenti già SENT/PENDING/INVOICED/CANCELLED. Una volta
   *   inviato non si può re-inviare (idempotenza UI). Per fattura
   *   immediata usare il bottone separato in BillingSection.
   */
  get canSendToBilling(): boolean {
    if (this.treatment.readyForBilling !== true) return false;
    if (this.treatment.scontoFE === true) return false;
    const status = this.treatment.billingStatus;
    return status == null
      || status === TreatmentBillingStatus.NotReady
      || status === TreatmentBillingStatus.ReadyForBilling;
  }

  /**
   * Sessione 6 chiusa: emit `toggleReadyForBilling(true)` al container
   * parent, che chiama la mutation backend `setReadyForBilling([id], true)`.
   * Il backend pubblica `treatment.closed.<tenant>` → consumer accounting
   * crea BillableEvent → `billable.received` aggiorna treatment a SENT/PENDING.
   * AutoIssue non scatta (requestImmediateInvoice=false). Per "Fattura subito
   * + incassa" usare il bottone separato in BillingSection (Step 6.5).
   */
  onSendToBilling(): void {
    this.toggleReadyForBilling.emit(true);
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

  onScontoFEToggle(checked: boolean): void {
    this.updateEconomics.emit({ scontoFE: checked });
  }

  onSecretaryNotesChange(ev: Event): void {
    const v = (ev.target as HTMLTextAreaElement).value;
    if (v === (this.treatment.secretaryNotes || '')) return;
    this.updateEconomics.emit({ secretaryNotes: v });
  }

  confirmPayment(): void {
    if (!this.newPaymentMethod || !this.data.currentUserId) return;
    this.recordPayment.emit({
      paymentMethod: this.newPaymentMethod,
      collectedBy: this.data.currentUserId,
      amount: this.newPaymentAmount ?? undefined,
    });
  }
}

// `BillingSubmitInfoDialog` rimosso 2026-05-09: era placeholder
// pre-Sessione 6 ("integrazione in fase di predisposizione"). Ora
// l'invio al sistema di fatturazione chiama davvero
// `setReadyForBilling([id], true)` via `toggleReadyForBilling.emit(true)`.

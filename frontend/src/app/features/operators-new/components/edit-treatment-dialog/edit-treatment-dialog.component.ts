/**
 * Edit Treatment Dialog Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilita:
 * - Form UI per modificare un trattamento in corso
 * - Input: dati dialog, stati loading
 * - Output: eventi save, cancel
 * - NO logica business, NO chiamate service
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatRadioModule } from '@angular/material/radio';
import { MatDatepickerModule, MatDatepickerInputEvent } from '@angular/material/datepicker';

import {
  EditTreatmentDialogData,
  EditTreatmentFormResult,
  EditTreatmentInstrumentInput,
  BaseInstrumentData,
  ReschedulingType
} from '../../models/edit-treatment-dialog.model';
import { PaymentMethod, PaymentTenderLine } from '../../../../models/treatment.model';
import {
  ServiceMultiSelectComponent,
  SelectableService,
  SelectedServiceItem
} from '../../../../shared/components/service-multi-select';

@Component({
  selector: 'app-edit-treatment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatRadioModule,
    MatDatepickerModule,
    ServiceMultiSelectComponent
  ],
  template: `
    @if (isVisible && data) {
      <div class="dialog-overlay"
           (mousedown)="onOverlayMouseDown($event)"
           (click)="onOverlayClick($event)">
        <div class="dialog-container" (click)="$event.stopPropagation()" (mousedown)="$event.stopPropagation()">
          <!-- Header -->
          <header class="dialog-header">
            <div class="header-content">
              <mat-icon class="header-icon">edit_note</mat-icon>
              <div class="header-text">
                <h2>Modifica Trattamento</h2>
                <div class="header-meta">
                  @if (data.treatment.patient) {
                    <span class="patient-name">
                      {{ data.treatment.patient.nome }} {{ data.treatment.patient.cognome }}
                    </span>
                  }
                  @if (data.treatment.status) {
                    <span class="status-badge" [class]="'status-' + data.treatment.status?.toLowerCase()">
                      {{ getStatusLabel(data.treatment.status) }}
                    </span>
                  }
                </div>
              </div>
            </div>
            <button mat-icon-button (click)="onCancel()" class="close-btn">
              <mat-icon>close</mat-icon>
            </button>
          </header>

          <!-- Content -->
          <div class="dialog-content">
            <form [formGroup]="form">
              <!-- Selezione Percorso Terapeutico -->
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Percorso Terapeutico</mat-label>
                <mat-select formControlName="therapeuticPathId">
                  @for (path of data.availablePaths; track path.id) {
                    <mat-option [value]="path.id">
                      {{ path.name }}
                      @if (path.primaryOperatorName) {
                        <span class="path-operator"> - {{ path.primaryOperatorName }}</span>
                      }
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <!-- Selezione Servizi (Multi-select) -->
              @if (selectableServices.length) {
                <div class="services-section">
                  <label class="section-label">Servizi</label>
                  <app-service-multi-select
                    [availableServices]="selectableServices"
                    [selectedServices]="selectedServices"
                    [useScontoFE]="form.get('scontoFE')?.value"
                    [showPrices]="true"
                    [editablePrices]="true"
                    [disabled]="false"
                    (selectedServicesChange)="onServicesChange($event)"
                    (totalPriceChange)="onTotalPriceChange($event)">
                  </app-service-multi-select>
                </div>
              }

              <!-- Sezione Valutazione Dolore (espansa) -->
              <mat-expansion-panel class="pain-expansion-panel" expanded>
                <mat-expansion-panel-header>
                  <mat-panel-title>
                    <mat-icon>assessment</mat-icon>
                    Valutazione Dolore (VAS)
                  </mat-panel-title>
                </mat-expansion-panel-header>

                <div class="pain-assessment">
                  <div class="pain-slider-group">
                    <label>Dolore Prima: {{ form.get('painBefore')?.value ?? '-' }}/10</label>
                    <mat-slider min="0" max="10" step="1" discrete class="pain-slider">
                      <input matSliderThumb formControlName="painBefore">
                    </mat-slider>
                    <button mat-icon-button type="button" (click)="clearPainBefore()" matTooltip="Rimuovi">
                      <mat-icon>clear</mat-icon>
                    </button>
                  </div>
                  <div class="pain-slider-group">
                    <label>Dolore Dopo: {{ form.get('painAfter')?.value ?? '-' }}/10</label>
                    <mat-slider min="0" max="10" step="1" discrete class="pain-slider">
                      <input matSliderThumb formControlName="painAfter">
                    </mat-slider>
                    <button mat-icon-button type="button" (click)="clearPainAfter()" matTooltip="Rimuovi">
                      <mat-icon>clear</mat-icon>
                    </button>
                  </div>
                </div>
              </mat-expansion-panel>

              <!-- Note Cliniche -->
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Note Cliniche</mat-label>
                <textarea matInput formControlName="clinicalNotes" rows="3"
                          placeholder="Note cliniche per il trattamento..."></textarea>
              </mat-form-field>

              <!-- Note Paziente -->
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Note per il Paziente</mat-label>
                <textarea matInput formControlName="patientNotes" rows="2"
                          placeholder="Indicazioni per il paziente..."></textarea>
              </mat-form-field>

              <!-- Note Segreteria -->
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Note Segreteria</mat-label>
                <textarea matInput formControlName="secretaryNotes" rows="2"
                          placeholder="Comunicazioni per la segreteria..."></textarea>
              </mat-form-field>

              <!-- Prezzo e Sconto FE -->
              <div class="price-sconto-section">
                <div class="price-row">
                  <mat-form-field appearance="outline" class="price-field">
                    <mat-label>Prezzo</mat-label>
                    <mat-icon matPrefix>euro</mat-icon>
                    <input matInput type="number" formControlName="price" min="0" step="0.01">
                  </mat-form-field>

                  <mat-slide-toggle formControlName="scontoFE" color="primary">
                    Sconto FE
                  </mat-slide-toggle>
                </div>

                <div class="cash-collection-section">
                  @if (!cashCollected) {
                    <button mat-raised-button color="accent"
                            type="button"
                            (click)="onCashCollection()"
                            class="cash-btn">
                      <mat-icon>payments</mat-icon>
                      Incassa
                    </button>
                    <span class="payment-source-hint">
                      @if (form.get('scontoFE')?.value) {
                        Sconto FE attivo: incasso solo nel clinico (contanti / voucher FE).
                      } @else {
                        Metodi di pagamento da contabilità (incasso sincronizzato).
                      }
                    </span>
                  } @else {
                    <div class="cash-collected-badge">
                      <mat-icon>check_circle</mat-icon>
                      <span>Incassato: {{ (collectedAmount ?? form.get('price')?.value) | currency:'EUR' }}</span>
                      <button mat-icon-button (click)="resetCashCollection()" matTooltip="Annulla incasso">
                        <mat-icon>cancel</mat-icon>
                      </button>
                    </div>
                  }
                </div>
              </div>

              <!-- Sezione Riprogrammazione (espansa) -->
              <mat-expansion-panel class="expansion-section" expanded>
                <mat-expansion-panel-header>
                  <mat-panel-title>
                    <mat-icon>event_repeat</mat-icon>
                    Riprogrammazione
                  </mat-panel-title>
                </mat-expansion-panel-header>

                <div class="rescheduling-section">
                  <mat-radio-group formControlName="reschedulingType" class="reschedule-options">
                    <mat-radio-button value="none">Nessuna</mat-radio-button>
                    <mat-radio-button value="days">Fra N giorni</mat-radio-button>
                    <mat-radio-button value="range">Intervallo date</mat-radio-button>
                  </mat-radio-group>

                  @if (form.get('reschedulingType')?.value === 'days') {
                    <mat-form-field appearance="outline" class="days-field">
                      <mat-label>Giorni</mat-label>
                      <input matInput type="number" formControlName="suggestInDays" min="1">
                    </mat-form-field>
                  }

                  @if (form.get('reschedulingType')?.value === 'range') {
                    <div class="date-range">
                      <mat-form-field appearance="outline">
                        <mat-label>Da</mat-label>
                        <input matInput [matDatepicker]="pickerStart" formControlName="suggestDateRangeStart"
                               [min]="minDateStart" (dateChange)="onStartDateChange($event)">
                        <mat-datepicker-toggle matIconSuffix [for]="pickerStart"></mat-datepicker-toggle>
                        <mat-datepicker #pickerStart></mat-datepicker>
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>A</mat-label>
                        <input matInput [matDatepicker]="pickerEnd" formControlName="suggestDateRangeEnd"
                               [min]="minDateEnd">
                        <mat-datepicker-toggle matIconSuffix [for]="pickerEnd"></mat-datepicker-toggle>
                        <mat-datepicker #pickerEnd></mat-datepicker>
                      </mat-form-field>
                    </div>
                  }

                  @if (form.get('reschedulingType')?.value !== 'none') {
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Note riprogrammazione</mat-label>
                      <textarea matInput formControlName="reschedulingNotes" rows="2"></textarea>
                    </mat-form-field>
                  }
                </div>
              </mat-expansion-panel>

              <mat-divider></mat-divider>

              <!-- Strumenti Utilizzati -->
              <div class="instruments-section" formArrayName="instruments">
                <div class="section-header">
                  <h3>
                    <mat-icon>build</mat-icon>
                    Strumenti Utilizzati
                  </h3>
                  <button mat-stroked-button type="button" (click)="addInstrument()">
                    <mat-icon>add</mat-icon>
                    Aggiungi
                  </button>
                </div>

                @if (instrumentsArray.length === 0) {
                  <p class="no-instruments">Nessuno strumento selezionato</p>
                }

                @for (instrCtrl of instrumentsArray.controls; track $index; let i = $index) {
                  <div class="instrument-row" [formGroupName]="i">
                    <mat-form-field appearance="outline" class="instrument-select">
                      <mat-label>Strumento</mat-label>
                      <mat-select formControlName="instrumentId">
                        @for (inst of data.availableInstruments; track inst.id) {
                          <mat-option [value]="inst.id">
                            {{ inst.name }}
                            @if (inst.category?.name) {
                              <span class="instrument-category"> ({{ inst.category.name }})</span>
                            }
                          </mat-option>
                        }
                      </mat-select>
                    </mat-form-field>

                    <mat-checkbox formControlName="wasUsed" matTooltip="Utilizzato">
                      Usato
                    </mat-checkbox>

                    <button mat-icon-button type="button" color="warn" (click)="removeInstrument(i)"
                            matTooltip="Rimuovi strumento">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                }
              </div>
            </form>
          </div>

          <!-- Footer -->
          <footer class="dialog-footer">
            <div class="footer-left">
              <button mat-raised-button color="primary"
                      [disabled]="!form.valid || isSaving"
                      (click)="onSave()">
                @if (isSaving) {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  <mat-icon>save</mat-icon>
                  Salva Modifiche
                }
              </button>
              <button mat-button (click)="onCancel()" [disabled]="isSaving">
                Annulla
              </button>
            </div>
            <div class="footer-right">
              @if (data.treatment.status?.toLowerCase() === 'in_progress') {
                <button mat-raised-button color="accent"
                        [disabled]="!form.valid || isSaving"
                        (click)="onCompleteTreatment()">
                  <mat-icon>check_circle</mat-icon>
                  Completa Trattamento
                </button>
              }
              @if (data.treatment.status?.toLowerCase() === 'operator_completed') {
                <button mat-raised-button color="warn"
                        [disabled]="isSaving"
                        (click)="onReopenTreatment()">
                  <mat-icon>replay</mat-icon>
                  Riapri Trattamento
                </button>
              }
              @if (data.treatment.status?.toLowerCase() === 'closed' && !data.treatment.isInvoicedToPatient) {
                <button mat-raised-button color="warn"
                        [disabled]="isSaving"
                        (click)="onReopenTreatment()"
                        matTooltip="Riapre il trattamento riportandolo allo stato 'completato da operatore'">
                  <mat-icon>replay</mat-icon>
                  Riapri Trattamento (segreteria)
                </button>
              }
            </div>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .dialog-container {
      background: white;
      border-radius: 8px;
      width: 90%;
      max-width: 650px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px 24px;
      border-bottom: 1px solid #e0e0e0;
      background: #f5f5f5;
      border-radius: 8px 8px 0 0;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #ff9800;
    }

    .header-text {
      display: flex;
      flex-direction: column;
    }

    .header-text h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
    }

    .header-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .patient-name {
      color: #666;
      font-size: 14px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-in_progress {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .status-operator_completed {
      background: #fef3c7;
      color: #92400e;
    }

    .status-closed {
      background: #dcfce7;
      color: #166534;
    }

    .close-btn {
      margin: -8px -8px 0 0;
    }

    .dialog-content {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }

    .full-width {
      width: 100%;
    }

    .price-sconto-section {
      margin: 16px 0;
      padding: 16px;
      background: #fafafa;
      border-radius: 8px;
    }

    .price-row {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .price-field {
      width: 200px;
    }

    .cash-collection-section {
      margin-top: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .payment-source-hint {
      font-size: 12px;
      color: #666;
    }

    .cash-btn {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .cash-collected-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #e8f5e9;
      border-radius: 4px;
      color: #2e7d32;

      mat-icon {
        color: #2e7d32;
      }
    }

    .pain-expansion-panel {
      margin: 16px 0;

      mat-panel-title {
        display: flex;
        align-items: center;
        gap: 8px;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }
    }

    .pain-assessment {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 0;
    }

    .pain-slider-group {
      display: flex;
      align-items: center;
      gap: 16px;

      label {
        min-width: 160px;
        font-size: 14px;
      }

      .pain-slider {
        flex: 1;
      }
    }

    .expansion-section {
      margin: 16px 0;

      mat-panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .rescheduling-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 8px 0;
    }

    .reschedule-options {
      display: flex;
      gap: 16px;
    }

    .days-field {
      width: 120px;
    }

    .date-range {
      display: flex;
      gap: 16px;

      mat-form-field {
        flex: 1;
      }
    }

    mat-divider {
      margin: 24px 0;
    }

    .instruments-section {
      margin-top: 16px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 16px;
        font-weight: 500;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }
    }

    .no-instruments {
      color: #999;
      font-style: italic;
      text-align: center;
      padding: 16px;
    }

    .instrument-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      padding: 8px;
      background: #fafafa;
      border-radius: 4px;
    }

    .instrument-select {
      flex: 1;
    }

    .instrument-category {
      color: #999;
      font-size: 12px;
    }

    .dialog-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
      background: #fafafa;
      border-radius: 0 0 8px 8px;
    }

    .footer-left {
      display: flex;
      gap: 12px;
    }

    .footer-right {
      display: flex;
      gap: 12px;
    }

    .path-operator {
      color: #666;
      font-size: 12px;
    }

    .service-price {
      color: #666;
      font-size: 12px;
    }

    .services-section {
      margin-bottom: 16px;
    }

    .section-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #333;
      margin-bottom: 8px;
    }

    /* Fix per notched outline Angular Material */
    ::ng-deep {
      .mdc-notched-outline__notch {
        border-left: none !important;
        border-right: none !important;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditTreatmentDialogComponent implements OnInit, OnChanges {
  @Input() data!: EditTreatmentDialogData;
  @Input() isVisible = false;
  @Input() isSaving = false;

  @Output() save = new EventEmitter<EditTreatmentFormResult>();
  @Output() cancel = new EventEmitter<void>();
  @Output() cashCollection = new EventEmitter<void>();
  @Output() completeTreatment = new EventEmitter<EditTreatmentFormResult | null>();
  @Output() reopenTreatment = new EventEmitter<void>();

  form!: FormGroup;
  cashCollected = false;
  cashPaymentMethod?: PaymentMethod;
  /** Split scelto nel dialog di pagamento (solo per incassi NUOVI, non ancora salvati). */
  pendingTenderLines?: PaymentTenderLine[];
  pendingCollectedBy?: string;
  collectedAmount?: number;

  // Servizi selezionati per multi-select
  selectedServices: SelectedServiceItem[] = [];

  // Servizi disponibili convertiti per il componente multi-select (calcolato una volta sola)
  selectableServices: SelectableService[] = [];

  // Flag per evitare che valueChanges sovrascrivano i dati durante populateForm
  private isPopulating = false;

  // Date minime per i datepicker riprogrammazione
  minDateStart: Date = new Date();  // Oggi
  minDateEnd: Date = new Date();    // Inizialmente oggi, poi aggiornata quando cambia data inizio

  // Overlay click tracking (per evitare chiusura durante click-and-drag)
  overlayMouseDownTarget: EventTarget | null = null;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Log per debug
    console.log('[EditTreatmentDialog] ngOnChanges:', {
      dataChanged: !!changes['data'],
      isVisibleChanged: !!changes['isVisible'],
      isVisible: this.isVisible,
      treatmentId: this.data?.treatment?.id,
      therapeuticPathId: this.data?.treatment?.therapeuticPathId
    });

    // Popola il form quando data cambia
    if (changes['data'] && this.data && this.form) {
      this.populateForm();
    }
    // Popola SEMPRE il form quando il dialog diventa visibile (aggiunto check this.form)
    if (changes['isVisible'] && this.isVisible && this.data && this.form) {
      this.populateForm();
    }
  }

  private initForm(): void {
    this.form = this.fb.group({
      therapeuticPathId: [''],
      serviceId: [''],
      clinicalNotes: [''],
      secretaryNotes: [''],
      patientNotes: [''],
      price: [0, [Validators.min(0)]],
      scontoFE: [false],
      painLevel: [null],
      painBefore: [null],
      painAfter: [null],
      // Rescheduling fields
      reschedulingType: ['none'],
      suggestInDays: [null],
      suggestDateRangeStart: [null as Date | null],
      suggestDateRangeEnd: [null as Date | null],
      reschedulingNotes: [''],
      instruments: this.fb.array([])
    });

    // Aggiorna prezzo quando cambia servizio o sconto FE
    this.form.get('serviceId')?.valueChanges.subscribe(() => this.updatePrice());
    this.form.get('scontoFE')?.valueChanges.subscribe(() => {
      this.updatePrice();
      // Il toggle scontoFE cambia la FONTE dei metodi di pagamento (clinico vs
      // accounting): un incasso pendente selezionato con l'altra fonte non è
      // più valido, quindi va azzerato in ENTRAMBE le direzioni.
      if (!this.isPopulating) {
        this.resetCashCollection();
      }
    });
  }

  private updatePrice(): void {
    // Non aggiornare il prezzo durante il caricamento iniziale dei dati
    if (this.isPopulating) return;

    // Usa la logica multi-servizi se ci sono servizi selezionati
    if (this.selectedServices.length > 0) {
      this.updatePriceFromServices();
      return;
    }

    // Fallback per retrocompatibilità con servizio singolo
    const serviceId = this.form.get('serviceId')?.value;
    const isScontoFE = this.form.get('scontoFE')?.value;
    const service = this.data?.availableServices?.find(s => s.id === serviceId);

    if (service) {
      // Usa discountFE se sconto FE attivo, altrimenti defaultPrice
      const price = isScontoFE && service.discountFE != null
        ? service.discountFE
        : service.defaultPrice;
      if (price != null) {
        this.form.patchValue({ price });
      }
    }
  }

  /**
   * Aggiorna il prezzo in base ai servizi selezionati e allo sconto FE
   */
  private updatePriceFromServices(): void {
    const isScontoFE = this.form.get('scontoFE')?.value;
    let total = 0;

    for (const item of this.selectedServices) {
      // Se isCustomPrice è true, usa customPrice fisso
      if (item.isCustomPrice && item.customPrice !== undefined && item.customPrice !== null) {
        total += item.customPrice;
      } else {
        // Altrimenti calcola in base a scontoFE
        total += this.getCalculatedPriceForService(item, isScontoFE);
      }
    }

    this.form.patchValue({ price: total });
  }

  /**
   * Calcola il prezzo di un servizio in base al flag scontoFE.
   * Usato quando il prezzo non è stato personalizzato manualmente.
   */
  private getCalculatedPriceForService(item: SelectedServiceItem, isScontoFE: boolean): number {
    const service = item.service || this.selectableServices.find(s => s.id === item.serviceId);
    if (!service) return 0;

    if (isScontoFE && service.discountFE !== undefined && service.discountFE !== null) {
      return service.discountFE;
    }
    return service.defaultPrice || 0;
  }

  /**
   * Handler per il cambio dei servizi selezionati
   */
  onServicesChange(services: SelectedServiceItem[]): void {
    this.selectedServices = services;
    this.updatePriceFromServices();
    this.cdr.markForCheck();
  }

  /**
   * Handler per il cambio del prezzo totale calcolato dal componente multi-select
   */
  onTotalPriceChange(totalPrice: number): void {
    this.form.patchValue({ price: totalPrice });
    this.cdr.markForCheck();
  }

  private populateForm(): void {
    if (!this.data?.treatment) return;

    // Attiva flag per evitare che valueChanges sovrascrivano il prezzo salvato
    this.isPopulating = true;

    const t = this.data.treatment;

    // Calcola selectableServices UNA SOLA VOLTA per evitare cicli infiniti di change detection
    // (i getter che creano nuovi oggetti causano infinite loops con OnPush)
    this.selectableServices = (this.data?.availableServices || []).map(s => ({
      id: s.id,
      name: s.name,
      defaultPrice: s.defaultPrice ?? undefined,
      discountFE: s.discountFE ?? undefined,
      defaultDuration: s.defaultDuration ?? undefined
    }));

    // Log per debug
    console.log('[EditTreatmentDialog] populateForm called with:', {
      treatmentId: t.id,
      therapeuticPathId: t.therapeuticPathId,
      serviceId: t.serviceId,
      price: t.price,
      scontoFE: t.scontoFE,
      reschedulingType: t.reschedulingType,
      suggestInDays: t.suggestInDays
    });

    // Determina il tipo di riprogrammazione basato sui dati esistenti
    let reschedulingType: ReschedulingType = 'none';
    if (t.reschedulingType) {
      reschedulingType = t.reschedulingType as ReschedulingType;
    } else if (t.rescheduleRequested) {
      // Fallback per retrocompatibilità
      reschedulingType = 'days';
    }

    // Helper per parsare le date dal backend (stringhe "YYYY-MM-DD") a Date
    const parseDate = (dateStr: Date | string | undefined): Date | null => {
      if (!dateStr) return null;
      if (dateStr instanceof Date) return dateStr;
      // Aggiungi ora per evitare problemi timezone
      const date = new Date(dateStr + 'T00:00:00');
      return isNaN(date.getTime()) ? null : date;
    };

    const startDateParsed = parseDate(t.suggestDateRangeStart);
    const endDateParsed = parseDate(t.suggestDateRangeEnd);

    this.form.patchValue({
      therapeuticPathId: t.therapeuticPathId || '',
      serviceId: t.serviceId || '',
      clinicalNotes: t.clinicalNotes || '',
      secretaryNotes: t.secretaryNotes || '',
      patientNotes: t.patientNotes || '',
      price: t.price || 0,
      scontoFE: t.scontoFE || false,
      painLevel: t.painLevel || null,
      painBefore: t.painBefore ?? null,
      painAfter: t.painAfter ?? null,
      // Rescheduling fields - carica dai dati salvati
      reschedulingType: reschedulingType,
      suggestInDays: t.suggestInDays ?? null,
      suggestDateRangeStart: startDateParsed,
      suggestDateRangeEnd: endDateParsed,
      reschedulingNotes: t.reschedulingNotes || ''
    });

    // Aggiorna minDateEnd se c'è già una data di inizio
    if (startDateParsed) {
      const nextDay = new Date(startDateParsed);
      nextDay.setDate(nextDay.getDate() + 1);
      this.minDateEnd = nextDay;
    }

    // Disattiva flag dopo il patchValue
    this.isPopulating = false;

    // Popola selectedServices dai servizi del trattamento
    this.populateServicesFromTreatment();

    // Leggi stato pagamento dal trattamento (invece di resettare sempre).
    // Un pagamento già registrato NON ha pendingTenderLines: il badge mostra
    // lo stato, ma al salvataggio non viene ri-registrato nulla.
    if (t.isPaid) {
      this.cashCollected = true;
      this.cashPaymentMethod = t.paymentMethod;
      this.collectedAmount = undefined;
    } else {
      this.resetCashCollection();
    }
    this.pendingTenderLines = undefined;
    this.pendingCollectedBy = undefined;

    // Popola strumenti - usa treatment instruments o appointment instruments come fallback
    this.clearInstruments();
    const instruments: BaseInstrumentData[] = (t.instruments || this.data.appointmentInstruments || []) as BaseInstrumentData[];
    instruments.forEach(inst => {
      this.addInstrument({
        instrumentId: inst.instrumentId || inst.instrument?.id || '',
        instrumentName: inst.instrument?.name || '',
        instrumentCategoryId: inst.instrumentCategoryId || undefined,
        wasUsed: inst.wasUsed ?? true,
        startOffsetMinutes: inst.startOffsetMinutes,
        endOffsetMinutes: inst.endOffsetMinutes
      });
    });
  }

  /**
   * Popola selectedServices dai servizi del trattamento (treatmentServices)
   * oppure dal singolo serviceId legacy
   */
  private populateServicesFromTreatment(): void {
    if (!this.data?.treatment) return;

    const t = this.data.treatment;

    // Se ci sono treatmentServices (nuovo sistema), usali
    if (t.treatmentServices && t.treatmentServices.length > 0) {
      this.selectedServices = t.treatmentServices.map((ts, idx) => {
        const fullService = this.data.availableServices?.find(s => s.id === ts.serviceId);
        // Se isCustomPrice è true, il prezzo è stato personalizzato manualmente
        // altrimenti lascia customPrice undefined per seguire la logica scontoFE
        const isCustom = ts.isCustomPrice ?? false;
        return {
          serviceId: ts.serviceId,
          service: fullService ? {
            id: fullService.id,
            name: fullService.name,
            defaultPrice: fullService.defaultPrice ?? undefined,
            discountFE: fullService.discountFE ?? undefined,
            defaultDuration: fullService.defaultDuration ?? undefined
          } : (ts.service ? {
            id: ts.service.id,
            name: ts.service.name,
            defaultPrice: ts.service.defaultPrice ?? undefined,
            discountFE: ts.service.discountFE ?? undefined,
            defaultDuration: ts.service.duration ?? undefined
          } : undefined),
          customPrice: isCustom ? ts.price : undefined,
          isCustomPrice: isCustom,
          orderPosition: ts.orderPosition ?? idx
        };
      });
    }
    // Fallback: usa serviceId singolo (sistema legacy)
    else if (t.serviceId) {
      const service = this.data.availableServices?.find(s => s.id === t.serviceId);
      if (service) {
        this.selectedServices = [{
          serviceId: service.id,
          service: {
            id: service.id,
            name: service.name,
            defaultPrice: service.defaultPrice ?? undefined,
            discountFE: service.discountFE ?? undefined,
            defaultDuration: service.defaultDuration ?? undefined
          },
          orderPosition: 0
        }];
      } else {
        this.selectedServices = [];
      }
    } else {
      this.selectedServices = [];
    }
  }

  get instrumentsArray(): FormArray {
    return this.form.get('instruments') as FormArray;
  }

  addInstrument(instrument?: Partial<EditTreatmentInstrumentInput>): void {
    const group = this.fb.group({
      instrumentId: [instrument?.instrumentId || '', Validators.required],
      instrumentCategoryId: [instrument?.instrumentCategoryId || ''],
      wasUsed: [instrument?.wasUsed ?? true],
      startOffsetMinutes: [instrument?.startOffsetMinutes || 0],
      endOffsetMinutes: [instrument?.endOffsetMinutes || 0],
      notes: [instrument?.notes || '']
    });
    this.instrumentsArray.push(group);
  }

  removeInstrument(index: number): void {
    this.instrumentsArray.removeAt(index);
  }

  clearInstruments(): void {
    while (this.instrumentsArray.length > 0) {
      this.instrumentsArray.removeAt(0);
    }
  }

  clearPainLevel(): void {
    this.form.patchValue({ painLevel: null });
  }

  clearPainBefore(): void {
    this.form.patchValue({ painBefore: null });
  }

  clearPainAfter(): void {
    this.form.patchValue({ painAfter: null });
  }

  // Cash collection methods
  onCashCollection(): void {
    this.cashCollection.emit();
  }

  setCashCollected(
    paymentMethod: PaymentMethod,
    tenderLines?: PaymentTenderLine[],
    collectedBy?: string,
    amount?: number,
  ): void {
    this.cashCollected = true;
    this.cashPaymentMethod = paymentMethod;
    this.pendingTenderLines = tenderLines;
    this.pendingCollectedBy = collectedBy;
    this.collectedAmount = amount;
    this.cdr.markForCheck();
  }

  resetCashCollection(): void {
    this.cashCollected = false;
    this.cashPaymentMethod = undefined;
    this.pendingTenderLines = undefined;
    this.pendingCollectedBy = undefined;
    this.collectedAmount = undefined;
  }

  /**
   * Gestisce il cambio della data di inizio riprogrammazione
   * Aggiorna la data minima per la data di fine
   */
  onStartDateChange(event: MatDatepickerInputEvent<Date>): void {
    const startDate = event.value;
    if (startDate) {
      // La data minima di fine è il giorno successivo alla data di inizio
      const nextDay = new Date(startDate);
      nextDay.setDate(nextDay.getDate() + 1);
      this.minDateEnd = nextDay;

      // Se la data fine attuale è <= data inizio, resettala
      const endDate = this.form.get('suggestDateRangeEnd')?.value;
      if (endDate && endDate <= startDate) {
        this.form.patchValue({ suggestDateRangeEnd: null });
      }
    }
  }

  onOverlayMouseDown(event: MouseEvent): void {
    this.overlayMouseDownTarget = event.target;
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.overlayMouseDownTarget === event.currentTarget &&
        event.target === event.currentTarget) {
      this.onCancel();
    }
    this.overlayMouseDownTarget = null;
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onCompleteTreatment(): void {
    // Salva SEMPRE le modifiche prima di completare/chiudere il trattamento.
    // Non ci basiamo su form.dirty perche' alcune modifiche (servizi multi-select,
    // incasso operatore) usano patchValue/stato esterno e non marcano il form come dirty:
    // farlo perderebbe quelle modifiche alla chiusura.
    if (!this.form.valid) return;
    this.completeTreatment.emit(this.buildFormResult());
  }

  onReopenTreatment(): void {
    this.reopenTreatment.emit();
  }

  getStatusLabel(status: string): string {
    switch (status?.toLowerCase()) {
      case 'in_progress': return 'In corso';
      case 'operator_completed': return 'Completato';
      case 'closed': return 'Chiuso';
      default: return status || '';
    }
  }

  onSave(): void {
    if (!this.form.valid) return;
    this.save.emit(this.buildFormResult());
  }

  private buildFormResult(): EditTreatmentFormResult {
    const formValue = this.form.value;

    // Helper per formattare Date in stringa ISO YYYY-MM-DD
    const formatDate = (date: Date | null): string | undefined => {
      if (!date) return undefined;
      return date.toISOString().split('T')[0];
    };

    // Costruisci array di treatmentServices dai servizi selezionati
    // Se isCustomPrice è true, usa customPrice; altrimenti calcola in base a scontoFE
    const isScontoFE = formValue.scontoFE;
    const treatmentServices = this.selectedServices.map((item, idx) => {
      let price: number;
      if (item.isCustomPrice && item.customPrice !== undefined) {
        // Prezzo personalizzato manualmente
        price = item.customPrice;
      } else {
        // Calcola prezzo in base a scontoFE
        price = this.getCalculatedPriceForService(item, isScontoFE);
      }
      return {
        serviceId: item.serviceId,
        price,
        isCustomPrice: item.isCustomPrice ?? false,
        orderPosition: item.orderPosition ?? idx
      };
    });

    return {
      therapeuticPathId: formValue.therapeuticPathId || undefined,
      // Manteniamo serviceId per retrocompatibilità (primo servizio selezionato)
      serviceId: this.selectedServices.length > 0 ? this.selectedServices[0].serviceId : (formValue.serviceId || undefined),
      clinicalNotes: formValue.clinicalNotes || undefined,
      secretaryNotes: formValue.secretaryNotes || undefined,
      patientNotes: formValue.patientNotes || undefined,
      price: formValue.price,
      scontoFE: formValue.scontoFE,
      painLevel: formValue.painLevel || undefined,
      painBefore: formValue.painBefore || undefined,
      painAfter: formValue.painAfter || undefined,
      // Nuovo: servizi multipli del trattamento
      treatmentServices: treatmentServices.length > 0 ? treatmentServices : undefined,
      // Rescheduling fields
      reschedulingType: formValue.reschedulingType,
      suggestInDays: formValue.suggestInDays || undefined,
      suggestDateRangeStart: formatDate(formValue.suggestDateRangeStart),
      suggestDateRangeEnd: formatDate(formValue.suggestDateRangeEnd),
      reschedulingNotes: formValue.reschedulingNotes || undefined,
      rescheduleRequested: formValue.reschedulingType !== 'none',
      instruments: formValue.instruments.map((i: any) => ({
        instrumentId: i.instrumentId,
        instrumentCategoryId: i.instrumentCategoryId || undefined,
        wasUsed: i.wasUsed,
        startOffsetMinutes: i.startOffsetMinutes,
        endOffsetMinutes: i.endOffsetMinutes,
        notes: i.notes || undefined
      })),
      // Cash collection
      collectedByOperator: this.cashCollected,
      paymentMethod: this.cashPaymentMethod,
      tenderLines: this.pendingTenderLines,
      collectedBy: this.pendingCollectedBy,
      collectedAmount: this.collectedAmount
    };
  }
}

/**
 * Start Treatment Dialog Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Form UI per iniziare un nuovo trattamento
 * - Input: dati dialog, percorsi attivi, stati loading
 * - Output: eventi save, cancel, cashCollection
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
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule, MatDatepickerInputEvent } from '@angular/material/datepicker';

import {
  StartTreatmentDialogData,
  StartTreatmentFormResult,
  ReschedulingType
} from '../../models/start-treatment-dialog.model';
import {
  ServiceMultiSelectComponent,
  SelectableService,
  SelectedServiceItem
} from '../../../../shared/components/service-multi-select';

@Component({
  selector: 'app-start-treatment-dialog',
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
    MatExpansionModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDatepickerModule,
    ServiceMultiSelectComponent
  ],
  template: `
    <div class="dialog-overlay"
         (mousedown)="onOverlayMouseDown($event)"
         (click)="onOverlayClick($event)">
      <div class="dialog-container" (click)="$event.stopPropagation()" (mousedown)="$event.stopPropagation()">
        <!-- Header -->
        <header class="dialog-header">
          <div class="header-content">
            <mat-icon class="header-icon">medical_services</mat-icon>
            <div class="header-text">
              <h2>Inizia Trattamento</h2>
              <span class="patient-name">{{ data.patientName }}</span>
              @if (data.serviceName) {
                <span class="service-name">{{ data.serviceName }}</span>
              }
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
              <mat-select formControlName="pathId" required>
                @for (path of data.activePaths; track path.id) {
                  <mat-option [value]="path.id">
                    {{ path.name }}
                    @if (path.primaryOperatorName) {
                      <span class="path-operator"> - {{ path.primaryOperatorName }}</span>
                    }
                  </mat-option>
                }
              </mat-select>
              @if (form.get('pathId')?.hasError('required') && form.get('pathId')?.touched) {
                <mat-error>Seleziona un percorso terapeutico</mat-error>
              }
            </mat-form-field>

            <!-- Selezione Servizi (Multi-select) -->
            @if (selectableServices.length) {
              <div class="services-section">
                <label class="section-label">Servizi</label>
                <app-service-multi-select
                  [availableServices]="selectableServices"
                  [selectedServices]="selectedServices"
                  [useScontoFE]="form.get('isScontoFE')?.value"
                  [showPrices]="true"
                  [editablePrices]="true"
                  [disabled]="false"
                  (selectedServicesChange)="onServicesChange($event)"
                  (totalPriceChange)="onTotalPriceChange($event)">
                </app-service-multi-select>
                <p class="hint-text">I servizi dell'appuntamento sono preselezionati</p>
              </div>
            }

            <!-- Note Cliniche -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Note Cliniche</mat-label>
              <textarea matInput formControlName="clinicalNotes" rows="3"
                        placeholder="Note cliniche per il trattamento..."></textarea>
            </mat-form-field>

            <!-- Note Segreteria -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Note Segreteria</mat-label>
              <textarea matInput formControlName="secretaryNotes" rows="2"
                        placeholder="Comunicazioni per la segreteria..."></textarea>
            </mat-form-field>

            <!-- Prezzo -->
            <mat-form-field appearance="outline" class="price-field">
              <mat-label>Prezzo</mat-label>
              <mat-icon matPrefix>euro</mat-icon>
              <input matInput type="number" formControlName="price" min="0" step="0.01">
            </mat-form-field>

            <!-- Sconto FE Section -->
            <div class="sconto-fe-section">
              <mat-slide-toggle formControlName="isScontoFE" color="primary">
                Sconto FE
              </mat-slide-toggle>

              @if (form.get('isScontoFE')?.value) {
                <div class="cash-collection-section">
                  @if (!cashCollected) {
                    <button mat-raised-button color="accent"
                            type="button"
                            (click)="onCashCollection()"
                            class="cash-btn">
                      <mat-icon>payments</mat-icon>
                      Incassato da Operatore
                    </button>
                  } @else {
                    <div class="cash-collected-badge">
                      <mat-icon>check_circle</mat-icon>
                      <span>Incassato: {{ form.get('price')?.value | currency:'EUR' }}</span>
                      <button mat-icon-button (click)="resetCashCollection()" matTooltip="Annulla incasso">
                        <mat-icon>cancel</mat-icon>
                      </button>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Sezione Valutazione Dolore (espandibile) -->
            <mat-expansion-panel class="expansion-section">
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
                </div>
                <div class="pain-slider-group">
                  <label>Dolore Dopo: {{ form.get('painAfter')?.value ?? '-' }}/10</label>
                  <mat-slider min="0" max="10" step="1" discrete class="pain-slider">
                    <input matSliderThumb formControlName="painAfter">
                  </mat-slider>
                </div>
              </div>
            </mat-expansion-panel>

            <!-- Sezione Riprogrammazione (espandibile) -->
            <mat-expansion-panel class="expansion-section">
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

            <!-- Note Paziente -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Note per il Paziente</mat-label>
              <textarea matInput formControlName="patientNotes" rows="2"
                        placeholder="Indicazioni per il paziente..."></textarea>
            </mat-form-field>
          </form>
        </div>

        <!-- Footer -->
        <footer class="dialog-footer">
          <button mat-button (click)="onCancel()" [disabled]="saving">
            Annulla
          </button>
          <button mat-raised-button color="primary"
                  [disabled]="!form.valid || saving"
                  (click)="onSave()">
            @if (saving) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <mat-icon>play_arrow</mat-icon>
              Inizia Trattamento
            }
          </button>
        </footer>
      </div>
    </div>
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
      max-width: 600px;
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
      color: #1976d2;
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

    .patient-name {
      color: #666;
      font-size: 14px;
    }

    .service-name {
      color: #1976d2;
      font-size: 12px;
      font-weight: 500;
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

    .price-field {
      width: 200px;
    }

    .sconto-fe-section {
      display: flex;
      align-items: center;
      gap: 24px;
      margin: 16px 0;
      padding: 16px;
      background: #fafafa;
      border-radius: 8px;
    }

    .cash-collection-section {
      flex: 1;
    }

    .cash-btn {
      mat-icon {
        margin-right: 8px;
      }
    }

    .cash-collected-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #4caf50;
      font-weight: 500;

      mat-icon {
        color: #4caf50;
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

    .pain-assessment {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 8px 0;
    }

    .pain-slider-group {
      label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        color: #666;
      }
    }

    .pain-slider {
      width: 100%;
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

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
      background: #fafafa;
      border-radius: 0 0 8px 8px;
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

    .hint-text {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
      margin-bottom: 0;
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
export class StartTreatmentDialogComponent implements OnInit, OnChanges {
  @Input() data!: StartTreatmentDialogData;
  @Input() saving = false;

  @Output() save = new EventEmitter<StartTreatmentFormResult>();
  @Output() cancel = new EventEmitter<void>();
  @Output() cashCollection = new EventEmitter<void>();

  form!: FormGroup;
  cashCollected = false;
  collectedPaymentMethod?: string;

  // Servizi selezionati per multi-select
  selectedServices: SelectedServiceItem[] = [];

  // Servizi disponibili convertiti per il componente multi-select
  // IMPORTANTE: Non usare getter che crea nuovi oggetti ad ogni change detection!
  // Questo causava NG0103: Infinite change detection
  selectableServices: SelectableService[] = [];

  // Date minime per i datepicker riprogrammazione
  minDateStart: Date = new Date();  // Oggi
  minDateEnd: Date = new Date();    // Inizialmente oggi, poi aggiornata quando cambia data inizio

  // Overlay click tracking (per evitare chiusura durante click-and-drag)
  overlayMouseDownTarget: EventTarget | null = null;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data && this.form) {
      // Converte availableServices in SelectableService UNA SOLA VOLTA
      // quando cambia data (non ad ogni change detection!)
      this.selectableServices = (this.data.availableServices || []).map(s => ({
        id: s.id,
        name: s.name,
        defaultPrice: s.defaultPrice ?? undefined,
        discountFE: s.discountFE ?? undefined,
        defaultDuration: s.defaultDuration ?? undefined
      }));

      // Pre-seleziona il percorso: prima defaultPathId, poi il primo se uno solo
      if (this.data.defaultPathId) {
        this.form.patchValue({ pathId: this.data.defaultPathId });
      } else if (this.data.activePaths?.length === 1) {
        this.form.patchValue({ pathId: this.data.activePaths[0].id });
      }

      // Inizializza selectedServices dai servizi dell'appuntamento
      this.initializeSelectedServices();

      // Aggiorna il prezzo in base ai servizi selezionati e sconto FE
      this.updatePriceFromServices();
    }
  }

  /**
   * Inizializza selectedServices dai servizi dell'appuntamento (appointmentServices)
   * oppure dal singolo serviceId legacy
   */
  private initializeSelectedServices(): void {
    if (!this.data) return;

    // Se ci sono appointmentServices (nuovo sistema), usali
    if (this.data.appointmentServices && this.data.appointmentServices.length > 0) {
      this.selectedServices = this.data.appointmentServices.map((apptService, idx) => {
        const fullService = this.data.availableServices?.find(s => s.id === apptService.serviceId);
        return {
          serviceId: apptService.serviceId,
          service: fullService ? {
            id: fullService.id,
            name: fullService.name,
            defaultPrice: fullService.defaultPrice ?? undefined,
            discountFE: fullService.discountFE ?? undefined,
            defaultDuration: fullService.defaultDuration ?? undefined
          } : undefined,
          customPrice: apptService.customPrice,
          orderPosition: apptService.orderPosition ?? idx
        };
      });
    }
    // Fallback: usa defaultServiceId (sistema legacy)
    else if (this.data.defaultServiceId) {
      const service = this.data.availableServices?.find(s => s.id === this.data.defaultServiceId);
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
      }
    } else {
      this.selectedServices = [];
    }
  }

  private initForm(): void {
    this.form = this.fb.group({
      pathId: ['', Validators.required],
      serviceId: [this.data?.defaultServiceId || ''],
      clinicalNotes: [''],
      secretaryNotes: [''],
      price: [this.data?.servicePrice || null],
      isScontoFE: [false],
      painBefore: [null],
      painAfter: [null],
      reschedulingType: ['none'],
      suggestInDays: [null],
      suggestDateRangeStart: [null as Date | null],
      suggestDateRangeEnd: [null as Date | null],
      reschedulingNotes: [''],
      patientNotes: ['']
    });

    // Pre-seleziona il percorso: prima defaultPathId, poi il primo se uno solo
    if (this.data?.defaultPathId) {
      this.form.patchValue({ pathId: this.data.defaultPathId });
    } else if (this.data?.activePaths?.length === 1) {
      this.form.patchValue({ pathId: this.data.activePaths[0].id });
    }

    // Aggiorna prezzo quando cambia sconto FE
    this.form.get('isScontoFE')?.valueChanges.subscribe(() => {
      this.updatePriceFromServices();
      // Reset cash collection quando si disattiva sconto FE
      if (!this.form.get('isScontoFE')?.value) {
        this.resetCashCollection();
      }
    });
  }

  /**
   * Aggiorna il prezzo in base ai servizi selezionati e allo sconto FE
   */
  private updatePriceFromServices(): void {
    const isScontoFE = this.form.get('isScontoFE')?.value;
    let total = 0;

    for (const item of this.selectedServices) {
      if (item.customPrice !== undefined && item.customPrice !== null) {
        total += item.customPrice;
      } else if (item.service) {
        const price = isScontoFE && item.service.discountFE !== undefined && item.service.discountFE !== null
          ? item.service.discountFE
          : (item.service.defaultPrice || 0);
        total += price;
      }
    }

    this.form.patchValue({ price: total });
  }

  /**
   * Handler per il cambio dei servizi selezionati
   */
  onServicesChange(services: SelectedServiceItem[]): void {
    this.selectedServices = services;
    this.updatePriceFromServices();
  }

  /**
   * Handler per il cambio del prezzo totale calcolato dal componente multi-select
   */
  onTotalPriceChange(totalPrice: number): void {
    this.form.patchValue({ price: totalPrice });
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

  onSave(): void {
    if (!this.form.valid) return;

    const formValue = this.form.value;

    // Helper per formattare Date in stringa ISO YYYY-MM-DD
    const formatDate = (date: Date | null): string | undefined => {
      if (!date) return undefined;
      return date.toISOString().split('T')[0];
    };

    // Costruisci array di treatmentServices dai servizi selezionati
    const treatmentServices = this.selectedServices.map((item, idx) => ({
      serviceId: item.serviceId,
      price: item.customPrice,
      orderPosition: item.orderPosition ?? idx
    }));

    const result: StartTreatmentFormResult = {
      pathId: formValue.pathId,
      // Manteniamo serviceId per retrocompatibilità (primo servizio selezionato)
      serviceId: this.selectedServices.length > 0 ? this.selectedServices[0].serviceId : undefined,
      clinicalNotes: formValue.clinicalNotes || undefined,
      secretaryNotes: formValue.secretaryNotes || undefined,
      price: formValue.price || undefined,
      isScontoFE: formValue.isScontoFE,
      collectedByOperator: this.cashCollected,
      paymentMethod: this.collectedPaymentMethod as any,
      painAssessment: {
        painBefore: formValue.painBefore,
        painAfter: formValue.painAfter
      },
      rescheduling: {
        type: formValue.reschedulingType,
        suggestInDays: formValue.suggestInDays,
        suggestDateRangeStart: formatDate(formValue.suggestDateRangeStart),
        suggestDateRangeEnd: formatDate(formValue.suggestDateRangeEnd),
        secretaryNotes: formValue.reschedulingNotes
      },
      patientNotes: formValue.patientNotes || undefined,
      // Nuovo campo per servizi multipli
      treatmentServices: treatmentServices.length > 0 ? treatmentServices : undefined
    };

    this.save.emit(result);
  }

  onCashCollection(): void {
    this.cashCollection.emit();
  }

  // Chiamato dal container dopo la conferma dell'incasso
  setCashCollected(paymentMethod: string): void {
    this.cashCollected = true;
    this.collectedPaymentMethod = paymentMethod;
  }

  resetCashCollection(): void {
    this.cashCollected = false;
    this.collectedPaymentMethod = undefined;
  }
}

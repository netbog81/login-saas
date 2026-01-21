/**
 * Start Treatment Dialog Container
 * Layer 2: Smart Component
 *
 * Responsabilità:
 * - Orchestrare apertura/chiusura dialog "Inizia Trattamento"
 * - Verificare percorsi attivi prima di aprire dialog
 * - Gestire modal conferma incasso
 * - Chiamare TreatmentService per creare il trattamento
 * - Emettere eventi treatmentStarted/cancel al parent
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, switchMap, catchError } from 'rxjs/operators';

import { TherapeuticPath } from '../../../models/therapeutic-path.model';
import { Treatment } from '../../../models/treatment.model';
import { TreatmentService } from '../../../services/treatment.service';
import { TherapeuticPathService } from '../../../services/therapeutic-path.service';
import { ServiceService } from '../../../services/service.service';
import { Service } from '../../../graphql/generated/types';

import { StartTreatmentDialogComponent } from '../components/start-treatment-dialog/start-treatment-dialog.component';
import { CashCollectionConfirmDialogComponent } from '../components/cash-collection-confirm-dialog/cash-collection-confirm-dialog.component';
import {
  StartTreatmentDialogData,
  StartTreatmentFormResult,
  CashCollectionData,
  AppointmentServiceData
} from '../models/start-treatment-dialog.model';

export interface StartTreatmentResult {
  treatment: Treatment;
  formData: StartTreatmentFormResult;
  cashCollectionData?: CashCollectionData;
}

@Component({
  selector: 'app-start-treatment-dialog-container',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    StartTreatmentDialogComponent,
    CashCollectionConfirmDialogComponent
  ],
  template: `
    @if (showDialog && dialogData) {
      <app-start-treatment-dialog
        [data]="dialogData"
        [saving]="saving"
        (save)="onSave($event)"
        (cancel)="onCancel()"
        (cashCollection)="onOpenCashCollection()">
      </app-start-treatment-dialog>
    }

    @if (showCashCollectionDialog) {
      <div class="cash-collection-overlay" (click)="onCashCollectionOverlayClick($event)">
        <app-cash-collection-confirm-dialog
          [amount]="dialogData?.servicePrice"
          [operatorId]="dialogData?.operatorId || ''"
          [confirming]="confirmingCash"
          (confirm)="onCashCollectionConfirm($event)"
          (cancel)="onCashCollectionCancel()">
        </app-cash-collection-confirm-dialog>
      </div>
    }

    @if (showNoPathsWarning) {
      <div class="warning-overlay" (click)="onWarningOverlayClick($event)">
        <div class="warning-dialog">
          <div class="warning-header">
            <mat-icon>warning</mat-icon>
            <h3>Nessun Percorso Attivo</h3>
          </div>
          <div class="warning-content">
            <p>Non esiste nessun percorso terapeutico attivo per questo paziente.</p>
            <p>È necessario creare un nuovo percorso o attivare un percorso esistente prima di iniziare il trattamento.</p>
          </div>
          <div class="warning-actions">
            <button class="btn-cancel" (click)="onWarningCancel()">Annulla</button>
            <button class="btn-create" (click)="onCreatePath()">
              Crea Nuovo Percorso
            </button>
          </div>
        </div>
      </div>
    }

    @if (showWrongStatusWarning) {
      <div class="info-overlay" (click)="onWrongStatusOverlayClick($event)">
        <div class="info-dialog">
          <div class="info-header">
            <mat-icon>info</mat-icon>
            <h3>Impossibile Iniziare Trattamento</h3>
          </div>
          <div class="info-content">
            <p>{{ wrongStatusMessage }}</p>
            <p class="hint">
              <mat-icon>lightbulb</mat-icon>
              Per iniziare un trattamento, il paziente deve prima essere segnato come "Presentato" nel calendario.
            </p>
          </div>
          <div class="info-actions">
            <button class="btn-ok" (click)="onWrongStatusClose()">Ho Capito</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .cash-collection-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1100;
    }

    .warning-overlay {
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

    .warning-dialog {
      background: white;
      border-radius: 16px;
      max-width: 420px;
      width: 90%;
      overflow: hidden;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
    }

    .warning-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-bottom: 1px solid #fcd34d;

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: #d97706;
      }

      h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #92400e;
      }
    }

    .warning-content {
      padding: 24px;

      p {
        margin: 0 0 12px;
        color: #64748b;
        font-size: 0.9375rem;
        line-height: 1.5;

        &:last-child {
          margin-bottom: 0;
        }
      }
    }

    .warning-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    .btn-cancel {
      padding: 10px 20px;
      border: 1px solid #e2e8f0;
      background: white;
      color: #64748b;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }
    }

    .btn-create {
      padding: 10px 20px;
      border: none;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      }
    }

    /* Info Dialog (stato appuntamento sbagliato) */
    .info-overlay {
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

    .info-dialog {
      background: white;
      border-radius: 16px;
      max-width: 480px;
      width: 90%;
      overflow: hidden;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
    }

    .info-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px;
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
      border-bottom: 1px solid #93c5fd;

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: #2563eb;
      }

      h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #1e40af;
      }
    }

    .info-content {
      padding: 24px;

      p {
        margin: 0 0 16px;
        color: #334155;
        font-size: 0.9375rem;
        line-height: 1.6;

        &:last-child {
          margin-bottom: 0;
        }
      }

      .hint {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 16px;
        background: #f0f9ff;
        border-radius: 8px;
        border: 1px solid #bae6fd;
        color: #0369a1;
        font-size: 0.875rem;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          color: #0ea5e9;
          flex-shrink: 0;
          margin-top: 2px;
        }
      }
    }

    .info-actions {
      display: flex;
      justify-content: flex-end;
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    .btn-ok {
      padding: 10px 24px;
      border: none;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StartTreatmentDialogContainer implements OnDestroy {
  private destroy$ = new Subject<void>();

  @ViewChild(StartTreatmentDialogComponent) dialogComponent?: StartTreatmentDialogComponent;

  // Input per inizializzare il dialog
  @Input() appointmentId: string = '';
  @Input() patientId: number = 0;
  @Input() patientName: string = '';
  @Input() operatorId: string = '';
  @Input() serviceId?: string;       // @deprecated - usa appointmentServices
  @Input() serviceName?: string;
  @Input() servicePrice?: number;
  @Input() appointmentStatus?: string;  // Stato dell'appuntamento per verificare se è ATTENDED
  @Input() defaultPathId?: string;      // Percorso terapeutico da pre-selezionare (dalla scheda paziente)
  @Input() appointmentServices?: AppointmentServiceData[];  // Servizi dell'appuntamento (nuovo sistema)

  // Output events
  @Output() treatmentStarted = new EventEmitter<StartTreatmentResult>();
  @Output() cancel = new EventEmitter<void>();
  @Output() createPath = new EventEmitter<void>();  // Per aprire dialog creazione percorso

  // State
  showDialog = false;
  showCashCollectionDialog = false;
  showNoPathsWarning = false;
  showWrongStatusWarning = false;
  wrongStatusMessage = '';
  saving = false;
  confirmingCash = false;
  dialogData: StartTreatmentDialogData | null = null;
  activePaths: TherapeuticPath[] = [];
  availableServices: Service[] = [];
  pendingFormResult: StartTreatmentFormResult | null = null;
  cashCollectionData: CashCollectionData | null = null;

  constructor(
    private treatmentService: TreatmentService,
    private pathService: TherapeuticPathService,
    private serviceService: ServiceService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Metodo pubblico per aprire il dialog
   * Verifica prima lo stato dell'appuntamento e poi se esistono percorsi attivi
   */
  open(): void {
    console.log('[StartTreatmentDialogContainer] Opening dialog for patient:', this.patientId);
    console.log('[StartTreatmentDialogContainer] Appointment status:', this.appointmentStatus);

    // Verifica se l'appuntamento è in stato "paziente presentato" (ATTENDED)
    const status = this.appointmentStatus?.toUpperCase();
    if (status !== 'ATTENDED') {
      console.log('[StartTreatmentDialogContainer] Wrong status, showing warning');
      this.wrongStatusMessage = this.getWrongStatusMessage(status);
      this.showWrongStatusWarning = true;
      this.cdr.markForCheck();
      return;
    }

    // Stato corretto: procedi con il caricamento dei percorsi
    this.loadActivePaths();
  }

  /**
   * Restituisce un messaggio esplicativo per lo stato sbagliato dell'appuntamento
   */
  private getWrongStatusMessage(status?: string): string {
    switch (status) {
      case 'SCHEDULED':
        return 'Il paziente non è ancora arrivato. Attendi che il paziente si presenti e segna l\'appuntamento come "Paziente Presentato" nel calendario per iniziare il trattamento.';
      case 'CONFIRMED':
        return 'L\'appuntamento è confermato ma il paziente non è ancora arrivato. Attendi che il paziente si presenti e segna l\'appuntamento come "Paziente Presentato" nel calendario.';
      case 'CANCELLED':
        return 'Questo appuntamento è stato cancellato. Non è possibile iniziare un trattamento per un appuntamento cancellato.';
      case 'NO_SHOW':
        return 'Il paziente non si è presentato all\'appuntamento. Non è possibile iniziare un trattamento.';
      case 'COMPLETED':
        return 'Questo appuntamento è già stato completato. Non è possibile iniziare un nuovo trattamento.';
      default:
        return `Lo stato attuale dell'appuntamento (${status || 'sconosciuto'}) non permette di iniziare un trattamento. È necessario che il paziente sia segnato come "Presentato".`;
    }
  }

  /**
   * Metodo pubblico per chiudere il dialog
   */
  close(): void {
    this.showDialog = false;
    this.showCashCollectionDialog = false;
    this.showNoPathsWarning = false;
    this.showWrongStatusWarning = false;
    this.wrongStatusMessage = '';
    this.dialogData = null;
    this.pendingFormResult = null;
    this.cashCollectionData = null;
    this.cdr.markForCheck();
  }

  private loadActivePaths(): void {
    // Valida e converti patientId a numero
    const numericPatientId = Number(this.patientId);
    if (!numericPatientId || numericPatientId <= 0 || isNaN(numericPatientId)) {
      console.error('[StartTreatmentDialogContainer] Invalid patientId:', this.patientId, 'type:', typeof this.patientId);
      this.showNoPathsWarning = true;
      this.cdr.markForCheck();
      return;
    }

    console.log('[StartTreatmentDialogContainer] Loading paths and services for patientId:', numericPatientId);

    // Carica percorsi e servizi in parallelo
    // NOTA: Apollo/ApolloZoneService già eseguono dentro NgZone,
    // non serve wrapping aggiuntivo con ngZone.run()
    forkJoin({
      paths: this.pathService.getPathsByPatient(numericPatientId),
      services: this.serviceService.getServicesOnce()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ paths, services }) => {
          // Filtra solo percorsi ATTIVI (case-insensitive)
          this.activePaths = paths.filter(p => p.status?.toLowerCase() === 'active');
          // Filtra solo servizi attivi
          this.availableServices = services.filter(s => s.isActive);

          console.log('[StartTreatmentDialogContainer] Active paths:', this.activePaths.length);
          console.log('[StartTreatmentDialogContainer] Available services:', this.availableServices.length);

          if (this.activePaths.length === 0) {
            // Nessun percorso attivo: mostra warning
            this.showNoPathsWarning = true;
            this.cdr.markForCheck();
          } else {
            // Percorsi attivi presenti: apri dialog
            this.openDialogWithPaths();
            // openDialogWithPaths() già chiama markForCheck()
          }
        },
        error: (error) => {
          console.error('[StartTreatmentDialogContainer] Error loading paths/services:', error);
          // In caso di errore, mostra comunque il warning
          this.showNoPathsWarning = true;
          this.cdr.markForCheck();
        }
      });
  }

  private openDialogWithPaths(): void {
    this.dialogData = {
      appointmentId: this.appointmentId,
      patientId: this.patientId,
      patientName: this.patientName,
      activePaths: this.activePaths,
      operatorId: this.operatorId,
      serviceName: this.serviceName,
      servicePrice: this.servicePrice,
      availableServices: this.availableServices,
      defaultServiceId: this.serviceId,
      defaultPathId: this.defaultPathId,
      appointmentServices: this.appointmentServices  // Passa i servizi dell'appuntamento
    };
    this.showDialog = true;
    this.cdr.markForCheck();
  }

  // ============ DIALOG EVENT HANDLERS ============

  onSave(result: StartTreatmentFormResult): void {
    console.log('[StartTreatmentDialogContainer] Save requested:', result);

    // Se c'è stato un incasso operatore, usa i dati salvati
    const finalResult: StartTreatmentFormResult = {
      ...result,
      collectedByOperator: this.cashCollectionData !== null,
      paymentMethod: this.cashCollectionData?.paymentMethod
    };

    this.createTreatment(finalResult);
  }

  onCancel(): void {
    this.close();
    this.cancel.emit();
  }

  // ============ CASH COLLECTION HANDLERS ============

  onOpenCashCollection(): void {
    this.showCashCollectionDialog = true;
    this.cdr.markForCheck();
  }

  onCashCollectionConfirm(data: CashCollectionData): void {
    console.log('[StartTreatmentDialogContainer] Cash collection confirmed:', data);
    this.cashCollectionData = data;
    this.showCashCollectionDialog = false;

    // Aggiorna il componente dialog per mostrare il badge "incassato"
    if (this.dialogComponent) {
      this.dialogComponent.setCashCollected(data.paymentMethod);
    }

    this.cdr.markForCheck();
  }

  onCashCollectionCancel(): void {
    this.showCashCollectionDialog = false;
    this.cdr.markForCheck();
  }

  onCashCollectionOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('cash-collection-overlay')) {
      this.onCashCollectionCancel();
    }
  }

  // ============ WARNING DIALOG HANDLERS ============

  onWarningCancel(): void {
    this.showNoPathsWarning = false;
    this.cancel.emit();
    this.cdr.markForCheck();
  }

  onCreatePath(): void {
    this.showNoPathsWarning = false;
    this.createPath.emit();
    this.cdr.markForCheck();
  }

  onWarningOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('warning-overlay')) {
      this.onWarningCancel();
    }
  }

  // ============ WRONG STATUS WARNING HANDLERS ============

  onWrongStatusClose(): void {
    this.showWrongStatusWarning = false;
    this.wrongStatusMessage = '';
    this.cancel.emit();
    this.cdr.markForCheck();
  }

  onWrongStatusOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('info-overlay')) {
      this.onWrongStatusClose();
    }
  }

  // ============ TREATMENT CREATION ============

  private createTreatment(formResult: StartTreatmentFormResult): void {
    if (!this.appointmentId) {
      console.error('[StartTreatmentDialogContainer] No appointmentId');
      return;
    }

    if (!formResult.pathId) {
      console.error('[StartTreatmentDialogContainer] No pathId selected');
      alert('Selezionare un percorso terapeutico');
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    // Step 1: Crea il trattamento con i dati base
    this.treatmentService.createTreatment(
      this.appointmentId,
      formResult.pathId,
      formResult.isScontoFE
    )
      .pipe(
        // Step 2: Aggiorna il trattamento con tutti i dati del form
        switchMap((treatment) => {
          console.log('[StartTreatmentDialogContainer] Treatment created:', treatment.id);

          // Prepara i dati per l'aggiornamento
          const hasDataToUpdate = formResult.clinicalNotes ||
            formResult.secretaryNotes ||
            formResult.patientNotes ||
            formResult.price != null ||
            formResult.serviceId ||
            (formResult.treatmentServices && formResult.treatmentServices.length > 0) ||
            formResult.painAssessment?.painBefore != null ||
            formResult.painAssessment?.painAfter != null ||
            formResult.rescheduling?.type !== 'none';

          if (!hasDataToUpdate) {
            // Nessun dato aggiuntivo da salvare
            return of(treatment);
          }

          // Chiama updateTreatment per salvare tutti i campi del form
          return this.treatmentService.updateTreatment({
            id: treatment.id,
            serviceId: formResult.serviceId,  // @deprecated - manteniamo per retrocompatibilità
            clinicalNotes: formResult.clinicalNotes,
            secretaryNotes: formResult.secretaryNotes,
            patientNotes: formResult.patientNotes,
            price: formResult.price,
            painBefore: formResult.painAssessment?.painBefore ?? undefined,
            painAfter: formResult.painAssessment?.painAfter ?? undefined,
            rescheduleRequested: formResult.rescheduling?.type !== 'none',
            // Campi riprogrammazione
            reschedulingType: formResult.rescheduling?.type,
            suggestInDays: formResult.rescheduling?.suggestInDays,
            suggestDateRangeStart: formResult.rescheduling?.suggestDateRangeStart,
            suggestDateRangeEnd: formResult.rescheduling?.suggestDateRangeEnd,
            reschedulingNotes: formResult.rescheduling?.secretaryNotes,
            // Nuovo: servizi multipli del trattamento
            treatmentServices: formResult.treatmentServices,
          }).pipe(
            catchError((updateError) => {
              console.error('[StartTreatmentDialogContainer] Error updating treatment, but treatment was created:', updateError);
              // Ritorna comunque il trattamento creato anche se l'update fallisce
              return of(treatment);
            })
          );
        }),
        // Step 3: Se c'è stato incasso operatore, registra il pagamento
        switchMap((treatment) => {
          if (this.cashCollectionData && formResult.price != null) {
            console.log('[StartTreatmentDialogContainer] Recording payment for treatment:', treatment.id);
            return this.treatmentService.recordPayment(treatment.id, {
              paymentMethod: this.cashCollectionData.paymentMethod as any,
              collectedBy: this.operatorId,
              amount: formResult.price,
            }).pipe(
              catchError((paymentError) => {
                console.error('[StartTreatmentDialogContainer] Error recording payment:', paymentError);
                return of(treatment);
              })
            );
          }
          return of(treatment);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (treatment) => {
          // Apollo già esegue dentro NgZone, non serve wrapping aggiuntivo
          console.log('[StartTreatmentDialogContainer] Treatment process completed:', treatment.id);

          // Emetti il risultato completo
          const result: StartTreatmentResult = {
            treatment,
            formData: formResult,
            cashCollectionData: this.cashCollectionData || undefined
          };

          this.saving = false;
          this.treatmentStarted.emit(result);
          this.close();
          this.cdr.markForCheck();
        },
        error: (error) => {
          // Apollo già esegue dentro NgZone, non serve wrapping aggiuntivo
          console.error('[StartTreatmentDialogContainer] Error creating treatment:', error);
          this.saving = false;
          alert('Errore nella creazione del trattamento: ' + (error.message || 'Errore sconosciuto'));
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Metodo chiamato dopo la creazione di un nuovo percorso
   * per ritentare l'apertura del dialog
   */
  retryAfterPathCreated(): void {
    console.log('[StartTreatmentDialogContainer] Retrying after path created');
    this.loadActivePaths();
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '@curandis/tenant-datasource';

import { AvailabilityAppointment } from '../entities/availability-appointment.entity';
import { Treatment, TreatmentStatus } from '../entities/treatment.entity';
import { TreatmentBillingStatus } from '../entities/treatment-billing-status.enum';
import { TreatmentService } from './treatment.service';
import { TherapeuticPathService } from './therapeutic-path.service';
import { GeneralSettingsService } from '../../settings/services/general-settings.service';
import { ClinicalEventBuffer } from '../../clinical-events/clinical-event-buffer.service';

/**
 * Marker per le azioni innescate dalla cascata stato-appuntamento, non da un
 * utente reale (es. cancellazione automatica del trattamento su NO_SHOW).
 */
const SYSTEM_USER_ID = 'system:treatment-cascade';

/**
 * Orchestratore della cascata stato appuntamento → trattamento.
 *
 *  - Paziente PRESENTATO (ATTENDED): se abilitato per il tenant
 *    (`autoStartTreatment.onAttended`) e il paziente ha ESATTAMENTE un percorso
 *    terapeutico attivo, apre automaticamente il trattamento. Se l'appuntamento
 *    aveva già un trattamento ANNULLATO (caso ritardatario dopo NO_SHOW), lo
 *    RIAPRE invece di crearne uno nuovo.
 *  - Paziente NON PRESENTATO (NO_SHOW): se esiste un trattamento ancora in
 *    corso e non fatturato, lo ANNULLA. Se è già completato/chiuso/fatturato
 *    non tocca nulla e logga (serve intervento manuale).
 *
 * Tutti i metodi devono essere chiamati DENTRO un contesto tenant attivo
 * (TenantContextService.run). I metodi che invocano service che bufferizzano
 * eventi clinici (create/cancel) li wrappano internamente in
 * `eventBuffer.runInScope`.
 */
@Injectable()
export class TreatmentCascadeService {
  private readonly logger = new Logger(TreatmentCascadeService.name);

  constructor(
    private readonly treatmentService: TreatmentService,
    private readonly pathService: TherapeuticPathService,
    private readonly settingsService: GeneralSettingsService,
    private readonly eventBuffer: ClinicalEventBuffer,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Da chiamare quando un appuntamento passa ad ATTENDED.
   *
   * @param fromCron true se l'innesco è il cron AutoAttendance: in tal caso
   *   l'auto-start è limitato alla finestra oraria della clinica (interruttore
   *   di sicurezza contro creazioni a orari assurdi).
   */
  async onAppointmentAttended(
    appointment: AvailabilityAppointment,
    fromCron = false,
  ): Promise<void> {
    try {
      const enabled = await this.settingsService.isAutoStartTreatmentOnAttendedEnabled();
      if (!enabled) return;
      if (appointment.nonRetribuito) return;
      if (!appointment.patientId) return;

      if (fromCron && !(await this.isWithinClinicHours())) {
        this.logger.log(
          `[cascade] auto-start saltato (fuori orario clinica) per appuntamento ${appointment.id}`,
        );
        return;
      }

      // Limite data: di default l'auto-start vale solo per appuntamenti di oggi
      // (evita di toccare appuntamenti passati al primo abilitamento). Si può
      // disattivare per test su appuntamenti vecchi.
      if (await this.settingsService.isAutoStartOnlyTodayEnabled()) {
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
        // La colonna è `date`: TypeORM può restituirla come stringa YYYY-MM-DD
        // o come Date. Normalizziamo a YYYY-MM-DD per il confronto.
        const apptDate =
          appointment.appointmentDate instanceof Date
            ? appointment.appointmentDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
            : String(appointment.appointmentDate).slice(0, 10);
        if (apptDate !== today) {
          this.logger.log(
            `[cascade] auto-start saltato (appuntamento ${appointment.id} non di oggi: ` +
              `${apptDate}, oggi=${today}).`,
          );
          return;
        }
      }

      // Se esiste già un trattamento per l'appuntamento: riapri se era annullato,
      // altrimenti non fare nulla (è già attivo/chiuso).
      const existing = await this.treatmentService.findByAppointmentId(appointment.id);
      if (existing) {
        if (existing.cancelledAt) {
          await this.eventBuffer.runInScope(async () => {
            await this.treatmentService.reopenCancelledTreatment(existing.id);
          });
          this.logger.log(
            `[cascade] trattamento ${existing.id} riaperto (ritardatario) per appuntamento ${appointment.id}`,
          );
        }
        return;
      }

      // Nessun trattamento: auto-crea SOLO se c'è esattamente 1 percorso attivo.
      const activePaths = await this.pathService.findActiveByPatient(appointment.patientId);
      if (activePaths.length !== 1) {
        this.logger.log(
          `[cascade] auto-start saltato per appuntamento ${appointment.id}: ` +
            `percorsi attivi=${activePaths.length} (richiesto esattamente 1).`,
        );
        return;
      }

      await this.eventBuffer.runInScope(async () => {
        await this.treatmentService.createFromAppointment(
          appointment.id,
          activePaths[0].id,
          false,
        );
      });
      this.logger.log(
        `[cascade] trattamento auto-avviato per appuntamento ${appointment.id} ` +
          `su percorso ${activePaths[0].id}`,
      );
    } catch (err) {
      // La cascata non deve mai far fallire il cambio stato dell'appuntamento.
      this.logger.error(
        `[cascade] errore in onAppointmentAttended per appuntamento ${appointment.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Da chiamare quando un appuntamento passa a NO_SHOW.
   * Annulla il trattamento collegato solo se è ancora IN_PROGRESS e non
   * fatturato (billingStatus NOT_READY). Negli altri casi non tocca nulla.
   */
  async onAppointmentNoShow(appointment: AvailabilityAppointment): Promise<void> {
    try {
      const existing = await this.treatmentService.findByAppointmentId(appointment.id);
      if (!existing) return;
      if (existing.cancelledAt) return; // già annullato

      const annullabile =
        existing.status === TreatmentStatus.IN_PROGRESS &&
        existing.billingStatus === TreatmentBillingStatus.NOT_READY;

      if (!annullabile) {
        this.logger.warn(
          `[cascade] NO_SHOW su appuntamento ${appointment.id}: trattamento ${existing.id} ` +
            `NON annullato automaticamente (status=${existing.status}, ` +
            `billingStatus=${existing.billingStatus}). Serve intervento manuale.`,
        );
        return;
      }

      await this.eventBuffer.runInScope(async () => {
        await this.treatmentService.cancelTreatment(
          existing.id,
          SYSTEM_USER_ID,
          'Paziente non presentato (cascata automatica appuntamento → trattamento)',
        );
      });
      this.logger.log(
        `[cascade] trattamento ${existing.id} annullato per NO_SHOW appuntamento ${appointment.id}`,
      );
    } catch (err) {
      this.logger.error(
        `[cascade] errore in onAppointmentNoShow per appuntamento ${appointment.id}: ${(err as Error).message}`,
      );
    }
  }

  /** True se l'ora corrente (Europe/Rome) è dentro la finestra clinica. */
  private async isWithinClinicHours(): Promise<boolean> {
    const { startHour, endHour } = await this.settingsService.getClinicHoursWindow();
    const hourStr = new Date().toLocaleString('it-IT', {
      timeZone: 'Europe/Rome',
      hour: '2-digit',
      hour12: false,
    });
    const hour = parseInt(hourStr, 10);
    if (Number.isNaN(hour)) return true; // in dubbio, non bloccare
    return hour >= startHour && hour < endHour;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Brackets, DataSource } from 'typeorm';
import { AvailabilityAppointment, BookingStatus } from '../../availability/entities/availability-appointment.entity';
import { GeneralSettingsService } from '../../settings/services/general-settings.service';
import { EventsService } from '../../events/events.service';
import { TreatmentCascadeService } from '../../availability/services/treatment-cascade.service';
import { ClinicalEventBuffer } from '../../clinical-events/clinical-event-buffer.service';

import { TenantContextService, TenantDataSourceManager } from '@curandis/tenant-datasource';
/**
 * Service per il cambio automatico dello stato appuntamento da SCHEDULED/CONFIRMED a ATTENDED
 * quando scatta l'ora di inizio (con offset configurabile).
 *
 * Funzionalità:
 * - Cron job ogni minuto
 * - Configurabile via impostazioni (abilitato/disabilitato, offset minuti)
 * - Flag autoStatusChanged per evitare loop (cambiato automaticamente solo una volta)
 * - La segreteria può sempre cambiare lo stato manualmente
 *
 * DB-per-tenant: il cron job NON ha un tenant nel contesto (gira fuori da
 * una request). Itera tutti i tenant configurati in OpenBao KV e per ogni
 * tenant esegue la logica dentro `TenantContextService.run()` così i
 * servizi business che leggono `getDataSource()` trovano il giusto DS.
 */
@Injectable()
export class AutoAttendanceService {
  private readonly logger = new Logger(AutoAttendanceService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantDsManager: TenantDataSourceManager,
    private settingsService: GeneralSettingsService,
    private eventsService: EventsService,
    private treatmentCascade: TreatmentCascadeService,
    private eventBuffer: ClinicalEventBuffer,
  ){}

  private appointmentRepoFor(ds: DataSource) {
    return ds.getRepository(AvailabilityAppointment);
  }

  /**
   * Cron job eseguito ogni minuto per controllare e aggiornare
   * gli appuntamenti che devono passare a stato ATTENDED
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoAttendance(): Promise<void> {
    let aliases: string[];
    try {
      aliases = await this.tenantDsManager.listKnownTenantAliases();
    } catch (error) {
      this.logger.error('Auto-attendance: impossibile elencare i tenant', error as Error);
      return;
    }

    if (aliases.length === 0) {
      return;
    }

    for (const alias of aliases) {
      try {
        await this.processTenant(alias);
      } catch (error) {
        // Errori del singolo tenant non devono bloccare gli altri.
        this.logger.error(`Auto-attendance: errore sul tenant="${alias}"`, error as Error);
      }
    }
  }

  /**
   * Esegue il cambio di stato per un singolo tenant dentro un
   * AsyncLocalStorage scope, così i service che leggono il context
   * (settingsService, eventsService scoped, ecc.) trovano il tenant giusto.
   */
  private async processTenant(tenantAlias: string): Promise<void> {
    const ds = await this.tenantDsManager.getDataSource(tenantAlias);

    await this.tenantContext.run(
      { tenantAlias, dataSource: ds, dbName: ds.options.database as string },
      async () => {
        // 1. Verifica se la feature è abilitata per questo tenant
        const settings = await this.settingsService.getAutoAttendanceSettings();
        if (!settings.enabled) {
          return;
        }

        // 2. Calcola l'ora target considerando l'offset
        const now = new Date();
        const targetTime = new Date(now.getTime() - settings.offsetMinutes * 60 * 1000);
        const targetDate = this.formatDate(targetTime);
        const targetTimeStr = this.formatTime(targetTime);

        // 3. Trova gli appuntamenti da aggiornare
        // Esclude gli appuntamenti non retribuiti (pausa pranzo, rappresentante, ecc.)
        const appointmentRepo = this.appointmentRepoFor(ds);
        const appointmentsToUpdate = await appointmentRepo
          .createQueryBuilder('apt')
          .where('apt.bookingStatus IN (:...statuses)', {
            statuses: [BookingStatus.SCHEDULED, BookingStatus.CONFIRMED],
          })
          .andWhere('apt.autoStatusChanged = false')
          .andWhere('apt.nonRetribuito = false')
          // L'orario va in un gruppo SUO. Scritta come stringa piatta
          // (`A < :d OR (A = :d AND B <= :t)`) l'espressione veniva
          // concatenata con AND alle condizioni precedenti SENZA parentesi
          // esterne: in SQL AND lega piu' di OR, quindi diventava
          // `(stato AND flag AND retribuito AND passato) OR (oggi_iniziato)`
          // e il secondo ramo si portava dietro OGNI appuntamento di oggi
          // gia' iniziato, qualunque fosse il suo stato. Effetto: ogni minuto
          // il cron rimetteva ad ATTENDED anche i no-show appena segnati, le
          // disdette e le fasce non retribuite. `Brackets` garantisce le
          // parentesi e rende impossibile ricadere nell'errore.
          .andWhere(
            new Brackets((qb) => {
              qb.where('apt.appointmentDate < :targetDate', { targetDate })
                .orWhere(
                  '(apt.appointmentDate = :targetDate AND apt.startTime <= :targetTime)',
                  { targetDate, targetTime: targetTimeStr },
                );
            }),
          )
          .getMany();

        if (appointmentsToUpdate.length === 0) {
          return;
        }

        this.logger.log(
          `Auto-attendance [tenant=${tenantAlias}]: ` +
          `${appointmentsToUpdate.length} appuntamenti → ATTENDED ` +
          `(target: ${targetDate} ${targetTimeStr}, offset: ${settings.offsetMinutes} min)`,
        );

        for (const appointment of appointmentsToUpdate) {
          appointment.bookingStatus = BookingStatus.ATTENDED;
          appointment.autoStatusChanged = true;
          await appointmentRepo.save(appointment);
        }

        // Emetti evento SSE per notificare il frontend
        const updatedIds = appointmentsToUpdate.map((apt) => apt.id);
        this.eventsService.emit({
          type: 'appointment_status_changed',
          appointmentIds: updatedIds,
          newStatus: BookingStatus.ATTENDED,
          timestamp: new Date(),
        });

        // Cascata: auto-start trattamento (fromCron=true → limitata all'orario
        // clinica). Best-effort: il cascade ingoia i propri errori e non
        // blocca il cron.
        for (const appointment of appointmentsToUpdate) {
          await this.treatmentCascade.onAppointmentAttended(appointment, true);
        }
      },
    );
  }

  /**
   * Formatta una data in formato YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  }

  /**
   * Formatta un'ora in formato HH:mm
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString('it-IT', {
      timeZone: 'Europe/Rome',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
}

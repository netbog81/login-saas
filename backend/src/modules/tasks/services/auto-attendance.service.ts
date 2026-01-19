import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AvailabilityAppointment, BookingStatus } from '../../availability/entities/availability-appointment.entity';
import { GeneralSettingsService } from '../../settings/services/general-settings.service';
import { EventsService } from '../../events/events.service';

/**
 * Service per il cambio automatico dello stato appuntamento da SCHEDULED/CONFIRMED a ATTENDED
 * quando scatta l'ora di inizio (con offset configurabile).
 *
 * Funzionalità:
 * - Cron job ogni minuto
 * - Configurabile via impostazioni (abilitato/disabilitato, offset minuti)
 * - Flag autoStatusChanged per evitare loop (cambiato automaticamente solo una volta)
 * - La segreteria può sempre cambiare lo stato manualmente
 */
@Injectable()
export class AutoAttendanceService {
  private readonly logger = new Logger(AutoAttendanceService.name);

  constructor(
    @InjectRepository(AvailabilityAppointment)
    private appointmentRepo: Repository<AvailabilityAppointment>,
    private settingsService: GeneralSettingsService,
    private eventsService: EventsService,
  ) {}

  /**
   * Cron job eseguito ogni minuto per controllare e aggiornare
   * gli appuntamenti che devono passare a stato ATTENDED
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoAttendance(): Promise<void> {
    try {
      // 1. Verifica se la feature è abilitata
      const settings = await this.settingsService.getAutoAttendanceSettings();

      if (!settings.enabled) {
        return;
      }

      // 2. Calcola l'ora target considerando l'offset
      const now = new Date();
      const targetTime = new Date(now.getTime() - settings.offsetMinutes * 60 * 1000);

      // Formatta per il confronto con il database
      const targetDate = this.formatDate(targetTime);
      const targetTimeStr = this.formatTime(targetTime);
      this.logger.log(`Marco Auto attendance check at ${this.formatTime(now)} (target: ${targetDate} ${targetTimeStr})`);
      // 3. Trova gli appuntamenti da aggiornare
      // Esclude gli appuntamenti non retribuiti (pausa pranzo, rappresentante, ecc.)
      const appointmentsToUpdate = await this.appointmentRepo
        .createQueryBuilder('apt')
        .where('apt.bookingStatus IN (:...statuses)', {
          statuses: [BookingStatus.SCHEDULED, BookingStatus.CONFIRMED]
        })
        .andWhere('apt.autoStatusChanged = false')
        .andWhere('apt.nonRetribuito = false')
        .andWhere(`
          (apt.appointmentDate < :targetDate) OR
          (apt.appointmentDate = :targetDate AND apt.startTime <= :targetTime)
        `, { targetDate, targetTime: targetTimeStr })
        .getMany();

      if (appointmentsToUpdate.length === 0) {
        return;
      }

      // 4. Aggiorna gli appuntamenti
      this.logger.log(
        `Auto-attendance: Aggiornamento ${appointmentsToUpdate.length} appuntamenti a ATTENDED ` +
        `(target: ${targetDate} ${targetTimeStr}, offset: ${settings.offsetMinutes} min)`
      );

      for (const appointment of appointmentsToUpdate) {
        appointment.bookingStatus = BookingStatus.ATTENDED;
        appointment.autoStatusChanged = true;
        await this.appointmentRepo.save(appointment);

        this.logger.debug(
          `Appuntamento ${appointment.id} aggiornato automaticamente a ATTENDED ` +
          `(data: ${appointment.appointmentDate}, ora: ${appointment.startTime})`
        );
      }

      this.logger.log(`Auto-attendance: ${appointmentsToUpdate.length} appuntamenti aggiornati con successo`);

      // Emetti evento SSE per notificare il frontend
      const updatedIds = appointmentsToUpdate.map(apt => apt.id);
      this.eventsService.emit({
        type: 'appointment_status_changed',
        appointmentIds: updatedIds,
        newStatus: BookingStatus.ATTENDED,
        timestamp: new Date(),
      });
      this.logger.debug(`Evento SSE emesso per ${updatedIds.length} appuntamenti`);
    } catch (error) {
      this.logger.error('Errore durante auto-attendance cron job', error);
    }
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

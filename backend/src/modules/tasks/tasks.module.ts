import { Module } from '@nestjs/common';
import { AvailabilityAppointment } from '../availability/entities/availability-appointment.entity';
import { AutoAttendanceService } from './services/auto-attendance.service';
import { SettingsModule } from '../settings/settings.module';

/**
 * Modulo per task schedulati (cron jobs)
 *
 * Contiene:
 * - AutoAttendanceService: cambio automatico stato appuntamento a ATTENDED
 */
@Module({
  imports: [
    SettingsModule],
  providers: [AutoAttendanceService],
  exports: [AutoAttendanceService],
})
export class TasksModule {}

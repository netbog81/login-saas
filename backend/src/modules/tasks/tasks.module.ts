import { Module, forwardRef } from '@nestjs/common';
import { AvailabilityAppointment } from '../availability/entities/availability-appointment.entity';
import { AutoAttendanceService } from './services/auto-attendance.service';
import { SettingsModule } from '../settings/settings.module';
import { AvailabilityModule } from '../availability/availability.module';

/**
 * Modulo per task schedulati (cron jobs)
 *
 * Contiene:
 * - AutoAttendanceService: cambio automatico stato appuntamento a ATTENDED
 *   (+ cascata auto-start trattamento via TreatmentCascadeService)
 */
@Module({
  imports: [
    SettingsModule,
    forwardRef(() => AvailabilityModule),
  ],
  providers: [AutoAttendanceService],
  exports: [AutoAttendanceService],
})
export class TasksModule {}

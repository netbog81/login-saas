import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { AppUsersModule } from '../users/app-users.module';
import { Treatment } from '../availability/entities/treatment.entity';
import { TherapeuticPath } from '../availability/entities/therapeutic-path.entity';
import { PatientEvaluation } from '../availability/entities/patient-evaluation.entity';
import { Operator } from '../availability/entities/operator.entity';
import { RecycleBinSettings } from '../availability/entities/recycle-bin-settings.entity';
import { RecycleBinService } from './services/recycle-bin.service';
import { RecycleBinCleanupJob } from './services/recycle-bin-cleanup.job';
import { RecycleBinResolver } from './resolvers/recycle-bin.resolver';

@Module({
  imports: [
    AvailabilityModule,
    AppUsersModule],
  providers: [RecycleBinService, RecycleBinCleanupJob, RecycleBinResolver],
  exports: [RecycleBinService],
})
export class RecycleBinModule {}

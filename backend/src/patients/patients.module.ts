import { Module } from '@nestjs/common';

// Entità locali nuove
import { ClinicalSubjectIndex } from './entities/clinical-subject-index.entity';
import { ClinicalAttendanceLog } from './entities/clinical-attendance-log.entity';
import { ClinicalRelationshipExtension } from './entities/clinical-relationship-extension.entity';

// PatientAnamnesis (riusata, anche se l'entity vive nel modulo availability)
import { PatientAnamnesis } from '../modules/availability/entities/patient-anamnesis.entity';
import { PatientAnamnesisService } from '../modules/availability/services/patient-anamnesis.service';

// Services
import { ClinicalSubjectIndexService } from './services/clinical-subject-index.service';
import { ClinicalAttendanceService } from './services/clinical-attendance.service';
import { PatientRelationshipService } from './services/patient-relationship.service';
import { RegistryPatientService } from './services/registry-patient.service';
import { SubjectDataSummaryService } from './services/subject-data-summary.service';
import { SubjectMergeService } from './services/subject-merge.service';

// Controller
import { SubjectDataSummaryController } from './controllers/subject-data-summary.controller';
import { SubjectMergeController } from './controllers/subject-merge.controller';

// Resolver
import { PatientResolver } from './resolvers/patient.resolver';

@Module({
  imports: [
  ],
  controllers: [SubjectDataSummaryController, SubjectMergeController],
  providers: [
    ClinicalSubjectIndexService,
    ClinicalAttendanceService,
    PatientRelationshipService,
    PatientAnamnesisService,
    RegistryPatientService,
    SubjectDataSummaryService,
    SubjectMergeService,
    PatientResolver],
  exports: [
    ClinicalSubjectIndexService,
    ClinicalAttendanceService,
    PatientRelationshipService,
    PatientAnamnesisService,
    RegistryPatientService],
})
export class PazientiModule {}

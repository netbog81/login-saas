import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsModule } from '../settings/settings.module';

// Entities
import { Operator } from './entities/operator.entity';
import { OperatorCategory } from './entities/operator-category.entity';
import { Service } from './entities/service.entity';
import { OperatorService } from './entities/operator-service.entity';
import { AvailabilityTemplate } from './entities/availability-template.entity';
import { TemplatePattern } from './entities/template-pattern.entity';
import { PatternGroup } from './entities/pattern-group.entity';
import { TemplateAssignment } from './entities/template-assignment.entity';
import { AvailabilityException } from './entities/availability-exception.entity';
import { GroupException } from './entities/group-exception.entity';
import { AvailabilityCache } from './entities/availability-cache.entity';
import { AvailabilityAppointment } from './entities/availability-appointment.entity';
import { InstrumentCategory } from './entities/instrument-category.entity';
import { Instrument } from './entities/instrument.entity';
import { GymRoom } from './entities/gym-room.entity';
import { GymSchedule } from './entities/gym-schedule.entity';
import { GymPatternGroup } from './entities/gym-pattern-group.entity';
import { GymTemplatePattern } from './entities/gym-template-pattern.entity';
import { GymException } from './entities/gym-exception.entity';
import { Room } from './entities/room.entity';
import { ServiceInstrument } from './entities/service-instrument.entity';
import { AppointmentInstrument } from './entities/appointment-instrument.entity';
import { AppointmentLog } from './entities/appointment-log.entity';
import { Patient } from '../../entities/patient.entity';
import { Treatment } from './entities/treatment.entity';
import { TreatmentInstrument } from './entities/treatment-instrument.entity';
import { AppointmentService } from './entities/appointment-service.entity';
import { TreatmentService as TreatmentServiceEntity } from './entities/treatment-service.entity';
import { ServiceSubcategory } from './entities/service-subcategory.entity';
import { TherapeuticPath } from './entities/therapeutic-path.entity';
import { PatientEvaluation } from './entities/patient-evaluation.entity';
import { PathDocument } from './entities/path-document.entity';

// Services
import { AvailabilityService } from './services/availability.service';
import { OperatorService as OperatorBusinessService } from './services/operator.service';
import { OperatorServiceService } from './services/operator-service.service';
import { OperatorCategoryService } from './services/operator-category.service';
import { InstrumentCategoryService } from './services/instrument-category.service';
import { InstrumentService } from './services/instrument.service';
import { GymRoomService } from './services/gym-room.service';
import { GymScheduleService } from './services/gym-schedule.service';
import { RoomService } from './services/room.service';
import { TemplateAssignmentService } from './services/template-assignment.service';
import { PatternGroupService } from './services/pattern-group.service';
import { HolidayService } from './services/holiday.service';
import { AvailabilityExceptionService } from './services/availability-exception.service';
import { PhysiotherapistAvailabilityService } from './services/physiotherapist-availability.service';
import { GymAvailabilityService } from './services/gym-availability.service';
import { GymPatternGroupService } from './services/gym-pattern-group.service';
import { GymExceptionService } from './services/gym-exception.service';
import { AppointmentConflictService } from './services/appointment-conflict.service';
import { AvailabilityAppointmentService } from './services/availability-appointment.service';
import { TreatmentService } from './services/treatment.service';
import { TherapeuticPathService } from './services/therapeutic-path.service';

// Resolvers
import { AvailabilityResolver } from './resolvers/availability.resolver';
import { OperatorResolver } from './resolvers/operator.resolver';
import { ServiceResolver } from './resolvers/service.resolver';
import { OperatorServiceResolver } from './resolvers/operator-service.resolver';
import { OperatorCategoryResolver } from './resolvers/operator-category.resolver';
import { InstrumentCategoryResolver } from './resolvers/instrument-category.resolver';
import { InstrumentResolver } from './resolvers/instrument.resolver';
import { GymRoomResolver } from './resolvers/gym-room.resolver';
import { GymScheduleResolver } from './resolvers/gym-schedule.resolver';
import { RoomResolver } from './resolvers/room.resolver';
import { TemplateAssignmentResolver } from './resolvers/template-assignment.resolver';
import { PatternGroupResolver } from './resolvers/pattern-group.resolver';
import { AvailabilityExceptionResolver } from './resolvers/availability-exception.resolver';
import { AppointmentConflictResolver } from './resolvers/appointment-conflict.resolver';
import { AvailabilityAppointmentResolver } from './resolvers/availability-appointment.resolver';
import { GymPatternGroupResolver } from './resolvers/gym-pattern-group.resolver';
import { GymExceptionResolver } from './resolvers/gym-exception.resolver';
import { TreatmentResolver } from './resolvers/treatment.resolver';
import { TherapeuticPathResolver } from './resolvers/therapeutic-path.resolver';
import { ServiceSubcategoryResolver } from './resolvers/service-subcategory.resolver';

@Module({
  imports: [
    SettingsModule,
    TypeOrmModule.forFeature([
      Operator,
      OperatorCategory,
      Service,
      OperatorService,
      AvailabilityTemplate,
      PatternGroup,
      TemplatePattern,
      TemplateAssignment,
      AvailabilityException,
      GroupException,
      AvailabilityCache,
      InstrumentCategory,
      Instrument,
      GymRoom,
      GymSchedule,
      GymPatternGroup,
      GymTemplatePattern,
      GymException,
      Room,
      ServiceInstrument,
      AppointmentInstrument,
      AppointmentService,       // Junction table - PRIMA del parent per evitare circular dependency
      TreatmentServiceEntity,   // Junction table - PRIMA del parent per evitare circular dependency
      TreatmentInstrument,
      AppointmentLog,
      Patient,
      // Parent entities DOPO le junction tables
      AvailabilityAppointment,
      Treatment,
      ServiceSubcategory,
      TherapeuticPath,
      PatientEvaluation,
      PathDocument,
    ]),
  ],
  providers: [
    // Services
    AvailabilityService,
    OperatorBusinessService,
    OperatorServiceService,
    OperatorCategoryService,
    InstrumentCategoryService,
    InstrumentService,
    GymRoomService,
    GymScheduleService,
    RoomService,
    TemplateAssignmentService,
    PatternGroupService,
    HolidayService,
    AvailabilityExceptionService,
    PhysiotherapistAvailabilityService,
    GymAvailabilityService,
    GymPatternGroupService,
    GymExceptionService,
    AppointmentConflictService,
    AvailabilityAppointmentService,
    TreatmentService,
    TherapeuticPathService,
    // Resolvers
    AvailabilityResolver,
    OperatorResolver,
    ServiceResolver,
    OperatorServiceResolver,
    OperatorCategoryResolver,
    InstrumentCategoryResolver,
    InstrumentResolver,
    GymRoomResolver,
    GymScheduleResolver,
    RoomResolver,
    TemplateAssignmentResolver,
    PatternGroupResolver,
    AvailabilityExceptionResolver,
    AppointmentConflictResolver,
    AvailabilityAppointmentResolver,
    GymPatternGroupResolver,
    GymExceptionResolver,
    TreatmentResolver,
    TherapeuticPathResolver,
    ServiceSubcategoryResolver,
  ],
  exports: [
    AvailabilityService,
    OperatorBusinessService,
    OperatorServiceService,
    OperatorCategoryService,
    InstrumentCategoryService,
    InstrumentService,
    GymRoomService,
    GymScheduleService,
    RoomService,
    TemplateAssignmentService,
    PatternGroupService,
    HolidayService,
    AvailabilityExceptionService,
    PhysiotherapistAvailabilityService,
    GymAvailabilityService,
    GymPatternGroupService,
    GymExceptionService,
    AppointmentConflictService,
    AvailabilityAppointmentService,
    TreatmentService,
    TherapeuticPathService,
    TypeOrmModule, // Export TypeORM features for use in other modules
  ],
})
export class AvailabilityModule {}
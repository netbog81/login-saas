import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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
import { Room } from './entities/room.entity';
import { ServiceInstrument } from './entities/service-instrument.entity';
import { AppointmentInstrument } from './entities/appointment-instrument.entity';
import { AppointmentLog } from './entities/appointment-log.entity';
import { Patient } from '../../entities/patient.entity';

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
import { AppointmentConflictService } from './services/appointment-conflict.service';

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

@Module({
  imports: [
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
      AvailabilityAppointment,
      InstrumentCategory,
      Instrument,
      GymRoom,
      GymSchedule,
      Room,
      ServiceInstrument,
      AppointmentInstrument,
      AppointmentLog,
      Patient,
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
    AppointmentConflictService,
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
    AppointmentConflictService,
    TypeOrmModule, // Export TypeORM features for use in other modules
  ],
})
export class AvailabilityModule {}
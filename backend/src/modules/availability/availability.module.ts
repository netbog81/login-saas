import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Operator } from './entities/operator.entity';
import { Service } from './entities/service.entity';
import { OperatorService } from './entities/operator-service.entity';
import { AvailabilityTemplate } from './entities/availability-template.entity';
import { TemplatePattern } from './entities/template-pattern.entity';
import { TemplateAssignment } from './entities/template-assignment.entity';
import { AvailabilityException } from './entities/availability-exception.entity';
import { GroupException } from './entities/group-exception.entity';
import { AvailabilityCache } from './entities/availability-cache.entity';
import { AvailabilityAppointment } from './entities/availability-appointment.entity';

// Services
import { AvailabilityService } from './services/availability.service';
import { OperatorServiceService } from './services/operator-service.service';

// Resolvers
import { AvailabilityResolver } from './resolvers/availability.resolver';
import { OperatorResolver } from './resolvers/operator.resolver';
import { ServiceResolver } from './resolvers/service.resolver';
import { OperatorServiceResolver } from './resolvers/operator-service.resolver';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Operator,
      Service,
      OperatorService,
      AvailabilityTemplate,
      TemplatePattern,
      TemplateAssignment,
      AvailabilityException,
      GroupException,
      AvailabilityCache,
      AvailabilityAppointment,
    ]),
  ],
  providers: [
    AvailabilityService,
    OperatorServiceService,
    AvailabilityResolver,
    OperatorResolver,
    ServiceResolver,
    OperatorServiceResolver,
  ],
  exports: [
    AvailabilityService,
    OperatorServiceService,
    TypeOrmModule, // Export TypeORM features for use in other modules
  ],
})
export class AvailabilityModule {}
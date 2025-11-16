import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Operator } from './entities/operator.entity';
import { Service } from './entities/service.entity';
import { OperatorService } from './entities/operator-service.entity';
import { AvailabilityTemplate } from './entities/availability-template.entity';
import { AvailabilityException } from './entities/availability-exception.entity';
import { GroupException } from './entities/group-exception.entity';
import { AvailabilityCache } from './entities/availability-cache.entity';
import { Appointment } from './entities/appointment.entity';

// Services
import { AvailabilityService } from './services/availability.service';

// Resolvers
import { AvailabilityResolver } from './resolvers/availability.resolver';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Operator,
      Service,
      OperatorService,
      AvailabilityTemplate,
      AvailabilityException,
      GroupException,
      AvailabilityCache,
      Appointment,
    ]),
  ],
  providers: [
    AvailabilityService,
    AvailabilityResolver,
  ],
  exports: [
    AvailabilityService,
    TypeOrmModule, // Export TypeORM features for use in other modules
  ],
})
export class AvailabilityModule {}
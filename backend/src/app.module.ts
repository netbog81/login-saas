import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AvailabilitiesModule } from './availabilities/availabilities.module';
import { SeedModule } from './seed/seed.module';
import { User } from './entities/user.entity';
import { Patient } from './entities/patient.entity';
import { Appointment } from './entities/appointment.entity';
import { Availability } from './entities/availability.entity';
// New availability management module
import { AvailabilityModule } from './modules/availability/availability.module';
// Import new entities for availability management
import { Operator } from './modules/availability/entities/operator.entity';
import { Service } from './modules/availability/entities/service.entity';
import { OperatorService } from './modules/availability/entities/operator-service.entity';
import { AvailabilityTemplate } from './modules/availability/entities/availability-template.entity';
import { TemplatePattern } from './modules/availability/entities/template-pattern.entity';
import { TemplateAssignment } from './modules/availability/entities/template-assignment.entity';
import { AvailabilityException } from './modules/availability/entities/availability-exception.entity';
import { GroupException } from './modules/availability/entities/group-exception.entity';
import { AvailabilityCache } from './modules/availability/entities/availability-cache.entity';
import { AvailabilityAppointment } from './modules/availability/entities/availability-appointment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'calendar_db',
      entities: [
        User,
        Patient,
        Appointment,
        Availability,
        // New availability management entities
        Operator,
        Service,
        OperatorService,
        AvailabilityTemplate,
        TemplatePattern,
        TemplateAssignment,
        AvailabilityException,
        GroupException,
        AvailabilityCache,
        AvailabilityAppointment
      ],
      autoLoadEntities: false, // Disabled to prevent conflicts
      synchronize: false, // Disabled to prevent conflicts - use migrations instead
      logging: process.env.NODE_ENV === 'development',
    }),
    // GraphQL configuration
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true, // Enable GraphQL Playground
      introspection: true, // Enable introspection for development
    }),
    UsersModule,
    PatientsModule,
    AppointmentsModule,
    AvailabilitiesModule,
    SeedModule,
    // New availability management module (separate from existing)
    AvailabilityModule,
  ],
})
export class AppModule {}

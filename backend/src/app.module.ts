import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { UsersModule } from './users/users.module';
import { PazientiModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AvailabilitiesModule } from './availabilities/availabilities.module';
import { SeedModule } from './seed/seed.module';
import { User } from './entities/user.entity';
import { Patient } from './entities/patient.entity';
import { Appointment } from './entities/appointment.entity';
import { Availability } from './entities/availability.entity';
// New availability management module
import { AvailabilityModule } from './modules/availability/availability.module';
// Settings module
import { SettingsModule } from './modules/settings/settings.module';
// Tasks module (cron jobs)
import { TasksModule } from './modules/tasks/tasks.module';
// Import new entities for availability management
import { Operator } from './modules/availability/entities/operator.entity';
import { OperatorCategory } from './modules/availability/entities/operator-category.entity';
import { Service } from './modules/availability/entities/service.entity';
import { OperatorService } from './modules/availability/entities/operator-service.entity';
import { AvailabilityTemplate } from './modules/availability/entities/availability-template.entity';
import { TemplatePattern } from './modules/availability/entities/template-pattern.entity';
import { PatternGroup } from './modules/availability/entities/pattern-group.entity';
import { TemplateAssignment } from './modules/availability/entities/template-assignment.entity';
import { AvailabilityException } from './modules/availability/entities/availability-exception.entity';
import { GroupException } from './modules/availability/entities/group-exception.entity';
import { AvailabilityCache } from './modules/availability/entities/availability-cache.entity';
import { AvailabilityAppointment } from './modules/availability/entities/availability-appointment.entity';
import { InstrumentCategory } from './modules/availability/entities/instrument-category.entity';
import { Instrument } from './modules/availability/entities/instrument.entity';
import { GymRoom } from './modules/availability/entities/gym-room.entity';
import { GymSchedule } from './modules/availability/entities/gym-schedule.entity';
import { GymPatternGroup } from './modules/availability/entities/gym-pattern-group.entity';
import { GymTemplatePattern } from './modules/availability/entities/gym-template-pattern.entity';
import { GymException } from './modules/availability/entities/gym-exception.entity';
import { Room } from './modules/availability/entities/room.entity';
import { ServiceInstrument } from './modules/availability/entities/service-instrument.entity';
import { AppointmentInstrument } from './modules/availability/entities/appointment-instrument.entity';
import { AppointmentLog } from './modules/availability/entities/appointment-log.entity';
import { GeneralSettings } from './modules/settings/entities/general-settings.entity';
import { ServiceSubcategory } from './modules/availability/entities/service-subcategory.entity';
import { Treatment } from './modules/availability/entities/treatment.entity';
import { TreatmentInstrument } from './modules/availability/entities/treatment-instrument.entity';
// Therapeutic path entities
import { TherapeuticPath } from './modules/availability/entities/therapeutic-path.entity';
import { PatientEvaluation } from './modules/availability/entities/patient-evaluation.entity';
import { PathDocument } from './modules/availability/entities/path-document.entity';
// Pazienti module entities
import { PersonaRiferimento } from './patients/entities/persona-riferimento.entity';
import { PazientePersonaRelazione } from './patients/entities/paziente-persona-relazione.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Schedule module for cron jobs
    ScheduleModule.forRoot(),
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
        GymPatternGroup,
        GymTemplatePattern,
        GymException,
        Room,
        ServiceInstrument,
        AppointmentInstrument,
        AppointmentLog,
        GeneralSettings,
        ServiceSubcategory,
        Treatment,
        TreatmentInstrument,
        // Therapeutic path entities
        TherapeuticPath,
        PatientEvaluation,
        PathDocument,
        // Pazienti module entities
        PersonaRiferimento,
        PazientePersonaRelazione,
      ],
      autoLoadEntities: false, // Disabled to prevent conflicts
      synchronize: false, // Disabled to prevent conflicts - use migrations instead
      logging: process.env.NODE_ENV === 'development',
      migrationsRun: true,
      migrations: [__dirname + '/../migrations/*.ts'], // ✅ AGGIUNGI QUESTA
      migrationsTableName: 'migrations', // ✅ OPZIONALE MA CONSIGLIATO
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
    PazientiModule,
    AppointmentsModule,
    AvailabilitiesModule,
    SeedModule,
    // New availability management module (separate from existing)
    AvailabilityModule,
    // Settings module
    SettingsModule,
    // Tasks module (cron jobs)
    TasksModule,
  ],
})
export class AppModule {}

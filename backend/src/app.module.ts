import { Module, DynamicModule, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';
import { join } from 'path';
import { OpenbaoBaseModule, OpenbaoBaseService } from '@curandis/openbao-core';
import { CredentialSourceTracker } from './health/credential-source-tracker.service';
import { HealthController } from './health/health.controller';
import { MainDbCredentialManager } from './database/main-db-credential-manager.service';
import { TenantSchemaService } from './database/tenant-schema.service';
import { TenantSchemaContextService } from './database/tenant-schema-context.service';
import { TenantSchemaSubscriber } from './database/tenant-schema.subscriber';
import { TenantAuditService } from './database/tenant-audit.service';
import { TenantAdminResolver } from './database/tenant-admin.resolver';
import { TenantOpenbaoResolverService } from './database/tenant-openbao-resolver.service';
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';
import { JwksService } from './auth/jwks.service';
import { MeController } from './auth/me.controller';
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
// Events module (SSE)
import { EventsModule } from './modules/events/events.module';
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
import { GymExceptionSubstitute } from './modules/availability/entities/gym-exception-substitute.entity';
import { OperatorAbsenceType } from './modules/availability/entities/operator-absence-type.entity';
import { Room } from './modules/availability/entities/room.entity';
import { ServiceInstrument } from './modules/availability/entities/service-instrument.entity';
import { AppointmentInstrument } from './modules/availability/entities/appointment-instrument.entity';
import { AppointmentLog } from './modules/availability/entities/appointment-log.entity';
import { GeneralSettings } from './modules/settings/entities/general-settings.entity';
import { ServiceSubcategory } from './modules/availability/entities/service-subcategory.entity';
import { Treatment } from './modules/availability/entities/treatment.entity';
import { TreatmentInstrument } from './modules/availability/entities/treatment-instrument.entity';
import { AppointmentService } from './modules/availability/entities/appointment-service.entity';
import { TreatmentService } from './modules/availability/entities/treatment-service.entity';
import { TreatmentInvoiceLine } from './modules/availability/entities/treatment-invoice-line.entity';
import { ServiceInvoicePrefix } from './modules/availability/entities/service-invoice-prefix.entity';
// Therapeutic path entities
import { TherapeuticPath } from './modules/availability/entities/therapeutic-path.entity';
import { PathDocument } from './modules/availability/entities/path-document.entity';
// Patient evaluation entities (renamed from anamnesis)
import { PatientEvaluation } from './modules/availability/entities/patient-evaluation.entity';
import { EvaluationObjective } from './modules/availability/entities/evaluation-objective.entity';
import { EvaluationTest } from './modules/availability/entities/evaluation-test.entity';
import { EvaluationExam } from './modules/availability/entities/evaluation-exam.entity';
// Progress tracking entities
import { ObjectiveProgressHistory } from './modules/availability/entities/objective-progress-history.entity';
import { TestEvaluationHistory } from './modules/availability/entities/test-evaluation-history.entity';
// Patient anamnesis entity (NEW - linked to patient, not path)
import { PatientAnamnesis } from './modules/availability/entities/patient-anamnesis.entity';
// Pazienti module entities
import { PersonaRiferimento } from './patients/entities/persona-riferimento.entity';
import { PazientePersonaRelazione } from './patients/entities/paziente-persona-relazione.entity';
// App Users module (multi-type user management + RBAC)
import { AppUsersModule } from './modules/users/app-users.module';
import { AppUser } from './modules/users/entities/app-user.entity';
import { Role } from './modules/users/entities/role.entity';
import { Permission } from './modules/users/entities/permission.entity';
import { UserRole } from './modules/users/entities/user-role.entity';
import { RolePermission } from './modules/users/entities/role-permission.entity';
import { Secretary } from './modules/users/entities/secretary.entity';
import { PrivacyOfficer } from './modules/users/entities/privacy-officer.entity';
import { ItManager } from './modules/users/entities/it-manager.entity';
// WhatsApp Gateway integration module
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { WhatsappTenantConfig } from './modules/whatsapp/config/entities/whatsapp-tenant-config.entity';
import { WhatsappMessageTemplate } from './modules/whatsapp/template/entities/whatsapp-message-template.entity';
import { WhatsappMessageLog } from './modules/whatsapp/log/entities/whatsapp-message-log.entity';
import { WhatsappWebhookEvent } from './modules/whatsapp/webhook/entities/whatsapp-webhook-event.entity';
import { WaitingListEntry } from './modules/availability/entities/waiting-list-entry.entity';
// Task Message integration module
import { TaskMessageModule } from './modules/task-message/task-message.module';
import { TaskMessage } from './modules/task-message/entities/task-message.entity';
import { TaskMessageWebhookEvent } from './modules/task-message/entities/task-message-webhook-event.entity';

/** All entities registered in the application */
const ALL_ENTITIES = [
  User,
  Patient,
  Appointment,
  Availability,
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
  GymExceptionSubstitute,
  OperatorAbsenceType,
  Room,
  ServiceInstrument,
  AppointmentInstrument,
  AppointmentLog,
  GeneralSettings,
  ServiceSubcategory,
  Treatment,
  TreatmentInstrument,
  AppointmentService,
  TreatmentService,
  TreatmentInvoiceLine,
  ServiceInvoicePrefix,
  TherapeuticPath,
  PathDocument,
  PatientEvaluation,
  EvaluationObjective,
  EvaluationTest,
  EvaluationExam,
  ObjectiveProgressHistory,
  TestEvaluationHistory,
  PatientAnamnesis,
  WaitingListEntry,
  PersonaRiferimento,
  PazientePersonaRelazione,
  // App Users system
  AppUser,
  Role,
  Permission,
  UserRole,
  RolePermission,
  Secretary,
  PrivacyOfficer,
  ItManager,
  // WhatsApp Gateway
  WhatsappTenantConfig,
  WhatsappMessageTemplate,
  WhatsappMessageLog,
  WhatsappWebhookEvent,
  // Task Message system
  TaskMessage,
  TaskMessageWebhookEvent,
];

interface AppModuleOptions {
  mainDbCredentials: { username: string; password: string };
  openbaoService: OpenbaoBaseService;
}

@Module({})
export class AppModule implements NestModule {
  /**
   * Bootstrap dinamico con credenziali DB da OpenBao.
   * Chiamato da main.ts dopo aver ottenuto le credenziali.
   * Quando OpenBao ruota le credenziali, MainDbCredentialManager
   * esegue il hot-swap del DataSource automaticamente.
   */
  static forRootAsync(options: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
        HttpModule,
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: options.mainDbCredentials.username,
          password: options.mainDbCredentials.password,
          database: process.env.DB_DATABASE || 'calendar_db',
          entities: ALL_ENTITIES,
          autoLoadEntities: false,
          synchronize: false,
          logging: process.env.NODE_ENV === 'development',
          migrationsRun: true,
          migrations: [__dirname + '/migrations/*.{ts,js}'],
          migrationsTableName: 'migrations',
        }),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          playground: true,
          introspection: true,
        }),
        OpenbaoBaseModule.forRoot(options.openbaoService),
        UsersModule,
        PazientiModule,
        AppointmentsModule,
        AvailabilitiesModule,
        SeedModule,
        AvailabilityModule,
        SettingsModule,
        TasksModule,
        EventsModule,
        AppUsersModule,
        WhatsappModule,
        TaskMessageModule,
      ],
      controllers: [MeController, HealthController],
      providers: [
        CredentialSourceTracker,
        MainDbCredentialManager,
        TenantSchemaService,
        TenantSchemaContextService,
        TenantSchemaSubscriber,
        TenantAuditService,
        TenantAdminResolver,
        TenantOpenbaoResolverService,
        TenantContextMiddleware,
        JwksService,
      ],
      exports: [
        TenantSchemaContextService,
        TenantOpenbaoResolverService,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    // Applica TenantContextMiddleware a tutte le rotte operative
    // Escludi: health check, graphql playground, rotte SSE
    consumer
      .apply(TenantContextMiddleware)
      .exclude('health/status', 'events/(.*)', 'api/webhooks/(.*)')
      .forRoutes('*');
  }
}

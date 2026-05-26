import { Module, DynamicModule, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
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
import { TenantContextInterceptor } from './middleware/tenant-context.interceptor';
import { RegistryModule } from './modules/registry/registry.module';
import { RegistryClient } from './modules/registry/registry.client';
import { buildGraphqlContext } from './modules/registry/utils/build-graphql-context';
import { RegistryEventsModule } from './modules/registry-events/registry-events.module';
import { ClinicalEventsModule } from './modules/clinical-events/clinical-events.module';
import { ClinicalEventBufferMiddleware } from './modules/clinical-events/clinical-event-buffer.middleware';
import { SalesModule } from './modules/sales/sales.module';
import { JwksService } from './auth/jwks.service';
import { MeController } from './auth/me.controller';
import { UsersModule } from './users/users.module';
import { PazientiModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AvailabilitiesModule } from './availabilities/availabilities.module';
import { SeedModule } from './seed/seed.module';
import { User } from './entities/user.entity';
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
// Pazienti module entities (post-registry-integration)
import { ClinicalSubjectIndex } from './patients/entities/clinical-subject-index.entity';
import { ClinicalAttendanceLog } from './patients/entities/clinical-attendance-log.entity';
import { ClinicalRelationshipExtension } from './patients/entities/clinical-relationship-extension.entity';
import { ProcessedRegistryEvent } from './modules/registry-events/processed-event.entity';
// Billing integration step 1 (sessione 6) — entity nuove + idempotency consumer accounting
import { Site } from './modules/availability/entities/site.entity';
import { Product } from './modules/availability/entities/product.entity';
import { ProcessedClinicalEvent } from './modules/clinical-events/processed-clinical-event.entity';
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
// Recycle bin (cestino soft-deleted records)
import { RecycleBinModule } from './modules/recycle-bin/recycle-bin.module';
import { RecycleBinSettings } from './modules/availability/entities/recycle-bin-settings.entity';

/** All entities registered in the application */
const ALL_ENTITIES = [
  User,
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
  ClinicalSubjectIndex,
  ClinicalAttendanceLog,
  ClinicalRelationshipExtension,
  ProcessedRegistryEvent,
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
  // Recycle bin
  RecycleBinSettings,
  // Billing integration step 1 (sessione 6)
  Site,
  Product,
  ProcessedClinicalEvent,
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
          // Sessione 7 — Hardening pool node-postgres. Default era max=10,
          // connectionTimeoutMillis=0 (infinito). Incident 26/05: pgAdmin
          // sature Postgres (~30 conn), clinico/accounting non riuscivano
          // ad aprire connessioni e i consumer RabbitMQ andavano in DLQ.
          //
          // Configurabili via .env in caso di sistemi più grandi:
          //   DB_POOL_MAX (default 20)
          //   DB_POOL_IDLE_TIMEOUT_MS (default 10000)
          //   DB_POOL_CONNECTION_TIMEOUT_MS (default 5000) — KEY: fail-fast
          //     se Postgres satura, invece di appendere richieste HTTP
          //     indefinitamente. L'errore arriva subito al client.
          extra: {
            max: parseInt(process.env.DB_POOL_MAX || '20', 10),
            idleTimeoutMillis: parseInt(
              process.env.DB_POOL_IDLE_TIMEOUT_MS || '10000',
              10,
            ),
            connectionTimeoutMillis: parseInt(
              process.env.DB_POOL_CONNECTION_TIMEOUT_MS || '5000',
              10,
            ),
          },
        }),
        RegistryModule,
        RegistryEventsModule,
        ClinicalEventsModule,
        SalesModule,
        GraphQLModule.forRootAsync<ApolloDriverConfig>({
          driver: ApolloDriver,
          imports: [RegistryModule],
          inject: [RegistryClient],
          useFactory: (registryClient: RegistryClient) => ({
            autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
            sortSchema: true,
            playground: true,
            introspection: true,
            context: ({ req }) => buildGraphqlContext(req, registryClient),
          }),
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
        RecycleBinModule,
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
        {
          provide: APP_INTERCEPTOR,
          useClass: TenantContextInterceptor,
        },
      ],
      exports: [
        TenantSchemaContextService,
        TenantOpenbaoResolverService,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    // ClinicalEventBufferMiddleware: wrappa OGNI request HTTP in
    // eventBuffer.runInScope(...) così i service business possono fare
    // eventBuffer.add() senza preoccuparsi di setup ALS. Va applicato
    // PRIMA del TenantContextMiddleware, ma entrambi sono safe-by-design
    // (l'ordine importa solo per la pulizia logica del flusso).
    consumer
      .apply(ClinicalEventBufferMiddleware)
      .exclude('health/status', 'events/(.*)', 'api/webhooks/(.*)')
      .forRoutes('*');

    // Applica TenantContextMiddleware a tutte le rotte operative
    // Escludi: health check, graphql playground, rotte SSE
    consumer
      .apply(TenantContextMiddleware)
      .exclude('health/status', 'events/(.*)', 'api/webhooks/(.*)')
      .forRoutes('*');
  }
}

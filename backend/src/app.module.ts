import { Module, DynamicModule, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';
import { join } from 'path';
import { OpenbaoBaseModule, OpenbaoBaseService } from '@curandis/openbao-core';
import { TenantDataSourceModule } from '@curandis/tenant-datasource';
import { AuthCoreModule, CurandisTenantContextMiddleware } from '@curandis/auth-core';
import { HealthController } from './health/health.controller';
import { TenantAdminResolver } from './database/tenant-admin.resolver';
import { RegistryModule } from './modules/registry/registry.module';
import { RegistryClient } from './modules/registry/registry.client';
import { buildGraphqlContext } from './modules/registry/utils/build-graphql-context';
import { RegistryEventsModule } from './modules/registry-events/registry-events.module';
import { ClinicalEventsModule } from './modules/clinical-events/clinical-events.module';
import { ClinicalEventBufferMiddleware } from './modules/clinical-events/clinical-event-buffer.middleware';
import { AccountingApiModule } from './modules/accounting-api/accounting-api.module';
import { SalesModule } from './modules/sales/sales.module';
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
import { Chair } from './modules/availability/entities/chair.entity';
import { TemplateAssignmentRoomOverride } from './modules/availability/entities/template-assignment-room-override.entity';
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
import { VoucherFe } from './modules/availability/entities/voucher-fe.entity';
import { VoucherFeUsage } from './modules/availability/entities/voucher-fe-usage.entity';
// Therapeutic path entities
import { TherapeuticPath } from './modules/availability/entities/therapeutic-path.entity';
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
import { EventOutbox } from './modules/clinical-events/entities/event-outbox.entity';
import { TransactionOutboxSubscriber } from './modules/clinical-events/transaction-outbox.subscriber';
import { Product } from './modules/availability/entities/product.entity';
import { ProcessedClinicalEvent } from './modules/clinical-events/processed-clinical-event.entity';
// App Users module (multi-type user management + RBAC)
import { AppUsersModule } from './modules/users/app-users.module';
import { AppUser } from './modules/users/entities/app-user.entity';
import { Role } from './modules/users/entities/role.entity';
import { Permission } from './modules/users/entities/permission.entity';
import { UserRole } from './modules/users/entities/user-role.entity';
import { RolePermission } from './modules/users/entities/role-permission.entity';
import { PermissionDenial } from './modules/users/entities/permission-denial.entity';
import { Secretary } from './modules/users/entities/secretary.entity';
import { PrivacyOfficer } from './modules/users/entities/privacy-officer.entity';
import { ItManager } from './modules/users/entities/it-manager.entity';
// WhatsApp Gateway integration module
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { WhatsappTenantConfig } from './modules/whatsapp/config/entities/whatsapp-tenant-config.entity';
import { WhatsappMessageTemplate } from './modules/whatsapp/template/entities/whatsapp-message-template.entity';
import { WhatsappMessageLog } from './modules/whatsapp/log/entities/whatsapp-message-log.entity';
import { WhatsappWebhookEvent } from './modules/whatsapp/webhook/entities/whatsapp-webhook-event.entity';
import { WhatsappConversation } from './modules/whatsapp/chat/entities/whatsapp-conversation.entity';
import { WhatsappChatMessage } from './modules/whatsapp/chat/entities/whatsapp-chat-message.entity';
import { WaitingListEntry } from './modules/availability/entities/waiting-list-entry.entity';
// Task Message integration module
import { TaskMessageModule } from './modules/task-message/task-message.module';
import { TaskMessage } from './modules/task-message/entities/task-message.entity';
import { TaskMessageWebhookEvent } from './modules/task-message/entities/task-message-webhook-event.entity';
// Recycle bin (cestino soft-deleted records)
import { RecycleBinModule } from './modules/recycle-bin/recycle-bin.module';
import { RecycleBinSettings } from './modules/availability/entities/recycle-bin-settings.entity';
import { InvoiceLineSettings } from './modules/availability/entities/invoice-line-settings.entity';
// Template documenti (attestati di presenza)
import { DocumentTemplatesModule } from './modules/document-templates/document-templates.module';
import { DocumentTemplate } from './modules/document-templates/entities/document-template.entity';
// Conti FE (compensi operatore sui trattamenti sconto FE)
import { OperatorFeAccountsModule } from './modules/operator-fe-accounts/operator-fe-accounts.module';
import { NoShowModule } from './modules/no-show/no-show.module';
import { NoShowReview } from './modules/no-show/entities/no-show-review.entity';
import { OperatorFeSettlement } from './modules/operator-fe-accounts/entities/operator-fe-settlement.entity';
import { OperatorFeSettlementLine } from './modules/operator-fe-accounts/entities/operator-fe-settlement-line.entity';
import { OperatorFeAccountSettings } from './modules/operator-fe-accounts/entities/operator-fe-account-settings.entity';
// Documenti paziente (S3 MicroCeph + envelope encryption via OpenBao Transit)
import { EncryptionCoreModule } from '@curandis/encryption-core';
import { StorageCoreModule } from '@curandis/storage-core';
import { OpenbaoTokenModule } from './infrastructure/openbao/openbao-token.module';
import { OpenbaoTokenProvider } from './infrastructure/openbao/openbao-token.provider';
import { readS3ConfigFromKv } from './infrastructure/openbao/s3-kv-config';
import { PatientDocumentsModule } from './modules/patient-documents/patient-documents.module';
import { PatientDocument } from './modules/patient-documents/entities/patient-document.entity';
import { GoogleCalendarConnection } from './modules/availability/entities/google-calendar-connection.entity';
import { CalendarFeedSetupLink } from './modules/availability/entities/calendar-feed-setup-link.entity';
import { PatientCalendarFeed } from './modules/availability/entities/patient-calendar-feed.entity';
import { CalendarSyncSetting } from './modules/availability/entities/calendar-sync-setting.entity';
import {
  NotificationChannelSetting,
} from './modules/whatsapp/notifications/entities/notification-channel-setting.entity';

/** All entities registered in the application */
const ALL_ENTITIES = [
  EventOutbox,
  GoogleCalendarConnection,
  CalendarFeedSetupLink,
  PatientCalendarFeed,
  CalendarSyncSetting,
  NotificationChannelSetting,
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
  Chair,
  TemplateAssignmentRoomOverride,
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
  VoucherFe,
  VoucherFeUsage,
  TherapeuticPath,
  PatientDocument,
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
  PermissionDenial,
  Secretary,
  PrivacyOfficer,
  ItManager,
  // WhatsApp Gateway
  WhatsappTenantConfig,
  WhatsappMessageTemplate,
  WhatsappMessageLog,
  WhatsappWebhookEvent,
  WhatsappConversation,
  WhatsappChatMessage,
  // Task Message system
  TaskMessage,
  TaskMessageWebhookEvent,
  // Recycle bin
  RecycleBinSettings,
  InvoiceLineSettings,
  // Billing integration step 1 (sessione 6)
  Site,
  Product,
  ProcessedClinicalEvent,
  // Template documenti
  DocumentTemplate,
  // Conti FE
  OperatorFeSettlement,
  OperatorFeSettlementLine,
  OperatorFeAccountSettings,
  // Gestione assenze ingiustificate (No Show)
  NoShowReview,
];

interface AppModuleOptions {
  openbaoService: OpenbaoBaseService;
}

@Module({})
export class AppModule implements NestModule {
  /**
   * Bootstrap dinamico via OpenBao + DB-per-tenant.
   *
   * Architettura (post-containerizzazione 2026-06-11):
   *  - No "main DB": il calendar_db schema-per-tenant è morto, ogni tenant
   *    ha il proprio database `clinico_<hash>`.
   *  - TenantDataSourceModule (lib @curandis/tenant-datasource): risolve
   *    tenantAlias → DataSource via OpenBao KV `tenant-clinico-db/<alias>`
   *    e static-creds `database/static-creds/postgres-clinico_*_svc`.
   *  - AuthCoreModule (lib @curandis/auth-core): rimpiazza JwksService +
   *    TenantContextMiddleware/Interceptor custom.
   *
   * NOTA WIP 4.3: alcuni provider custom (MainDbCredentialManager,
   * TenantSchemaService, TenantSchemaContextService, TenantContextMiddleware,
   * ecc.) sono ancora qui perché 13 file consumer li importano. Saranno
   * rimossi in 4.4 (refactor consumer) + 4.5 (cleanup providers).
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

        // OpenBao — registra il service creato in bootstrap
        OpenbaoBaseModule.forRoot(options.openbaoService),

        // Tenant DataSource — DB-per-tenant via OpenBao
        TenantDataSourceModule.forRoot({
          openbaoKvPath: 'tenant-clinico-db',
          openbaoStaticCredsPathPattern: 'database/static-creds/postgres-{username}',
          entities: ALL_ENTITIES,
          idleTimeoutMs: 10 * 60 * 1000,
          tenantInfoTtlMs: 5 * 60 * 1000,
          extraTypeOrmOptions: {
            // 2026-09-02 — Rende TRANSAZIONALE l'outbox degli eventi su OGNI
            // DataSource di tenant, senza che il codice di business debba
            // saperne nulla: il subscriber intercetta l'inizio e il commit di
            // qualunque transazione, anche di quelle che verranno scritte in
            // futuro. Vedi transaction-outbox.subscriber.ts.
            // La classe, non un'istanza: la costruisce TypeORM (nessuna
            // dipendenza da iniettare — usa lo scope condiviso di event-scope.ts).
            subscribers: [TransactionOutboxSubscriber],
            synchronize: false,
            // migrationsRun: false — il restore 2026-06-10 ha già popolato
            // public.migrations con tutte le 79 entry. Le migrazioni nuove
            // si applicheranno via `npm run migration:run` esplicito.
            migrationsRun: false,
            migrations: [__dirname + '/migrations/*.{ts,js}'],
            migrationsTableName: 'migrations',
            logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
            // Pool node-postgres — hardening 2026-05-26 post-incident
            // saturazione Postgres.
            extra: {
              max: parseInt(process.env.DB_POOL_MAX || '20', 10),
              idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || '10000', 10),
              connectionTimeoutMillis: parseInt(
                process.env.DB_POOL_CONNECTION_TIMEOUT_MS || '5000',
                10,
              ),
            },
          },
        }),

        // Auth — sostituisce JwksService custom + TenantContextMiddleware
        // NOTA (federation 2026-07-03): aggiunto pattern gestione.{tenant} per suite federation
        // e "gestione" a nonTenantSubdomains. In federation, il tenant DEVE venire dal JWT,
        // non dall'hostname (che può essere gestione.{tenant} dal browser della suite).
        AuthCoreModule.forRoot({
          keycloakUrl: process.env.KEYCLOAK_URL,
          keycloakRealm: process.env.KEYCLOAK_REALM || 'curandis',
          keycloakClientId: process.env.KEYCLOAK_CLIENT_ID || 'curandis-app-angular',
          tenantResolver: {
            fromHeader: 'x-tenant-alias',
            fromSubdomainPatterns: [
              /^clinico\.([^.]+)\.curandis\.cloud$/,
              /^agenda\.([^.]+)\.curandis\.cloud$/,
              /^gestione\.([^.]+)\.curandis\.cloud$/, // suite federation host
            ],
            fromJwtClaim: 'organization',
            fromJwtOrgIdClaim: 'org_id',
            nonTenantSubdomains: ['api', 'auth', 'tenants', 'my', 'www', 'registry', 'accounting', 'clinico', 'agenda', 'gestione'],
          },
          // S2S: il registry chiama il clinico (cron riconciliazione senza JWT utente).
          serviceAccountClientIds: ['curandis-registry-service'],
        }),

        // Documenti paziente — Transit envelope encryption + S3 MicroCeph.
        // Token via OpenbaoTokenProvider (agent sink fresh a ogni chiamata);
        // config S3 letta lazy da kv/clinico/s3 alla prima operazione.
        OpenbaoTokenModule,
        EncryptionCoreModule.forRootAsync({
          useFactory: (tokenProvider: OpenbaoTokenProvider) => ({
            openbaoAddr: process.env.OPENBAO_ADDR,
            tokenProvider: () => tokenProvider.getToken(),
            transitPath: 'transit',
          }),
          inject: [OpenbaoTokenProvider],
        }),
        StorageCoreModule.forRootAsync({
          useFactory: (tokenProvider: OpenbaoTokenProvider) => ({
            bucketPrefix: process.env.DOCS_BUCKET_PREFIX || 'curandis-clinico-docs',
            // Credenziali S3 PER TENANT: kv/tenant-clinico-s3/<alias>
            // (utente RGW dedicato), fallback kv/clinico/s3.
            s3ConfigProvider: (tenantAlias: string) =>
              readS3ConfigFromKv(tokenProvider, tenantAlias),
          }),
          inject: [OpenbaoTokenProvider],
        }),

        RegistryModule,
        RegistryEventsModule,
        ClinicalEventsModule,
        AccountingApiModule,
        SalesModule,
        GraphQLModule.forRootAsync<ApolloDriverConfig>({
          driver: ApolloDriver,
          imports: [RegistryModule],
          inject: [RegistryClient],
          useFactory: (registryClient: RegistryClient) => ({
            // In container l'utente non-root non scrive in /app/src.
            // Usa /tmp che è sempre writable.
            autoSchemaFile: process.env.NODE_ENV === 'production'
              ? '/tmp/schema.gql'
              : join(process.cwd(), 'src/schema.gql'),
            sortSchema: true,
            playground: true,
            introspection: true,
            context: ({ req }) => buildGraphqlContext(req, registryClient),
          }),
        }),
        UsersModule,
        PazientiModule,
        AppointmentsModule,
        AvailabilitiesModule,
        SeedModule,
        AvailabilityModule,
        SettingsModule,
        DocumentTemplatesModule,
        OperatorFeAccountsModule,
        NoShowModule,
        TasksModule,
        EventsModule,
        AppUsersModule,
        WhatsappModule,
        TaskMessageModule,
        RecycleBinModule,
        PatientDocumentsModule,
      ],
      controllers: [MeController, HealthController],
      providers: [TenantAdminResolver],
      exports: [],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    // ClinicalEventBufferMiddleware: wrappa OGNI request HTTP in
    // eventBuffer.runInScope(...) così i service business possono fare
    // eventBuffer.add() senza preoccuparsi di setup ALS.
    consumer
      .apply(ClinicalEventBufferMiddleware)
      .exclude('health/status', 'health/live', 'events/(.*)', 'api/webhooks/(.*)', 'calendar-feed/(.*)', 'integrations/google-calendar/(.*)')
      .forRoutes('*');

    // CurandisTenantContextMiddleware (auth-core): valida JWT, risolve
    // tenantAlias da header/subdomain/JWT, ottiene il DataSource del
    // tenant dal pool TenantDataSourceManager, popola req.tenantContext
    // e fa partire next() dentro l'AsyncLocalStorage del TenantContextService.
    //
    // Le rotte escluse non hanno tenant scope (webhook esterni si
    // costruiscono il contesto a mano via tenantDsManager.getDataSource).
    // NB: events/(.*) NON è più esclusa (2026-07-28): il canale SSE è
    // autenticato e scoped per tenant/utente; il frontend manda il Bearer
    // via client fetch-based.
    consumer
      .apply(CurandisTenantContextMiddleware)
      .exclude(
        { path: 'health/status', method: RequestMethod.ALL },
        { path: 'health/live', method: RequestMethod.ALL },
        { path: 'api/webhooks/(.*)', method: RequestMethod.ALL },
        // Feed ICS dell'agenda operatore: lo scarica l'app di calendario
        // dell'operatore (iOS, Google, Outlook), che non sa fare OAuth né
        // mandare un Bearer. L'unica credenziale è il token nell'URL, e il
        // controller si costruisce il contesto tenant a mano dal sottodominio.
        { path: 'calendar-feed/(.*)', method: RequestMethod.ALL },
        // Ritorno del consenso Google: ci arriva il browser dell'utente per
        // redirect, senza Authorization header. Il tenant viene dallo state
        // firmato in HMAC, e il controller costruisce il contesto a mano.
        { path: 'integrations/google-calendar/callback', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}

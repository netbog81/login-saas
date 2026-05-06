/**
 * Bootstrap sync iniziale catalogo clinico → accounting.
 *
 * Pubblica un evento `service.upserted.<tenant>` per ogni `Service` esistente
 * e un `product.upserted.<tenant>` per ogni `Product` esistente nel tenant
 * specificato. Da lanciare una volta sola al go-live, dopo che il consumer
 * accounting `clinical-services-sync/` è up e bind-ato a `service.upserted.*`
 * (idem per `product.*`).
 *
 * IDEMPOTENCY: usa il `serviceCode` (e `productCode`) come business key.
 * L'accounting upserta sulla mapping table `clinical_service_mapping`
 * (UNIQUE su `(organizationId, clinicalServiceId)`) — re-runnare lo script
 * NON crea duplicati.
 *
 * USO:
 *   cd backend
 *   npm run sync:services -- --tenant bdq
 *
 * OPZIONI:
 *   --tenant <alias>         richiesto se non passi --schema
 *   --schema <schemaName>    bypass OpenBao resolver (utile in dev senza OpenBao)
 *   --only services|products default = entrambi
 *   --dry-run                stampa cosa pubblicherebbe senza pubblicare
 *
 * EXIT CODES:
 *   0 = tutti i publish OK (o dry-run completato)
 *   1 = almeno un publish ha fallito (vedi log per dettagli)
 *   2 = errore di setup (DB/broker irraggiungibili, schema sconosciuto)
 *
 * VERIFICA POST-RUN:
 *   - Logs accounting `clinical-services-sync.consumer` mostrano N upsert ricevuti.
 *   - DB accounting: `SELECT COUNT(*) FROM clinical_service_mapping
 *     WHERE clinical_service_id IN (...)` = N.
 */
import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createOpenbaoService } from '@curandis/openbao-core';

import { ClinicalEventsConfig } from '../modules/clinical-events/clinical-events.config';
import { ClinicalEventPublisher } from '../modules/clinical-events/clinical-event.publisher';
import {
  ProductUpsertedPayload,
  ServiceUpsertedPayload,
} from '../modules/clinical-events/clinical-events.types';
import { TenantSchemaContextService } from '../database/tenant-schema-context.service';
import { TenantOpenbaoResolverService } from '../database/tenant-openbao-resolver.service';

import { Service as ServiceEntity } from '../modules/availability/entities/service.entity';
import { Product } from '../modules/availability/entities/product.entity';

// ============================================================================
// Bootstrap dotenv
// ============================================================================
// __dirname con ts-node = backend/src/scripts → backend/.env è 2 livelli su.
// (Con dist/src/scripts a runtime sarebbe lo stesso: i livelli relativi
// dentro `src` o `dist/src` non cambiano rispetto al file di .env.)
const envFilePath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envFilePath });

// ============================================================================
// CLI parsing (no deps)
// ============================================================================
function parseArg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith('--')) {
    return fallback ?? '';
  }
  return value;
}
function parseFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

interface CliOptions {
  tenantAlias?: string;
  schemaOverride?: string;
  only: 'services' | 'products' | 'both';
  dryRun: boolean;
}

function parseCli(): CliOptions {
  const tenantAlias = parseArg('tenant');
  const schemaOverride = parseArg('schema');
  const only = (parseArg('only', 'both') ?? 'both') as CliOptions['only'];
  const dryRun = parseFlag('dry-run');

  if (!tenantAlias && !schemaOverride) {
    console.error('Errore: serve --tenant <alias> oppure --schema <schemaName>.');
    console.error('Esempio: npm run sync:services -- --tenant bdq');
    process.exit(2);
  }
  if (!['services', 'products', 'both'].includes(only)) {
    console.error(`Errore: --only deve essere "services", "products" o "both" (ricevuto: "${only}").`);
    process.exit(2);
  }
  return { tenantAlias, schemaOverride, only, dryRun };
}

// ============================================================================
// DB credentials: OpenBao (Agent o AppRole) con fallback .env in dev
// ============================================================================
// Replica il pattern di src/main.ts: in dev/prod le password DB stanno in
// OpenBao (path `database/static-creds/postgres-main-service-account`); il
// .env può contenere MAIN_DB_PASSWORD vuoto/placeholder. Senza questo step
// lo script fallirebbe con "password authentication failed for user postgres".
async function resolveDbCredentials(): Promise<{ username: string; password: string }> {
  const isAgentMode = process.env.OPENBAO_AGENT_MODE === 'true';
  const isDevelopment = (process.env.NODE_ENV ?? 'development') === 'development';

  try {
    const result = await createOpenbaoService({
      config: {
        endpoint: process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200',
        agentMode: isAgentMode,
        roleId: isAgentMode ? undefined : process.env.CURANDIS_OPENBAO_ROLE_ID,
        secretId: isAgentMode ? undefined : process.env.CURANDIS_OPENBAO_SECRET_ID,
        envFilePath: isAgentMode ? undefined : envFilePath,
      },
      credentialSources: [
        {
          name: 'main-db',
          staticCredsPath: 'database/static-creds/postgres-main-service-account',
          rotationEventName: 'credentials.main-db.rotated',
          credentialRefreshIntervalMs: 6 * 60 * 60 * 1000,
          fallbackEnvUsername: 'MAIN_DB_USERNAME',
          fallbackEnvPassword: 'MAIN_DB_PASSWORD',
        },
      ],
    });
    return result.credentials['main-db'];
  } catch (err) {
    if (isDevelopment && process.env.MAIN_DB_USERNAME && process.env.MAIN_DB_PASSWORD) {
      console.warn(
        '[WARN] OpenBao non disponibile, uso credenziali fallback dal .env',
      );
      return {
        username: process.env.MAIN_DB_USERNAME,
        password: process.env.MAIN_DB_PASSWORD,
      };
    }
    throw err;
  }
}

// ============================================================================
// Modulo NestJS standalone con DB tenant + publisher
// ============================================================================
function buildModule(
  schemaName: string,
  dbCreds: { username: string; password: string },
) {
  // Glob "src/**/*.entity.ts" come in data-source.ts: TypeORM ha bisogno
  // dell'intero graph di entity perché Service / Product referenziano
  // (transitivamente via @ManyToOne) ServiceSubcategory, AvailabilityAppointment,
  // ecc. Listare a mano qui sarebbe fragile (ogni nuova relation richiederebbe
  // di tornare a manutenere questo script). Il glob risolve i .ts via ts-node.
  // NOTA: lo script gira solo in `ts-node` (vedi package.json scripts);
  // se in futuro verrà eseguito da `dist/`, il glob deve diventare `.js`.
  const entitiesGlob = path.resolve(__dirname, '../**/*.entity.ts');

  @Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: dbCreds.username,
        password: dbCreds.password,
        database: process.env.DB_DATABASE || 'calendar_db',
        schema: schemaName,
        entities: [entitiesGlob],
        synchronize: false,
        migrationsRun: false,
        logging: false,
        extra: { max: 2 },
      }),
      TypeOrmModule.forFeature([ServiceEntity, Product]),
    ],
    providers: [
      ClinicalEventsConfig,
      TenantSchemaContextService,
      TenantOpenbaoResolverService,
      ClinicalEventPublisher,
      SyncRunner,
    ],
  })
  class SyncModule {}
  return SyncModule;
}

// ============================================================================
// SyncRunner: legge entity + invoca publisher
// ============================================================================
import { Injectable } from '@nestjs/common';

@Injectable()
class SyncRunner {
  private readonly logger = new Logger(SyncRunner.name);

  constructor(
    private readonly publisher: ClinicalEventPublisher,
    @InjectRepository(ServiceEntity)
    private readonly servicesRepo: Repository<ServiceEntity>,
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
  ) {}

  async run(opts: {
    tenantAlias: string;
    only: 'services' | 'products' | 'both';
    dryRun: boolean;
  }): Promise<{ servicesOk: number; productsOk: number; errors: number }> {
    let servicesOk = 0;
    let productsOk = 0;
    let errors = 0;

    if (opts.only === 'services' || opts.only === 'both') {
      const services = await this.servicesRepo.find();
      this.logger.log(
        `Servizi trovati: ${services.length}` +
          (opts.dryRun ? ' (dry-run, nessun publish)' : ''),
      );
      for (const s of services) {
        const payload: ServiceUpsertedPayload = {
          serviceId: s.id,
          serviceCode: s.serviceCode,
          name: s.name,
          description: s.description ?? null,
          defaultPrice: this.toDecimalString(s.defaultPrice),
          discountFE: s.discountFE != null ? this.toDecimalString(s.discountFE) : null,
          macroCategory: s.macroCategory ?? null,
          isActive: s.isActive,
        };
        if (opts.dryRun) {
          this.logger.log(
            `[dry-run] service.upserted serviceId=${s.id} serviceCode=${s.serviceCode} name="${s.name}"`,
          );
          servicesOk++;
          continue;
        }
        try {
          await this.publisher.publish({
            eventType: 'service.upserted',
            tenantAlias: opts.tenantAlias,
            payload,
          });
          this.logger.log(
            `[OK] service.upserted serviceId=${s.id} serviceCode=${s.serviceCode}`,
          );
          servicesOk++;
        } catch (err) {
          this.logger.error(
            `[FAIL] service.upserted serviceId=${s.id} serviceCode=${s.serviceCode}: ${(err as Error).message}`,
          );
          errors++;
        }
      }
    }

    if (opts.only === 'products' || opts.only === 'both') {
      const products = await this.productsRepo.find();
      this.logger.log(
        `Prodotti trovati: ${products.length}` +
          (opts.dryRun ? ' (dry-run, nessun publish)' : ''),
      );
      for (const p of products) {
        const payload: ProductUpsertedPayload = {
          productId: p.id,
          productCode: p.productCode,
          name: p.name,
          description: p.description ?? null,
          defaultPrice: this.toDecimalString(p.defaultPrice),
          category: p.category ?? null,
          isActive: p.isActive,
        };
        if (opts.dryRun) {
          this.logger.log(
            `[dry-run] product.upserted productId=${p.id} productCode=${p.productCode} name="${p.name}"`,
          );
          productsOk++;
          continue;
        }
        try {
          await this.publisher.publish({
            eventType: 'product.upserted',
            tenantAlias: opts.tenantAlias,
            payload,
          });
          this.logger.log(
            `[OK] product.upserted productId=${p.id} productCode=${p.productCode}`,
          );
          productsOk++;
        } catch (err) {
          this.logger.error(
            `[FAIL] product.upserted productId=${p.id} productCode=${p.productCode}: ${(err as Error).message}`,
          );
          errors++;
        }
      }
    }

    return { servicesOk, productsOk, errors };
  }

  /**
   * Normalizza un numeric DB (string o number) in stringa decimal "55.00".
   * TypeORM ritorna `decimal` come string in Postgres; il parseFloat è
   * difensivo per casi in cui qualche driver/versione lo casti a number.
   */
  private toDecimalString(v: number | string): string {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (!Number.isFinite(n)) {
      throw new Error(`valore numeric non valido: ${v}`);
    }
    return n.toFixed(2);
  }
}

// ============================================================================
// Resolver schema: --schema bypass, altrimenti OpenBao via tenant alias
// ============================================================================
async function resolveSchemaName(
  cli: CliOptions,
): Promise<{ schemaName: string; tenantAlias: string }> {
  if (cli.schemaOverride) {
    const tenantAlias = cli.tenantAlias ?? cli.schemaOverride;
    if (!cli.tenantAlias) {
      console.warn(
        `[WARN] --schema senza --tenant: uso "${tenantAlias}" come tenantAlias nei payload. ` +
          `Probabilmente vuoi passare anche --tenant esplicito.`,
      );
    }
    return { schemaName: cli.schemaOverride, tenantAlias };
  }

  // OpenBao reverse: alias → schemaName
  const resolver = new TenantOpenbaoResolverService();
  const info = await resolver.resolveTenant(cli.tenantAlias!);
  if (!info) {
    console.error(
      `Errore: tenant alias "${cli.tenantAlias}" non trovato in OpenBao. ` +
        `Se OpenBao non è disponibile, usa --schema <schemaName> come bypass.`,
    );
    process.exit(2);
  }
  if (info.status === 'suspended' || info.status === 'deleted') {
    console.error(
      `Errore: tenant "${cli.tenantAlias}" ha status "${info.status}". Abort.`,
    );
    process.exit(2);
  }
  return { schemaName: info.schemaName, tenantAlias: cli.tenantAlias! };
}

// ============================================================================
// Main
// ============================================================================
async function main(): Promise<void> {
  const cli = parseCli();
  console.log('\n=== Bootstrap sync services + products → accounting ===\n');

  const { schemaName, tenantAlias } = await resolveSchemaName(cli);
  console.log('Parametri:');
  console.log(`  tenantAlias = ${tenantAlias}`);
  console.log(`  schemaName  = ${schemaName}`);
  console.log(`  only        = ${cli.only}`);
  console.log(`  dry-run     = ${cli.dryRun}`);
  console.log('');

  // Risoluzione credenziali DB via OpenBao (con fallback .env in dev).
  // Equivalente al main.ts del backend: senza questo step le password
  // mascherate nel .env non sarebbero utilizzabili.
  let dbCreds: { username: string; password: string };
  try {
    dbCreds = await resolveDbCredentials();
    console.log(`Credenziali DB ottenute (user: ${dbCreds.username})\n`);
  } catch (err) {
    console.error('[FAIL] impossibile risolvere credenziali DB:', err);
    process.exit(2);
  }

  const SyncModule = buildModule(schemaName, dbCreds);
  const app = await NestFactory.createApplicationContext(SyncModule, {
    logger: ['log', 'warn', 'error'],
  });

  // Sanity check: il DataSource si è connesso allo schema giusto?
  try {
    const ds = app.get(DataSource);
    const [row] = await ds.query('SELECT current_schema() AS s');
    if (row?.s !== schemaName) {
      console.warn(
        `[WARN] current_schema()="${row?.s}" ≠ richiesto "${schemaName}". ` +
          `Potrebbe esserci un problema di setup TypeORM (search_path).`,
      );
    }
  } catch {
    // Best-effort: se la verifica fallisce non blocchiamo lo script.
  }

  // Aspetta che il publisher abbia completato il setup canale.
  // Pattern come smoke step 4: amqp-connection-manager fa setup in background.
  await sleep(1500);

  try {
    const runner = app.get(SyncRunner);
    const result = await runner.run({
      tenantAlias,
      only: cli.only,
      dryRun: cli.dryRun,
    });

    console.log('');
    console.log('=== Riepilogo ===');
    console.log(`  Services pubblicati: ${result.servicesOk}`);
    console.log(`  Products pubblicati: ${result.productsOk}`);
    console.log(`  Errori:              ${result.errors}`);
    console.log('');

    await app.close();
    process.exit(result.errors > 0 ? 1 : 0);
  } catch (err) {
    console.error('\n[FAIL] errore inatteso:', err);
    try {
      await app.close();
    } catch {
      /* ignore */
    }
    process.exit(2);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('Errore inatteso:', err);
  process.exit(2);
});

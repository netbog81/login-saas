/* eslint-disable */
// TODO containerization-2026-06-11: questo smoke script CLI è escluso dal
// build TS (vedi tsconfig.json: "exclude": ["src/scripts/**"]) perché ancora
// usa TenantSchemaContextService custom + un default DataSource globale che
// nel mondo container-DB-per-tenant non esistono più. Va riscritto con
// TenantContextService + TenantDataSourceManager di @curandis/tenant-datasource
// prima di rieseguirlo. È un test tool, non runtime: niente impatto sul deploy.
/**
 * Smoke #2 — End-to-end del flusso billing reale (sessione 6 Step 7.7).
 *
 * Differenza con `test-publish-treatment-closed.ts` (smoke #1):
 *  - Smoke #1: pubblica payload statico inventato dal publisher diretto.
 *  - Smoke #2: chiama VERAMENTE i resolver/service del clinico
 *    (`setTreatmentsReadyForBilling`, `updateBySecretary`, `cancelTreatment`,
 *    `recordProductSale`) → triggera tutto il pattern publish-after-commit
 *    con dati VERI letti dal DB del tenant target.
 *
 * SEQUENZA CASCATA (default, su `--treatmentId` esistente in READY_FOR_BILLING):
 *   1. setTreatmentsReadyForBilling([id], true)
 *      → READY_FOR_BILLING → SENT + publish `treatment.closed.<tenant>`
 *   2. wait <wait-ms> (default 3000ms): aspetta round-trip billable.received
 *   3. verify: treatment.billingStatus deve essere PENDING
 *   4. updateBySecretary({ id, amendmentReason: 'smoke #2 amend test' })
 *      → publish `treatment.amended` con revision=1, billingStatus invariato
 *   5. wait <wait-ms>
 *   6. verify: amendmentRevision=1
 *   7. cancelTreatment(id, 'smoke #2 cancel test')
 *      → CANCELLED + publish `treatment.cancelled` (perché era PENDING)
 *   8. wait <wait-ms>
 *   9. verify: treatment.billingStatus=CANCELLED
 *
 * PERCORSO ALTERNATIVO --sale-test:
 *   Esegue solo `recordProductSale` su `--productId Y` + `--purchaserSubjectId Z`.
 *   NB: bdq oggi ha 0 products, l'operatore deve crearne uno PRIMA del run.
 *
 * USO:
 *   cd backend
 *   # Cascata standard
 *   npx ts-node src/scripts/smoke-2-treatment-cascade.ts \
 *     --tenant bdq \
 *     --treatmentId <uuid-treatment-in-READY_FOR_BILLING> \
 *     [--wait-ms 3000]
 *
 *   # Solo sale test
 *   npx ts-node src/scripts/smoke-2-treatment-cascade.ts \
 *     --tenant bdq \
 *     --sale-test \
 *     --productId <uuid> \
 *     --purchaserSubjectId <uuid-registry-subject> \
 *     [--quantity 1] [--unit-price 25.00]
 *
 * PRE-REQUISITI cascata:
 *   - Treatment esistente con status=CLOSED, billingStatus=READY_FOR_BILLING.
 *     Per crearne uno fresco: chiusura standard via UI (o resettare un
 *     treatment chiuso a billingStatus=NOT_READY via SQL e farlo passare
 *     da setReadyForBilling iniziale).
 *   - Accounting consumer up + bind `treatment.*.<tenant>` su ex.clinical.events.
 *   - Migration 1784 (amendmentRevision) e 1785 (cancellation audit) applicate.
 *
 * VINCOLI:
 *   - A fine cascata il treatment finisce CANCELLED, NON riusabile per
 *     altri test successivi.
 *
 * EXIT CODES:
 *   0 = tutta la cascata OK (o sale OK con --sale-test)
 *   1 = uno step fallito (vedi log per dettagli)
 *   2 = errore di setup (DB/broker/OpenBao irraggiungibili)
 */
import 'reflect-metadata';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createOpenbaoService, OpenbaoBaseService } from '@curandis/openbao-core';

import { AppModule } from '../app.module';
import { TreatmentService } from '../modules/availability/services/treatment.service';
import { SaleService } from '../modules/sales/sale.service';
import { Treatment } from '../modules/availability/entities/treatment.entity';
import { TreatmentBillingStatus } from '../modules/availability/entities/treatment-billing-status.enum';
import { TenantSchemaContextService } from '../database/tenant-schema-context.service';
import { TenantOpenbaoResolverService } from '../database/tenant-openbao-resolver.service';
import { ClinicalEventBuffer } from '../modules/clinical-events/clinical-event-buffer.service';

// ============================================================================
// dotenv
// ============================================================================
const envFilePath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envFilePath });

// ============================================================================
// CLI parsing
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
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CascadeOpts {
  tenantAlias: string;
  treatmentId: string;
  waitMs: number;
}
interface SaleOpts {
  tenantAlias: string;
  productId: string;
  purchaserSubjectId: string;
  beneficiarySubjectId: string;
  quantity: number;
  unitPriceOverride?: number;
}

// ============================================================================
// Bootstrap credenziali DB (replica pattern main.ts)
// ============================================================================
async function bootstrapWithOpenbao(): Promise<{
  app: INestApplicationContext;
  openbaoService: OpenbaoBaseService;
}> {
  const isAgentMode = process.env.OPENBAO_AGENT_MODE === 'true';
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
  const mainDbCreds = result.credentials['main-db'];
  const openbaoService = result.service;

  const app = await NestFactory.createApplicationContext(
    AppModule.forRootAsync({
      mainDbCredentials: mainDbCreds,
      openbaoService,
    }),
    { logger: ['log', 'warn', 'error'] },
  );
  return { app, openbaoService };
}

// ============================================================================
// Cascade: setReady → amend → cancel
// ============================================================================
async function runCascade(
  app: INestApplicationContext,
  opts: CascadeOpts,
): Promise<void> {
  const treatmentService = app.get(TreatmentService);
  const dataSource = app.get(DataSource);
  const tenantContext = app.get(TenantSchemaContextService);
  const tenantResolver = app.get(TenantOpenbaoResolverService);
  const eventBuffer = app.get(ClinicalEventBuffer);

  // Risolvi schemaName del tenant (cli passa solo l'alias).
  const tenantInfo = await tenantResolver.resolveTenant(opts.tenantAlias);
  if (!tenantInfo) {
    throw new Error(`Tenant alias "${opts.tenantAlias}" non risolto in OpenBao.`);
  }
  const schemaName = tenantInfo.schemaName;

  // Wrappa entry-point CLI in TenantSchemaContext + ClinicalEventBuffer scope.
  // Nessuno dei 2 è settato da middleware HTTP qui (script CLI).
  await tenantContext.run(
    {
      schemaName,
      tenantId: opts.tenantAlias,
      tenantAlias: opts.tenantAlias,
      userId: 'system:smoke-2',
      // requestId UUID-format: lato accounting `audit_events.requestId` è
      // UUID NOT NULL, una stringa generica produrrebbe "invalid input
      // syntax for type uuid" (try/catch del consumer non blocca il
      // business, ma genera log rumorosi).
      requestId: randomUUID(),
    },
    async () => {
      await eventBuffer.runInScope(async () => {
        await runCascadeWithinScope(treatmentService, dataSource, opts, schemaName);
      });
    },
  );
}

async function runCascadeWithinScope(
  treatmentService: TreatmentService,
  dataSource: DataSource,
  opts: CascadeOpts,
  schemaName: string,
): Promise<void> {
  const log = (msg: string) =>
    console.log(`[smoke-2 ${new Date().toISOString()}] ${msg}`);

  // Pre-condizione: leggi treatment + billingStatus.
  const before = await fetchTreatment(dataSource, schemaName, opts.treatmentId);
  log(
    `Pre: treatmentId=${opts.treatmentId} status=${before.status} ` +
      `billingStatus=${before.billingStatus} amendmentRevision=${before.amendmentRevision}`,
  );
  if (before.billingStatus !== TreatmentBillingStatus.READY_FOR_BILLING) {
    throw new Error(
      `Pre-requisito violato: billingStatus deve essere READY_FOR_BILLING. ` +
        `Attuale: ${before.billingStatus}. Reset via SQL o usa un treatment fresco.`,
    );
  }

  // ── Step 1: setReadyForBilling([id], true) ─────────────────────────────
  log('Step 1: setTreatmentsReadyForBilling([id], true) → publish treatment.closed');
  await treatmentService.setReadyForBilling([opts.treatmentId], true);

  log(`Wait ${opts.waitMs}ms (round-trip billable.received)…`);
  await sleep(opts.waitMs);

  // ── Step 2: verify PENDING ──────────────────────────────────────────────
  const afterSetReady = await fetchTreatment(dataSource, schemaName, opts.treatmentId);
  log(`Post-setReady: billingStatus=${afterSetReady.billingStatus}`);
  if (afterSetReady.billingStatus !== TreatmentBillingStatus.PENDING) {
    throw new Error(
      `Round-trip fallito: atteso PENDING dopo billable.received, ricevuto ${afterSetReady.billingStatus}. ` +
        `Verifica accounting consumer up + bind queue + DLQ.`,
    );
  }
  log('✅ billingStatus = PENDING (round-trip billable.received OK)');

  // ── Step 3: updateBySecretary con amendmentReason ──────────────────────
  log('Step 3: updateBySecretary({id, amendmentReason}) → publish treatment.amended');
  await treatmentService.updateBySecretary({
    id: opts.treatmentId,
    amendmentReason: 'smoke #2 amend test',
  });

  log(`Wait ${opts.waitMs}ms…`);
  await sleep(opts.waitMs);

  // ── Step 4: verify amendmentRevision=1 ─────────────────────────────────
  const afterAmend = await fetchTreatment(dataSource, schemaName, opts.treatmentId);
  log(
    `Post-amend: amendmentRevision=${afterAmend.amendmentRevision} ` +
      `billingStatus=${afterAmend.billingStatus}`,
  );
  if (afterAmend.amendmentRevision !== 1) {
    throw new Error(
      `Atteso amendmentRevision=1, ricevuto ${afterAmend.amendmentRevision}.`,
    );
  }
  if (afterAmend.billingStatus !== TreatmentBillingStatus.PENDING) {
    throw new Error(
      `Atteso billingStatus PENDING invariato dopo amend, ricevuto ${afterAmend.billingStatus}.`,
    );
  }
  log('✅ amendmentRevision=1, billingStatus=PENDING (invariato)');

  // ── Step 5: cancelTreatment ────────────────────────────────────────────
  log('Step 5: cancelTreatment(id, reason) → publish treatment.cancelled');
  // cancelTreatment richiede un AppUser.id locale: passo un valore "system"
  // di test. NON è un AppUser reale del DB → il `cancelledByUserId` salvato
  // sul DB sarà un UUID inesistente in app_users; il `cancelledByUserId`
  // del payload risolverà a null (batch lookup non trova nulla).
  // Per test cleaner, pre-popola un AppUser di test e passa il suo id.
  const systemAppUserId = 'c4025df7-d691-4bab-9a0b-0fef224125e3'; // marco AppUser
  await treatmentService.cancelTreatment(
    opts.treatmentId,
    systemAppUserId,
    'smoke #2 cancel test',
  );

  log(`Wait ${opts.waitMs}ms…`);
  await sleep(opts.waitMs);

  // ── Step 6: verify CANCELLED ───────────────────────────────────────────
  const afterCancel = await fetchTreatment(dataSource, schemaName, opts.treatmentId);
  log(
    `Post-cancel: billingStatus=${afterCancel.billingStatus} ` +
      `cancelledAt=${afterCancel.cancelledAt} ` +
      `cancellationReason="${afterCancel.cancellationReason}"`,
  );
  if (afterCancel.billingStatus !== TreatmentBillingStatus.CANCELLED) {
    throw new Error(
      `Atteso billingStatus CANCELLED, ricevuto ${afterCancel.billingStatus}.`,
    );
  }
  log('✅ billingStatus=CANCELLED');

  log('🎉 Cascata completata con successo. Verifica accounting:');
  log('   - BillableEvent dovrebbe essere in stato CANCELLED');
  log('   - log accounting consumer dovrebbe mostrare 3 eventi consumati');
}

async function fetchTreatment(
  dataSource: DataSource,
  schemaName: string,
  treatmentId: string,
): Promise<Treatment> {
  // Query diretta via dataSource per non dipendere da TenantSchemaSubscriber
  // sul flow di lettura dello smoke (il subscriber funziona, ma evitiamo
  // dipendenze incrociate sui log scope).
  await dataSource.query(`SET search_path TO "${schemaName}"`);
  const rows = await dataSource.query(
    `SELECT id, status, "billingStatus", "amendmentRevision",
            "cancelledAt", "cancelledByUserId", "cancellationReason",
            "isInvoicedToPatient", "patientInvoiceNumber"
       FROM "treatments"
       WHERE id = $1
       LIMIT 1`,
    [treatmentId],
  );
  if (!rows || rows.length === 0) {
    throw new Error(`Treatment ${treatmentId} non trovato in schema ${schemaName}`);
  }
  return rows[0] as Treatment;
}

// ============================================================================
// Sale test
// ============================================================================
async function runSaleTest(
  app: INestApplicationContext,
  opts: SaleOpts,
): Promise<void> {
  const saleService = app.get(SaleService);
  const tenantContext = app.get(TenantSchemaContextService);
  const tenantResolver = app.get(TenantOpenbaoResolverService);
  const eventBuffer = app.get(ClinicalEventBuffer);

  const tenantInfo = await tenantResolver.resolveTenant(opts.tenantAlias);
  if (!tenantInfo) {
    throw new Error(`Tenant alias "${opts.tenantAlias}" non risolto in OpenBao.`);
  }
  const schemaName = tenantInfo.schemaName;

  await tenantContext.run(
    {
      schemaName,
      tenantId: opts.tenantAlias,
      tenantAlias: opts.tenantAlias,
      userId: 'system:smoke-2',
      requestId: randomUUID(),
    },
    async () => {
      await eventBuffer.runInScope(async () => {
        const log = (msg: string) =>
          console.log(`[smoke-2-sale ${new Date().toISOString()}] ${msg}`);

        log(
          `recordProductSale productId=${opts.productId} qty=${opts.quantity} ` +
            `unitPriceOverride=${opts.unitPriceOverride ?? '<default>'}`,
        );
        // Per coerenza, usiamo lo stesso AppUser "marco" (servirebbe per
        // soldByUserId payload). Lo script CLI non passa per CurrentUser
        // del resolver, chiamiamo direttamente il service.
        const systemAppUserId = 'c4025df7-d691-4bab-9a0b-0fef224125e3';
        const result = await saleService.recordProductSale(
          {
            purchaserSubjectId: opts.purchaserSubjectId,
            beneficiarySubjectId: opts.beneficiarySubjectId,
            lines: [
              {
                productId: opts.productId,
                quantity: opts.quantity,
                unitPriceOverride: opts.unitPriceOverride,
              },
            ],
            isPaid: true,
            paymentMethod: undefined as any,
            requestImmediateInvoice: true,
            notes: 'smoke #2 sale test',
          },
          systemAppUserId,
        );
        log(
          `✅ Sale pubblicata: saleId=${result.saleId} totalAmount=${result.totalAmount}`,
        );
        log('Verifica accounting: BillableEvent type=SALE creato in PENDING');
      });
    },
  );
}

// ============================================================================
// Main
// ============================================================================
async function main(): Promise<void> {
  const tenantAlias = parseArg('tenant', 'bdq')!;
  const isSaleTest = parseFlag('sale-test');

  console.log('\n=== Smoke #2 — End-to-end ' +
    (isSaleTest ? 'SALE' : 'TREATMENT CASCADE') + ' ===\n');

  let app: INestApplicationContext | undefined;
  try {
    const bootstrap = await bootstrapWithOpenbao();
    app = bootstrap.app;

    // Aspetta il setup del canale RabbitMQ del publisher (vedi pattern smoke #1).
    await sleep(2000);

    if (isSaleTest) {
      const productId = parseArg('productId');
      const purchaserSubjectId = parseArg('purchaserSubjectId');
      const beneficiarySubjectId = parseArg('beneficiarySubjectId') ?? purchaserSubjectId;
      const quantityStr = parseArg('quantity', '1');
      const unitPriceStr = parseArg('unit-price');
      if (!productId || !purchaserSubjectId) {
        console.error(
          'Errore: --sale-test richiede --productId <uuid> e --purchaserSubjectId <uuid>.',
        );
        process.exit(2);
      }
      await runSaleTest(app, {
        tenantAlias,
        productId,
        purchaserSubjectId,
        beneficiarySubjectId: beneficiarySubjectId!,
        quantity: parseFloat(quantityStr!),
        unitPriceOverride: unitPriceStr ? parseFloat(unitPriceStr) : undefined,
      });
    } else {
      const treatmentId = parseArg('treatmentId');
      const waitMs = parseInt(parseArg('wait-ms', '3000')!, 10);
      if (!treatmentId) {
        console.error('Errore: --treatmentId <uuid> richiesto per la cascata.');
        process.exit(2);
      }
      await runCascade(app, { tenantAlias, treatmentId, waitMs });
    }

    await app.close();
    process.exit(0);
  } catch (err) {
    console.error('\n[FAIL]', err);
    if (app) {
      try { await app.close(); } catch { /* ignore */ }
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Errore inatteso:', err);
  process.exit(2);
});

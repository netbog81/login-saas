/**
 * Smoke test del publisher clinico → accounting.
 *
 * Pubblica UN evento `treatment.closed` con payload statico realistico
 * sull'exchange `ex.clinical.events`, routing key `treatment.closed.<tenant>`.
 *
 * NON dipende da DB (OpenBao + Postgres): bootstrappa solo
 * `ClinicalEventsConfig` + `ClinicalEventPublisher` in un Nest standalone
 * minimale (NestFactory.createApplicationContext + NoopTenantContext).
 *
 * USO:
 *   cd backend
 *   npx ts-node src/scripts/test-publish-treatment-closed.ts \
 *     --tenant bdq \
 *     --treatmentId 11111111-1111-1111-1111-111111111111 \
 *     --beneficiarySubjectId 22222222-2222-2222-2222-222222222222 \
 *     [--immediate]
 *
 * VARIANTI:
 *   --immediate              => requestImmediateInvoice=true (caso "Fattura+incassa")
 *   --tenant <alias>         => default 'bdq'
 *   --treatmentId <uuid>     => default UUID fisso di test
 *   --beneficiarySubjectId   => default UUID fisso di test
 *
 * EXIT CODES:
 *   0 = publish OK (ack del broker ricevuto)
 *   1 = publish fallito o broker irraggiungibile
 *
 * VERIFICA POST-RUN:
 *   1) RabbitMQ Management UI (localhost:5680?) → exchange `ex.clinical.events`
 *      → "Publishes/sec" deve aver registrato 1 spike.
 *   2) Se accounting consumer è up: log accounting deve mostrare consume
 *      + creazione BillableEvent in stato PENDING.
 *   3) Round-trip completo: dopo pochi secondi accounting pubblica
 *      `billable.received.bdq` su `ex.accounting.events`. Per testare il
 *      consume lato clinico serve avviare l'app full (`npm run start:dev`).
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as dotenv from 'dotenv';

import { ClinicalEventsConfig } from '../modules/clinical-events/clinical-events.config';
import { ClinicalEventPublisher } from '../modules/clinical-events/clinical-event.publisher';
import { TreatmentClosedPayload } from '../modules/clinical-events/clinical-events.types';
// TODO containerization-2026-06-11: script CLI escluso dal build (tsconfig.json:exclude).
// Migrare a TenantContextService di @curandis/tenant-datasource prima di rieseguirlo.
import { TenantSchemaContextService } from '../database/tenant-schema-context.service';

// ============================================================================
// Bootstrap dotenv (script CLI: nessuno carica .env per noi)
// ============================================================================
// __dirname = backend/src/scripts in dev (ts-node) → backend/.env è 2 livelli su.
const envFilePath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envFilePath });

// ============================================================================
// CLI args parser (no dependencies)
// ============================================================================
function parseArg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith('--')) {
    if (fallback !== undefined) return fallback;
    return ''; // flag senza valore (es. --immediate)
  }
  return value;
}
function parseFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

// ============================================================================
// Modulo NestJS minimale: solo publisher, niente DB.
// ============================================================================
// Uso un override del TenantSchemaContextService che NON viene mai consultato
// (passiamo tenantAlias esplicito al publish). Resta come dependency stub
// perché ClinicalEventPublisher lo inietta nel constructor.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [
    ClinicalEventsConfig,
    TenantSchemaContextService,
    ClinicalEventPublisher,
  ],
})
class SmokeTestModule {}

// ============================================================================
// Main
// ============================================================================
async function main(): Promise<void> {
  console.log('\n=== Smoke test ClinicalEventPublisher ===\n');

  const tenantAlias = parseArg('tenant', 'bdq')!;
  const treatmentId = parseArg('treatmentId', '11111111-1111-1111-1111-111111111111')!;
  const beneficiarySubjectId = parseArg(
    'beneficiarySubjectId',
    '22222222-2222-2222-2222-222222222222',
  )!;
  const serviceId = parseArg('serviceId', '44444444-4444-4444-4444-444444444444')!;
  const serviceCode = parseArg('serviceCode', 'TMP-44444444')!;
  const immediate = parseFlag('immediate');
  const noCustomLine = parseFlag('no-custom');

  console.log('Parametri:');
  console.log(`  tenant                  = ${tenantAlias}`);
  console.log(`  treatmentId             = ${treatmentId}`);
  console.log(`  beneficiarySubjectId    = ${beneficiarySubjectId}`);
  console.log(`  serviceId               = ${serviceId}`);
  console.log(`  serviceCode             = ${serviceCode}`);
  console.log(`  requestImmediateInvoice = ${immediate}`);
  console.log(`  no-custom-line          = ${noCustomLine}`);
  console.log('');

  const app = await NestFactory.createApplicationContext(SmokeTestModule, {
    logger: ['log', 'warn', 'error', 'debug'],
  });

  try {
    const publisher = app.get(ClinicalEventPublisher);

    // Aspetta qualche istante per consentire il setup del canale (assertExchange).
    // amqp-connection-manager fa il setup nel background; senza questa attesa
    // la publish potrebbe partire prima che l'exchange sia confermato.
    await sleep(1500);

    if (!publisher.isReady()) {
      console.warn(
        '[WARN] publisher.isReady()=false: il broker potrebbe non essere ' +
          'ancora pronto. Provo lo stesso a publish.',
      );
    }

    const correlationId = randomUUID();
    const now = new Date();
    const executionDate = now.toISOString().slice(0, 10); // YYYY-MM-DD

    const payload: TreatmentClosedPayload = {
      treatmentId,
      siteId: '00000000-0000-0000-0000-000000000001', // placeholder smoke
      beneficiarySubjectId,
      executionDate,
      closedAt: now.toISOString(),
      closedByUserId: 'kc-smoke-secretary-sub', // placeholder Keycloak sub
      forcedClosure: false,
      lines: [
        {
          lineId: '33333333-3333-3333-3333-333333333333',
          lineType: 'SERVICE',
          serviceId,
          serviceCode,
          executedByUserId: 'kc-smoke-operator-sub',
          professionalRegistration: 'Albo FT n. 12345',
          macroCategory: 'PHYSIOTHERAPIST',
          quantity: '1',
          duration: 60,
          finalUnitPrice: '55.00',
          isCustomPrice: false,
          invoiceLineDescription: 'Seduta fisioterapica del ' + executionDate,
          diagnosis: 'M54.5',
          icdCode: 'M54.5',
          externalDoctorName: null,
          externalPrescriptionRef: null,
        },
        ...(noCustomLine
          ? []
          : [
              {
                lineId: '55555555-5555-5555-5555-555555555555',
                lineType: 'CUSTOM' as const,
                description: 'Crema medicale (extra)',
                amount: '12.00',
                quantity: '1',
                createdByUserId: 'kc-smoke-secretary-sub',
              },
            ]),
      ],
      totalAmount: '67.00',
      payment: {
        isPaid: true,
        paidAt: now.toISOString(),
        paymentMethod: 'CARD',
        amount: '67.00',
        collectedByUserId: 'kc-smoke-secretary-sub',
      },
      requestImmediateInvoice: immediate,
      notes: {
        secretary: 'Smoke test publisher → accounting',
        operator: null,
        patient: null,
      },
    };

    console.log('Publishing treatment.closed con correlationId=' + correlationId + '...');
    await publisher.publish({
      eventType: 'treatment.closed',
      tenantAlias,
      correlationId,
      payload,
    });
    console.log('[OK] publish completato (ack broker ricevuto).');
    console.log('');
    console.log('Verifica side accounting:');
    console.log('  - Logs accounting dovrebbero mostrare consume di treatment.closed.' + tenantAlias);
    console.log('  - DB accounting: BillableEvent nuovo in stato PENDING per treatmentId=' + treatmentId);
    console.log('  - Round-trip: accounting pubblicherà billable.received.' + tenantAlias);
    console.log('    (per consumarlo serve `npm run start:dev` lato clinico)');
    console.log('');

    await app.close();
    process.exit(0);
  } catch (err) {
    console.error('\n[FAIL] publish smoke fallito:');
    console.error(err);
    try {
      await app.close();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('Errore inatteso:', err);
  process.exit(1);
});

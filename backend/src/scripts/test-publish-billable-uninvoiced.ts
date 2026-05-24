/**
 * Smoke test: simula accounting che pubblica `billable.uninvoiced` su
 * `ex.accounting.events`, per verificare che il consumer clinico
 * (`AccountingEventConsumer`) gestisca correttamente il nuovo eventType:
 *   1) bind della routing key `billable.uninvoiced.<tenant>` attivo
 *   2) handler dispatch corretto
 *   3) Treatment riportato a billingStatus=PENDING + campi accounting* azzerati
 *
 * Lo script NON dipende da DB né da NestJS: apre un canale amqp diretto verso
 * lo stesso broker usato da clinico/accounting (RABBITMQ_URL da .env) e fa
 * publish raw del payload. Mima l'envelope `CurandisEvent` usato dal publisher
 * accounting reale.
 *
 * USO:
 *   cd backend
 *   npx ts-node src/scripts/test-publish-billable-uninvoiced.ts \
 *     --tenant bdq \
 *     --treatmentId <uuid-di-un-treatment-in-INVOICED>
 *
 * PRE-REQUISITO:
 *   Il treatment passato deve essere in billingStatus=INVOICED (cioè con
 *   accountingInvoiceUrl/IssuedAt, patientInvoiceNumber, ecc. valorizzati).
 *   Tipicamente: chiudilo con `smoke:2-cascade` + attendi che accounting
 *   risponda `billable.invoiced`, poi lancia questo per simulare il cancel
 *   pre-trasmissione.
 *
 * VERIFICA POST-RUN:
 *   - Logs clinico devono mostrare consume `billable.uninvoiced.<tenant>` +
 *     UPDATE treatment.
 *   - Query DB:
 *       SELECT id, "billingStatus", "patientInvoiceNumber",
 *              "accountingInvoiceUrl", "isInvoicedToPatient"
 *       FROM "t_<schema>".treatments WHERE id = '<treatmentId>';
 *     deve mostrare billingStatus='PENDING', patientInvoiceNumber=NULL,
 *     accountingInvoiceUrl=NULL, isInvoicedToPatient=false.
 *
 * EXIT CODES:
 *   0 = publish OK (ack del broker ricevuto)
 *   1 = publish fallito o broker irraggiungibile
 */
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as amqp from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';

const envFilePath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envFilePath });

function parseArg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith('--')) return fallback;
  return value;
}

async function main(): Promise<void> {
  console.log('\n=== Smoke test billable.uninvoiced (accounting → clinico) ===\n');

  const tenantAlias = parseArg('tenant', 'bdq')!;
  const treatmentId = parseArg('treatmentId');
  const billableEventId = parseArg('billableEventId', randomUUID())!;
  const exchange = process.env.RABBITMQ_ACCOUNTING_EXCHANGE ?? 'ex.accounting.events';
  const url = process.env.RABBITMQ_URL;

  if (!url) {
    console.error('[FAIL] RABBITMQ_URL non definita nel .env');
    process.exit(1);
  }
  if (!treatmentId) {
    console.error('[FAIL] --treatmentId obbligatorio (UUID di un treatment in INVOICED)');
    process.exit(1);
  }

  const routingKey = `billable.uninvoiced.${tenantAlias}`;
  const eventId = randomUUID();
  const occurredAt = new Date().toISOString();

  const envelope = {
    schemaVersion: '1.0' as const,
    eventId,
    occurredAt,
    eventType: 'billable.uninvoiced' as const,
    tenantAlias,
    correlationId: randomUUID(),
    producerVersion: 'smoke-test-1.0.0',
    payload: {
      billableEventId,
      treatmentId,
      cancelledDocumentId: randomUUID(),
      cancelledDocumentNumber: 'I2026-99999',
      cancelledDocumentType: 'INVOICE' as const,
      uninvoicedAt: occurredAt,
      reason: 'invoice_cancelled_pre_transmission',
    },
  };

  console.log('Parametri:');
  console.log(`  url        = ${url.replace(/\/\/.*@/, '//***@')}`);
  console.log(`  exchange   = ${exchange}`);
  console.log(`  routingKey = ${routingKey}`);
  console.log(`  eventId    = ${eventId}`);
  console.log(`  treatmentId= ${treatmentId}`);
  console.log('');

  const connection = amqp.connect([url]);
  const channelWrapper = connection.createChannel({
    json: false,
    setup: async (channel: ConfirmChannel) => {
      // Exchange READ-only per clinico ma siamo "accounting" qui: assertExchange
      // come topic durable (idempotente se già esistente con stessi parametri).
      await channel.assertExchange(exchange, 'topic', { durable: true });
    },
  });

  try {
    await channelWrapper.waitForConnect();
    console.log('[OK] connesso al broker');

    const buffer = Buffer.from(JSON.stringify(envelope), 'utf8');
    await channelWrapper.publish(exchange, routingKey, buffer, {
      contentType: 'application/json',
      persistent: true,
      messageId: eventId,
      timestamp: Date.now(),
    });

    console.log(`[OK] publish completato su ${exchange}/${routingKey}`);
    console.log('');
    console.log('Verifica lato clinico (backend in start:dev):');
    console.log(`  - Log: consume eventType=billable.uninvoiced id=${eventId}`);
    console.log(`  - DB: treatment ${treatmentId} → billingStatus=PENDING, campi accounting* azzerati`);
    console.log('');

    await channelWrapper.close();
    await connection.close();
    process.exit(0);
  } catch (err) {
    console.error('\n[FAIL] publish smoke fallito:');
    console.error(err);
    try {
      await channelWrapper.close();
      await connection.close();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Errore inatteso:', err);
  process.exit(1);
});

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Step 1 dell'integrazione clinico ↔ accounting (RabbitMQ event-driven).
 *
 * SCOPE: tenant target = `bdq` (schema `t_4701c4aaba73713294696ae7ae46d21b`).
 *
 * Nel DB clinico esistono ANCHE altri schemi (`tenant_demo4`, `tt_4701original`)
 * che NON devono ricevere questa migration: il primo è scaffolding di test
 * residuale, il secondo è uno snapshot storico. Il run-tenant-migration.ts
 * (che accetta lo schema target come argv) garantisce questo: lanciare con
 *   npx ts-node src/run-tenant-migration.ts t_4701c4aaba73713294696ae7ae46d21b
 *
 * NON usare `run-all-tenant-migrations.ts` perché toccherebbe anche gli
 * schemi non-target (la sua regex `t\_%` matcha sia `t_47010...` sia
 * eventuali schemi futuri con prefisso `t_`).
 *
 * Una guard di sicurezza in cima alla up() blocca esplicitamente l'esecuzione
 * fuori da `t_4701c4aaba73713294696ae7ae46d21b` o `public` (dev).
 *
 * Contenuto:
 *   1. CREATE TABLE sites + seed "Studio principale" (1 INSERT idempotente).
 *   2. ALTER TABLE treatments + availability_appointments → siteId (NOT NULL,
 *      FK sites, backfill con sede default).
 *   3. ALTER TABLE services → serviceCode varchar(30) UNIQUE NOT NULL
 *      (backfill con `TMP-<id8>` per i 17 servizi esistenti su bdq).
 *   4. CREATE TABLE products.
 *   5. ALTER TABLE treatment_services → executedByOperatorId uuid nullable
 *      (FK app_users; backfill da treatments.operator.appUserId — 2 righe
 *      su bdq).
 *   6. ALTER TABLE treatments → billingStatus enum (default NOT_READY,
 *      backfill INVOICED/READY_FOR_BILLING/NOT_READY) + 7 colonne
 *      `accounting*` + 3 colonne `billingAlert*`.
 *   7. CREATE TABLE processed_clinical_events (idempotency consumer
 *      ex.accounting.events).
 *
 * IMPATTO PRESTAZIONALE: ms su bdq (volumi: 1 treatment, 2 treatment_services,
 * 9 availability_appointments, 17 services). Migration applicabile hot.
 *
 * down(): reversibile in dev. In prod usare solo dopo dump pg_dump.
 */
export class BillingIntegrationStep11783000000000 implements MigrationInterface {
  name = 'BillingIntegrationStep11783000000000';

  /** Schema su cui questa migration è autorizzata a girare (oltre a `public`). */
  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== BillingIntegrationStep11783000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `BillingIntegrationStep1: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${BillingIntegrationStep11783000000000.TARGET_SCHEMA}", "public". ` +
          `Tenant target = bdq. Per altri schemi (test/backup) la migration NON va applicata.`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    // ========================================================================
    // 1. sites + seed "Studio principale"
    // ========================================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "address" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Seed idempotente: inserisci solo se la tabella è vuota.
    await queryRunner.query(`
      INSERT INTO "sites" ("name", "address", "isActive")
      SELECT 'Studio principale', NULL, true
      WHERE NOT EXISTS (SELECT 1 FROM "sites")
    `);

    // ========================================================================
    // 2. treatments.siteId + availability_appointments.siteId
    // ========================================================================
    await queryRunner.query(`ALTER TABLE "treatments" ADD COLUMN IF NOT EXISTS "siteId" uuid`);
    await queryRunner.query(`ALTER TABLE "availability_appointments" ADD COLUMN IF NOT EXISTS "siteId" uuid`);

    // Backfill atomico con la sede default (l'unica appena creata).
    await queryRunner.query(`
      DO $$
      DECLARE
        default_site_id uuid;
      BEGIN
        SELECT id INTO default_site_id
          FROM "sites"
          WHERE "isActive" = true
          ORDER BY "createdAt" ASC
          LIMIT 1;

        IF default_site_id IS NULL THEN
          RAISE EXCEPTION 'Bootstrap fallito: nessuna sede attiva trovata in sites';
        END IF;

        UPDATE "treatments" SET "siteId" = default_site_id WHERE "siteId" IS NULL;
        UPDATE "availability_appointments" SET "siteId" = default_site_id WHERE "siteId" IS NULL;
      END $$;
    `);

    // FK + NOT NULL DOPO il backfill (ordine critico).
    await queryRunner.query(`ALTER TABLE "treatments" ALTER COLUMN "siteId" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD CONSTRAINT "FK_treatments_site"
        FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`CREATE INDEX "IDX_treatments_site" ON "treatments" ("siteId")`);

    await queryRunner.query(`ALTER TABLE "availability_appointments" ALTER COLUMN "siteId" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "availability_appointments"
      ADD CONSTRAINT "FK_availability_appointments_site"
        FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_availability_appointments_site" ON "availability_appointments" ("siteId")`,
    );

    // ========================================================================
    // 3. services.serviceCode (TMP-xxx → NOT NULL → UNIQUE)
    // ========================================================================
    await queryRunner.query(`ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "serviceCode" varchar(30)`);
    await queryRunner.query(`
      UPDATE "services"
      SET "serviceCode" = 'TMP-' || substring(id::text, 1, 8)
      WHERE "serviceCode" IS NULL
    `);
    await queryRunner.query(`ALTER TABLE "services" ALTER COLUMN "serviceCode" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "services"
      ADD CONSTRAINT "UQ_services_serviceCode" UNIQUE ("serviceCode")
    `);

    // ========================================================================
    // 4. products
    // ========================================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "productCode" varchar(30) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "defaultPrice" numeric(10,2) NOT NULL,
        "category" varchar(50),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdByUserId" uuid,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_products_code" ON "products" ("productCode")`);
    await queryRunner.query(`CREATE INDEX "IDX_products_is_active" ON "products" ("isActive")`);

    // ========================================================================
    // 5. treatment_services.executedByOperatorId (FK app_users; backfill JOIN)
    // ========================================================================
    await queryRunner.query(`
      ALTER TABLE "treatment_services"
      ADD COLUMN IF NOT EXISTS "executedByOperatorId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "treatment_services"
      ADD CONSTRAINT "FK_treatment_services_executed_by_operator"
        FOREIGN KEY ("executedByOperatorId") REFERENCES "app_users"("id") ON DELETE SET NULL
    `);

    // Backfill: app_users.id dell'operatore del trattamento.
    // Le righe dove operator è hard-deleted o senza app_user collegato
    // restano NULL (campo nullable by design).
    await queryRunner.query(`
      UPDATE "treatment_services" ts
      SET "executedByOperatorId" = o."app_user_id"
      FROM "treatments" t
      JOIN "operators" o ON o.id = t."operatorId"
      WHERE ts."treatmentId" = t.id
        AND ts."executedByOperatorId" IS NULL
        AND o."app_user_id" IS NOT NULL
    `);

    // Diagnostico: count righe NULL post-backfill.
    await queryRunner.query(`
      DO $$
      DECLARE
        null_count int;
        total_count int;
      BEGIN
        SELECT COUNT(*) INTO total_count FROM "treatment_services";
        SELECT COUNT(*) INTO null_count
          FROM "treatment_services"
          WHERE "executedByOperatorId" IS NULL;
        RAISE NOTICE 'treatment_services: % righe totali, % senza executedByOperatorId (operator hard-deleted o senza app_user)',
          total_count, null_count;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_treatment_services_executed_by"
        ON "treatment_services" ("executedByOperatorId")
    `);

    // ========================================================================
    // 6. treatments: billingStatus enum + 7 col accounting + 3 col alert
    // ========================================================================
    await queryRunner.query(`
      CREATE TYPE "treatment_billing_status_enum" AS ENUM (
        'NOT_READY',
        'READY_FOR_BILLING',
        'SENT',
        'PENDING',
        'INVOICED',
        'PARTIALLY_REFUNDED',
        'REFUNDED',
        'REISSUED',
        'CANCELLED'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD COLUMN "billingStatus" "treatment_billing_status_enum" NOT NULL DEFAULT 'NOT_READY'
    `);

    // Backfill billingStatus sui trattamenti storici.
    await queryRunner.query(`
      UPDATE "treatments"
      SET "billingStatus" =
        CASE
          WHEN "isInvoicedToPatient" = true                               THEN 'INVOICED'::"treatment_billing_status_enum"
          WHEN "readyForBilling" = true AND "isInvoicedToPatient" = false THEN 'READY_FOR_BILLING'::"treatment_billing_status_enum"
          ELSE 'NOT_READY'::"treatment_billing_status_enum"
        END
    `);

    await queryRunner.query(`CREATE INDEX "IDX_treatments_billing_status" ON "treatments" ("billingStatus")`);

    // 7 colonne accounting
    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD COLUMN "accountingBillableEventId"     uuid,
      ADD COLUMN "accountingInvoiceUrl"          text,
      ADD COLUMN "accountingInvoiceIssuedAt"     timestamptz,
      ADD COLUMN "accountingDocumentType"        varchar(30),
      ADD COLUMN "accountingCreditNoteNumber"    varchar(50),
      ADD COLUMN "accountingCreditNoteIssuedAt"  timestamptz,
      ADD COLUMN "accountingRefundReason"        text
    `);

    // 3 colonne alert (per billable.cancellation-rejected)
    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD COLUMN "billingAlertMessage"           text,
      ADD COLUMN "billingAlertAt"                timestamptz,
      ADD COLUMN "billingAlertDismissedAt"       timestamptz
    `);

    // ========================================================================
    // 7. processed_clinical_events (idempotency consumer accounting → clinico)
    // ========================================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "processed_clinical_events" (
        "eventId"         uuid PRIMARY KEY,
        "eventType"       varchar(100) NOT NULL,
        "tenantAlias"     varchar(50) NOT NULL,
        "treatmentId"     uuid,
        "billableEventId" uuid,
        "processedAt"     timestamptz NOT NULL DEFAULT now(),
        "resultSummary"   jsonb
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_pce_processed_at" ON "processed_clinical_events" ("processedAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pce_treatment" ON "processed_clinical_events" ("treatmentId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== BillingIntegrationStep11783000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `BillingIntegrationStep1.down: rifiuto di girare sullo schema "${currentSchema}".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    // ATTENZIONE: distruttivo. Droppa colonne con dati accumulati post-up
    // (billingStatus reali, alert ricevuti). Solo dev/staging.

    await queryRunner.query(`DROP TABLE IF EXISTS "processed_clinical_events"`);

    await queryRunner.query(`
      ALTER TABLE "treatments"
      DROP COLUMN IF EXISTS "billingAlertDismissedAt",
      DROP COLUMN IF EXISTS "billingAlertAt",
      DROP COLUMN IF EXISTS "billingAlertMessage",
      DROP COLUMN IF EXISTS "accountingRefundReason",
      DROP COLUMN IF EXISTS "accountingCreditNoteIssuedAt",
      DROP COLUMN IF EXISTS "accountingCreditNoteNumber",
      DROP COLUMN IF EXISTS "accountingDocumentType",
      DROP COLUMN IF EXISTS "accountingInvoiceIssuedAt",
      DROP COLUMN IF EXISTS "accountingInvoiceUrl",
      DROP COLUMN IF EXISTS "accountingBillableEventId"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_treatments_billing_status"`);
    await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN IF EXISTS "billingStatus"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "treatment_billing_status_enum"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_treatment_services_executed_by"`);
    await queryRunner.query(
      `ALTER TABLE "treatment_services" DROP CONSTRAINT IF EXISTS "FK_treatment_services_executed_by_operator"`,
    );
    await queryRunner.query(`ALTER TABLE "treatment_services" DROP COLUMN IF EXISTS "executedByOperatorId"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_is_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_code"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);

    await queryRunner.query(
      `ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "UQ_services_serviceCode"`,
    );
    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN IF EXISTS "serviceCode"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_availability_appointments_site"`);
    await queryRunner.query(
      `ALTER TABLE "availability_appointments" DROP CONSTRAINT IF EXISTS "FK_availability_appointments_site"`,
    );
    await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN IF EXISTS "siteId"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_treatments_site"`);
    await queryRunner.query(
      `ALTER TABLE "treatments" DROP CONSTRAINT IF EXISTS "FK_treatments_site"`,
    );
    await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN IF EXISTS "siteId"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "sites"`);
  }
}

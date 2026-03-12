import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea le tabelle per l'integrazione WhatsApp Gateway:
 * - whatsapp_tenant_config: configurazione gateway per-tenant
 * - whatsapp_message_templates: template messaggi personalizzabili
 * - whatsapp_message_logs: log messaggi con tracking stato
 * - whatsapp_webhook_events: eventi raw Evolution API per audit
 */
export class CreateWhatsappSystem1773000000000 implements MigrationInterface {
  name = 'CreateWhatsappSystem1773000000000';

  private async tableExists(qr: QueryRunner, tableName: string): Promise<boolean> {
    const result = await qr.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = $1
        AND table_schema = current_schema()
      ) as "exists"`,
      [tableName],
    );
    return result[0]?.exists === true;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Creating WhatsApp system tables...');

    // 1. Enum whatsapp_message_status_enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "whatsapp_message_status_enum" AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('  1/8 whatsapp_message_status_enum created');

    // 2. Enum whatsapp_message_type_enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "whatsapp_message_type_enum" AS ENUM ('recap_single', 'recap_multi', 'reminder_24h', 'cancellation');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('  2/8 whatsapp_message_type_enum created');

    // 3. Enum whatsapp_template_type_enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "whatsapp_template_type_enum" AS ENUM ('RECAP_SINGLE', 'RECAP_MULTI', 'REMINDER_24H');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('  3/8 whatsapp_template_type_enum created');

    // 4. Tabella whatsapp_tenant_config
    if (!(await this.tableExists(queryRunner, 'whatsapp_tenant_config'))) {
      await queryRunner.query(`
        CREATE TABLE "whatsapp_tenant_config" (
          "id" uuid NOT NULL DEFAULT gen_random_uuid(),
          "gatewayUrl" varchar(500) NOT NULL,
          "apiKeyEncrypted" text NOT NULL,
          "webhookSecretEncrypted" text,
          "tenantApiId" varchar(255) NOT NULL,
          "isActive" boolean NOT NULL DEFAULT false,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "PK_whatsapp_tenant_config" PRIMARY KEY ("id")
        )
      `);
    }
    console.log('  4/8 whatsapp_tenant_config table created');

    // 5. Tabella whatsapp_message_templates
    if (!(await this.tableExists(queryRunner, 'whatsapp_message_templates'))) {
      await queryRunner.query(`
        CREATE TABLE "whatsapp_message_templates" (
          "id" uuid NOT NULL DEFAULT gen_random_uuid(),
          "templateType" "whatsapp_template_type_enum" NOT NULL,
          "bodyTemplate" text NOT NULL,
          "footerTemplate" text,
          "isActive" boolean NOT NULL DEFAULT true,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "PK_whatsapp_message_templates" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_whatsapp_message_templates_type" UNIQUE ("templateType")
        )
      `);

      // Seed template di default
      await queryRunner.query(`
        INSERT INTO "whatsapp_message_templates" ("templateType", "bodyTemplate", "isActive")
        VALUES
          ('RECAP_SINGLE', 'Gentile {name}, confermiamo il suo appuntamento per il {date} alle {time}.', true),
          ('RECAP_MULTI', 'Gentile {name}, confermiamo i seguenti appuntamenti:\n{appointments}', true),
          ('REMINDER_24H', 'Promemoria: il suo appuntamento è domani alle {time}.', true)
        ON CONFLICT ("templateType") DO NOTHING
      `);
    }
    console.log('  5/8 whatsapp_message_templates table created with defaults');

    // 6. Tabella whatsapp_message_logs
    if (!(await this.tableExists(queryRunner, 'whatsapp_message_logs'))) {
      await queryRunner.query(`
        CREATE TABLE "whatsapp_message_logs" (
          "id" uuid NOT NULL DEFAULT gen_random_uuid(),
          "appointmentId" uuid,
          "patientId" uuid,
          "patientName" varchar(255),
          "phoneNumber" varchar(50) NOT NULL,
          "messageType" "whatsapp_message_type_enum" NOT NULL,
          "status" "whatsapp_message_status_enum" NOT NULL DEFAULT 'pending',
          "correlationId" uuid NOT NULL,
          "evolutionMessageId" varchar(255),
          "messageBody" text,
          "errorMessage" text,
          "sentAt" timestamptz,
          "deliveredAt" timestamptz,
          "readAt" timestamptz,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "PK_whatsapp_message_logs" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_whatsapp_message_logs_status" ON "whatsapp_message_logs" ("status")`);
      await queryRunner.query(`CREATE INDEX "IDX_whatsapp_message_logs_appointment" ON "whatsapp_message_logs" ("appointmentId")`);
      await queryRunner.query(`CREATE INDEX "IDX_whatsapp_message_logs_correlation" ON "whatsapp_message_logs" ("correlationId")`);
      await queryRunner.query(`CREATE INDEX "IDX_whatsapp_message_logs_patient" ON "whatsapp_message_logs" ("patientId")`);
      await queryRunner.query(`CREATE INDEX "IDX_whatsapp_message_logs_created" ON "whatsapp_message_logs" ("createdAt")`);
    }
    console.log('  6/8 whatsapp_message_logs table created');

    // 7. Tabella whatsapp_webhook_events
    if (!(await this.tableExists(queryRunner, 'whatsapp_webhook_events'))) {
      await queryRunner.query(`
        CREATE TABLE "whatsapp_webhook_events" (
          "id" uuid NOT NULL DEFAULT gen_random_uuid(),
          "eventType" varchar(100) NOT NULL,
          "rawPayload" jsonb NOT NULL,
          "correlationId" varchar(255),
          "tenantId" varchar(255),
          "processed" boolean NOT NULL DEFAULT false,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "PK_whatsapp_webhook_events" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_whatsapp_webhook_events_created" ON "whatsapp_webhook_events" ("createdAt")`);
      await queryRunner.query(`CREATE INDEX "IDX_whatsapp_webhook_events_type" ON "whatsapp_webhook_events" ("eventType")`);
    }
    console.log('  7/8 whatsapp_webhook_events table created');

    console.log('  8/8 WhatsApp system migration completed');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_webhook_events" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_message_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_message_templates" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_tenant_config" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "whatsapp_template_type_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "whatsapp_message_type_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "whatsapp_message_status_enum" CASCADE`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds retention policy and anonymization tracking to WhatsApp module:
 * - whatsapp_tenant_config: retentionDays column (default 730 = 2 years)
 * - whatsapp_message_logs: isAnonymized + anonymizedAt columns
 */
export class AddWhatsappRetentionPolicy1774000000000 implements MigrationInterface {
  name = 'AddWhatsappRetentionPolicy1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Adding WhatsApp retention policy columns...');

    // 1. Add retentionDays to whatsapp_tenant_config
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "whatsapp_tenant_config" ADD COLUMN "retentionDays" integer NOT NULL DEFAULT 730;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    // 2. Add isAnonymized to whatsapp_message_logs
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "whatsapp_message_logs" ADD COLUMN "isAnonymized" boolean NOT NULL DEFAULT false;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    // 3. Add anonymizedAt to whatsapp_message_logs
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "whatsapp_message_logs" ADD COLUMN "anonymizedAt" timestamptz;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    // 4. Index on isAnonymized for efficient filtering
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wa_logs_anonymized"
      ON "whatsapp_message_logs" ("isAnonymized");
    `);

    console.log('WhatsApp retention policy columns added successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_wa_logs_anonymized"`);
    await queryRunner.query(`ALTER TABLE "whatsapp_message_logs" DROP COLUMN IF EXISTS "anonymizedAt"`);
    await queryRunner.query(`ALTER TABLE "whatsapp_message_logs" DROP COLUMN IF EXISTS "isAnonymized"`);
    await queryRunner.query(`ALTER TABLE "whatsapp_tenant_config" DROP COLUMN IF EXISTS "retentionDays"`);
  }
}

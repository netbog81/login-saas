import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Template WhatsApp per la MODIFICA di un appuntamento + seed dei template
 * mancanti sui tenant esistenti.
 *
 * Contesto: la 1773 seeda solo RECAP_SINGLE/RECAP_MULTI/REMINDER_24H e solo
 * alla creazione della tabella; la 1775 aggiunge il valore enum CANCELLATION
 * ma non la riga corrispondente. Senza riga, il clinico non ha nulla da
 * renderizzare e il gateway ricade sul proprio testo hardcoded — che è quanto
 * accadeva ai messaggi di cancellazione.
 */
export class AddWhatsappUpdateTemplate1810000000000 implements MigrationInterface {
  name = 'AddWhatsappUpdateTemplate1810000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = (queryRunner.connection.options as any).schema || 'public';

    // Flag di invio della notifica di spostamento (default ON: uno spostamento
    // riguarda sempre il paziente, al contrario della cancellazione che è opt-in).
    await queryRunner.query(`
      ALTER TABLE "whatsapp_tenant_config"
      ADD COLUMN IF NOT EXISTS "sendUpdateNotification" boolean NOT NULL DEFAULT true
    `);

    // ALTER TYPE ... ADD VALUE non può stare dentro una transazione, e il nuovo
    // valore non è usabile nella stessa transazione che lo crea: si esce dalla
    // transazione della migration, si estendono gli enum, si rientra.
    await queryRunner.query(`COMMIT`);
    await queryRunner.query(`
      ALTER TYPE "${schema}"."whatsapp_template_type_enum"
      ADD VALUE IF NOT EXISTS 'UPDATE'
    `);
    await queryRunner.query(`
      ALTER TYPE "${schema}"."whatsapp_message_type_enum"
      ADD VALUE IF NOT EXISTS 'update'
    `);
    await queryRunner.query(`BEGIN`);

    // Seed dei template non ancora presenti (idempotente).
    await queryRunner.query(`
      INSERT INTO "whatsapp_message_templates" ("templateType", "bodyTemplate", "isActive")
      VALUES
        ('CANCELLATION', 'Gentile {name}, il suo appuntamento del {date} alle {time} è stato cancellato.', true),
        ('UPDATE', 'Gentile {name}, il suo appuntamento è stato spostato al {date} alle {time}.', true)
      ON CONFLICT ("templateType") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "whatsapp_tenant_config"
      DROP COLUMN IF EXISTS "sendUpdateNotification"
    `);
    await queryRunner.query(`
      DELETE FROM "whatsapp_message_templates" WHERE "templateType" = 'UPDATE'
    `);
    // I valori aggiunti a un enum PostgreSQL non sono rimovibili.
    console.warn(
      "NOTA: 'UPDATE' resta nell'enum whatsapp_template_type_enum e 'update' in whatsapp_message_type_enum",
    );
  }
}

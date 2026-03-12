import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsappCancellationSupport1775000000000 implements MigrationInterface {
  name = 'AddWhatsappCancellationSupport1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Aggiungere colonna sendCancelNotification alla config
    await queryRunner.query(`
      ALTER TABLE "whatsapp_tenant_config"
      ADD COLUMN IF NOT EXISTS "sendCancelNotification" boolean NOT NULL DEFAULT false
    `);

    // 2. Estendere enum WhatsappTemplateType con CANCELLATION
    // Usa il nome corretto dell'enum generato da TypeORM: whatsapp_template_type_enum
    // ADD VALUE IF NOT EXISTS non puo' stare in una transazione,
    // quindi va eseguito fuori dalla transazione corrente
    const schema = (queryRunner.connection.options as any).schema || 'public';
    await queryRunner.query(`COMMIT`);
    await queryRunner.query(`
      ALTER TYPE "${schema}"."whatsapp_template_type_enum"
      ADD VALUE IF NOT EXISTS 'CANCELLATION'
    `);
    await queryRunner.query(`BEGIN`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "whatsapp_tenant_config"
      DROP COLUMN IF EXISTS "sendCancelNotification"
    `);

    // Non e' possibile rimuovere un valore da un enum PostgreSQL
    console.warn('NOTA: Non e\' possibile rimuovere CANCELLATION dall\'enum whatsapp_message_templates_templatetype_enum');
  }
}

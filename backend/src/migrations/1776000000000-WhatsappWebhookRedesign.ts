import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappWebhookRedesign1776000000000 implements MigrationInterface {
  name = 'WhatsappWebhookRedesign1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = (queryRunner.connection.options as any).schema || 'public';

    // 1. Aggiungere DISPATCHED e CANCELLED all'enum status
    // ADD VALUE IF NOT EXISTS non può stare in una transazione
    await queryRunner.query(`COMMIT`);
    await queryRunner.query(`
      ALTER TYPE "${schema}"."whatsapp_message_status_enum"
      ADD VALUE IF NOT EXISTS 'dispatched'
    `);
    await queryRunner.query(`
      ALTER TYPE "${schema}"."whatsapp_message_status_enum"
      ADD VALUE IF NOT EXISTS 'cancelled'
    `);
    await queryRunner.query(`BEGIN`);

    // 2. Aggiungere colonna appointmentIds (jsonb) per recap multipli
    await queryRunner.query(`
      ALTER TABLE "whatsapp_message_logs"
      ADD COLUMN IF NOT EXISTS "appointmentIds" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "whatsapp_message_logs"
      DROP COLUMN IF EXISTS "appointmentIds"
    `);

    // Non è possibile rimuovere valori da un enum PostgreSQL
    console.warn('NOTA: Non è possibile rimuovere dispatched/cancelled dall\'enum whatsapp_message_status_enum');
  }
}

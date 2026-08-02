import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Finestra di raggruppamento del recap configurabile per tenant.
 *
 * Era hardcoded a 60s nel gateway: gli appuntamenti presi per lo stesso numero
 * entro quella finestra finiscono in un unico messaggio. Ora il valore arriva
 * dalla config del tenant (30-600s, default 60) e il gateway lo usa come delay
 * del job di recap.
 */
export class AddWhatsappRecapBufferSeconds1811000000000 implements MigrationInterface {
  name = 'AddWhatsappRecapBufferSeconds1811000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "whatsapp_tenant_config"
      ADD COLUMN IF NOT EXISTS "recapBufferSeconds" integer NOT NULL DEFAULT 60
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "whatsapp_tenant_config"
      DROP COLUMN IF EXISTS "recapBufferSeconds"
    `);
  }
}

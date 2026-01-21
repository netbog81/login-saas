import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aggiunge la colonna isCustomPrice alla tabella treatment_services.
 *
 * Questo campo distingue tra:
 * - Prezzi calcolati automaticamente (default/scontoFE) → isCustomPrice = false
 * - Prezzi modificati manualmente dall'operatore → isCustomPrice = true
 *
 * I record esistenti avranno isCustomPrice = false di default.
 */
export class AddIsCustomPriceToTreatmentServices1768800000000 implements MigrationInterface {
  name = 'AddIsCustomPriceToTreatmentServices1768800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Aggiungi la colonna isCustomPrice con default false
    await queryRunner.query(`
      ALTER TABLE "treatment_services"
      ADD COLUMN IF NOT EXISTS "isCustomPrice" boolean NOT NULL DEFAULT false
    `);

    console.log('✅ Colonna isCustomPrice aggiunta a treatment_services');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rimuovi la colonna
    await queryRunner.query(`
      ALTER TABLE "treatment_services"
      DROP COLUMN IF EXISTS "isCustomPrice"
    `);

    console.log('✅ Colonna isCustomPrice rimossa da treatment_services');
  }
}

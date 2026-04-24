import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aggiunge il flag `readyForBilling` ai trattamenti.
 *
 * Stato "verificato dalla segreteria e pronto per essere inviato al
 * sistema di fatturazione". È un passo intermedio distinto da
 * `isInvoicedToPatient`: la segreteria prima marca come pronto, poi
 * (anche in un secondo momento) invia veramente al fatturatore.
 *
 * Vincoli applicativi (enforced nel resolver/service):
 * - può essere true solo se status = CLOSED (chiuso da segreteria)
 * - può essere true solo se scontoFE = false
 * - se scontoFE passa a true, readyForBilling viene forzato a false
 *
 * Il campo readyAtForBilling traccia quando è stato marcato.
 */
export class AddTreatmentReadyForBilling1780000000003
  implements MigrationInterface
{
  name = 'AddTreatmentReadyForBilling1780000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD COLUMN "readyForBilling" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD COLUMN "readyForBillingAt" timestamp NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_treatments_ready_for_billing"
      ON "treatments"("readyForBilling")
      WHERE "readyForBilling" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_treatments_ready_for_billing"`);
    await queryRunner.query(`
      ALTER TABLE "treatments"
      DROP COLUMN "readyForBillingAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "treatments"
      DROP COLUMN "readyForBilling"
    `);
  }
}

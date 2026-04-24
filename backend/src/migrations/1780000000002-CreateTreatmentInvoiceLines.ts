import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabella treatment_invoice_lines.
 *
 * Contiene le righe di fatturazione custom che la segreteria aggiunge
 * manualmente a un trattamento (in aggiunta alle righe derivate dai
 * servizi erogati, che vivono su treatment_services.invoiceLineDescription).
 *
 * Cascade: se il trattamento viene cancellato, anche le sue righe
 * custom vengono eliminate (FK ON DELETE CASCADE).
 */
export class CreateTreatmentInvoiceLines1780000000002
  implements MigrationInterface
{
  name = 'CreateTreatmentInvoiceLines1780000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public`);

    await queryRunner.query(`
      CREATE TABLE "treatment_invoice_lines" (
        "id" uuid NOT NULL DEFAULT public.uuid_generate_v4(),
        "treatmentId" uuid NOT NULL,
        "description" text NOT NULL,
        "amount" decimal(10, 2) NOT NULL DEFAULT 0,
        "createdBy" uuid NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_treatment_invoice_lines" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "treatment_invoice_lines"
      ADD CONSTRAINT "FK_treatment_invoice_lines_treatment"
        FOREIGN KEY ("treatmentId")
        REFERENCES "treatments"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_treatment_invoice_lines_treatment"
      ON "treatment_invoice_lines"("treatmentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_treatment_invoice_lines_treatment"`);
    await queryRunner.query(`
      ALTER TABLE "treatment_invoice_lines"
      DROP CONSTRAINT IF EXISTS "FK_treatment_invoice_lines_treatment"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "treatment_invoice_lines"`);
  }
}

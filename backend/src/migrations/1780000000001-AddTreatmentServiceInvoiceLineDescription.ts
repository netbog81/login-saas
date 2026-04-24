import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aggiunge la colonna `invoiceLineDescription` a treatment_services.
 *
 * Contiene la descrizione testuale che comparirà sulla riga fattura
 * per quel servizio erogato nel trattamento.
 *
 * - Per i medici: compilata dal medico durante la chiusura del trattamento
 *   (opzionale con warning UI; la segreteria può completarla dopo).
 * - Per gli altri operatori: auto-generata a valle dal backend
 *   (data + servizio + strumenti + operatore + albo).
 * - La segreteria può sempre editarla per tutti.
 *
 * Nullable perché può essere vuota fino alla verifica della segreteria.
 */
export class AddTreatmentServiceInvoiceLineDescription1780000000001
  implements MigrationInterface
{
  name = 'AddTreatmentServiceInvoiceLineDescription1780000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "treatment_services"
      ADD COLUMN "invoiceLineDescription" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "treatment_services"
      DROP COLUMN "invoiceLineDescription"
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PARTE 3 — "Fattura e Incassa" con PDF stampabile.
 *
 * Aggiunge `accountingDocumentId` (uuid NULL) su `treatments`: l'ID del
 * SalesDocument (fattura) lato accounting, popolato dal consumer
 * `billable.invoiced`. Serve a recuperare on-demand il PDF stampabile via il
 * proxy clinico (GET /treatments/:id/invoice-pdf → accounting
 * GET /sales-documents/:id/pdf).
 *
 * Distinto da `accountingInvoiceUrl` (campo legacy mai popolato da accounting:
 * il payload `documentUrl` non viene mai valorizzato lato accounting).
 *
 * DB-per-tenant (post-containerizzazione 2026-06-11): lanciare con override
 * `DB_DATABASE=clinico_<hash>`; gira sullo schema `public` del DB del tenant.
 * La guard accetta `public` e lo schema storico `t_<hash>` per retro-compat.
 */
export class AddTreatmentAccountingDocumentId1791000000000
  implements MigrationInterface
{
  name = 'AddTreatmentAccountingDocumentId1791000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddTreatmentAccountingDocumentId1791000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddTreatmentAccountingDocumentId: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${AddTreatmentAccountingDocumentId1791000000000.TARGET_SCHEMA}", "public".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD COLUMN IF NOT EXISTS "accountingDocumentId" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddTreatmentAccountingDocumentId1791000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddTreatmentAccountingDocumentId.down: rifiuto sullo schema "${currentSchema}".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(`
      ALTER TABLE "treatments"
      DROP COLUMN IF EXISTS "accountingDocumentId"
    `);
  }
}

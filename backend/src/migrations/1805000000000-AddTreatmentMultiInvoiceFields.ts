import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fatture multi-trattamento (2026-07-08).
 *
 * Due colonne su `treatments`, popolate dal consumer `billable.invoiced`
 * (campi additivi del payload) e azzerate insieme allo snapshot accounting:
 *
 *  - `accountingTreatmentLinesAmount` numeric(10,2) NULL — quota di questo
 *    treatment nel documento (somma delle sue righe, senza bollo). Può
 *    differire da `price` se accounting ha modificato le righe.
 *  - `accountingDocumentTreatmentCount` int NULL — quanti treatment clinici
 *    distinti copre il documento (1 = fattura singola; > 1 = la UI mostra
 *    l'icona "fattura cumulativa" e l'incasso è a saldo intero documento).
 *
 * DB-per-tenant (post-containerizzazione 2026-06-11): lanciare con override
 * `DB_DATABASE=clinico_<hash>`; gira sullo schema `public` del DB del tenant.
 * La guard accetta `public` e lo schema storico `t_<hash>` per retro-compat.
 *
 * ALTER su tabella esistente → nessun grant aggiuntivo necessario.
 */
export class AddTreatmentMultiInvoiceFields1805000000000
  implements MigrationInterface
{
  name = 'AddTreatmentMultiInvoiceFields1805000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  private static async guardSchema(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddTreatmentMultiInvoiceFields1805000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddTreatmentMultiInvoiceFields: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${AddTreatmentMultiInvoiceFields1805000000000.TARGET_SCHEMA}", "public".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await AddTreatmentMultiInvoiceFields1805000000000.guardSchema(queryRunner);
    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD COLUMN IF NOT EXISTS "accountingTreatmentLinesAmount" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "accountingDocumentTreatmentCount" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await AddTreatmentMultiInvoiceFields1805000000000.guardSchema(queryRunner);
    await queryRunner.query(`
      ALTER TABLE "treatments"
      DROP COLUMN IF EXISTS "accountingTreatmentLinesAmount",
      DROP COLUMN IF EXISTS "accountingDocumentTreatmentCount"
    `);
  }
}

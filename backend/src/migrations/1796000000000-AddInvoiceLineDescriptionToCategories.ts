import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-07-03 — Descrizione righe fattura per categorie.
 *
 * Aggiunge il campo `invoiceLineDescription` (text NULL) a:
 *   - operator_categories   — descrizione da inserire nelle righe fattura per
 *     le prestazioni degli operatori della categoria
 *   - service_subcategories — idem per i servizi della sottocategoria
 *
 * Distinto dalla `description` esistente (descrizione libera). Verrà usato
 * dal sistema di composizione della descrizione riga fattura (sezione
 * impostazioni "Descrizione righe servizi").
 *
 * DB-per-tenant (post-containerizzazione 2026-06-11): lanciare con override
 * `DB_DATABASE=clinico_<hash>`; gira sullo schema `public` del DB del tenant.
 * ALTER su tabelle esistenti → ereditano i grant già concessi a `*_svc`.
 */
export class AddInvoiceLineDescriptionToCategories1796000000000
  implements MigrationInterface
{
  name = 'AddInvoiceLineDescriptionToCategories1796000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddInvoiceLineDescriptionToCategories1796000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddInvoiceLineDescriptionToCategories: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${AddInvoiceLineDescriptionToCategories1796000000000.TARGET_SCHEMA}", "public".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      ALTER TABLE "operator_categories"
      ADD COLUMN IF NOT EXISTS "invoiceLineDescription" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "service_subcategories"
      ADD COLUMN IF NOT EXISTS "invoiceLineDescription" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddInvoiceLineDescriptionToCategories1796000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddInvoiceLineDescriptionToCategories.down: rifiuto sullo schema "${currentSchema}".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(`
      ALTER TABLE "operator_categories"
      DROP COLUMN IF EXISTS "invoiceLineDescription"
    `);
    await queryRunner.query(`
      ALTER TABLE "service_subcategories"
      DROP COLUMN IF EXISTS "invoiceLineDescription"
    `);
  }
}

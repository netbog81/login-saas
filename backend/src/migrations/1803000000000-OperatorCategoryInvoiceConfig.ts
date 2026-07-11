import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-07-07 — Descrizione righe fattura per categoria operatore (toggle).
 *
 * Il cliente vuole poter comporre la descrizione riga fattura per
 * SOTTOCATEGORIA OPERATORI (entità `operator_categories`, es.
 * "Massofisioterapisti" senza albo vs "Fisioterapisti" con albo, entrambe
 * sotto la macro Fisioterapisti) invece che per macro-categoria.
 *
 *  - `operator_categories.invoicePrefix`   (text NULL) — prefisso riga
 *  - `operator_categories.invoiceTemplate` (text NULL) — template a segnaposto
 *    (stesso meccanismo di `service_invoice_prefixes.template`)
 *  - nuova tabella `invoice_line_settings` (una riga per tenant) con il
 *    toggle globale `useOperatorCategories` (default false = comportamento
 *    attuale per macro-categoria).
 *
 * DB-per-tenant (post-containerizzazione 2026-06-11): lanciare con override
 * `DB_DATABASE=clinico_<hash>`; gira sullo schema `public` del DB del tenant.
 * ALTER su tabelle esistenti → ereditano i grant già concessi a `*_svc`;
 * per la tabella nuova i grant vengono dati esplicitamente al ruolo di
 * servizio se presente.
 */
export class OperatorCategoryInvoiceConfig1803000000000
  implements MigrationInterface
{
  name = 'OperatorCategoryInvoiceConfig1803000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== OperatorCategoryInvoiceConfig1803000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `OperatorCategoryInvoiceConfig: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${OperatorCategoryInvoiceConfig1803000000000.TARGET_SCHEMA}", "public".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      ALTER TABLE "operator_categories"
      ADD COLUMN IF NOT EXISTS "invoicePrefix" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "operator_categories"
      ADD COLUMN IF NOT EXISTS "invoiceTemplate" text NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoice_line_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "useOperatorCategories" boolean NOT NULL DEFAULT false,
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Tabella nuova: grant espliciti all'utente di servizio `*_svc`
    // (stesso pattern della migration 1800 CreateDocumentTemplates).
    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT rolname FROM pg_roles WHERE rolname LIKE '%\\_svc' LOOP
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE invoice_line_settings TO %I', r.rolname);
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== OperatorCategoryInvoiceConfig1803000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `OperatorCategoryInvoiceConfig.down: rifiuto sullo schema "${currentSchema}".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_line_settings"`);
    await queryRunner.query(`
      ALTER TABLE "operator_categories"
      DROP COLUMN IF EXISTS "invoiceTemplate"
    `);
    await queryRunner.query(`
      ALTER TABLE "operator_categories"
      DROP COLUMN IF EXISTS "invoicePrefix"
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-07-06 — Dati fiscali/professionali dell'operatore per i documenti
 * generati (attestati di presenza, certificati).
 *
 * Aggiunge a `operators`:
 *  - `professional_title` varchar(255) NULL — qualifica mostrata nei
 *    documenti (es. "Fisioterapista", "Psicologo")
 *  - `tax_code` varchar(16) NULL — codice fiscale del professionista
 *  - `vat_number` varchar(11) NULL — partita IVA del professionista
 *
 * DB-per-tenant: lanciare con override `DB_DATABASE=clinico_<hash>`.
 * ALTER su tabella esistente → eredita i grant già concessi a `*_svc`.
 */
export class AddOperatorFiscalFields1799000000000 implements MigrationInterface {
  name = 'AddOperatorFiscalFields1799000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;
    if (
      currentSchema !== AddOperatorFiscalFields1799000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddOperatorFiscalFields: rifiuto di girare sullo schema "${currentSchema}".`,
      );
    }
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      ALTER TABLE "operators"
      ADD COLUMN IF NOT EXISTS "professional_title" varchar(255) NULL,
      ADD COLUMN IF NOT EXISTS "tax_code" varchar(16) NULL,
      ADD COLUMN IF NOT EXISTS "vat_number" varchar(11) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;
    if (
      currentSchema !== AddOperatorFiscalFields1799000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddOperatorFiscalFields.down: rifiuto sullo schema "${currentSchema}".`,
      );
    }
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(`
      ALTER TABLE "operators"
      DROP COLUMN IF EXISTS "professional_title",
      DROP COLUMN IF EXISTS "tax_code",
      DROP COLUMN IF EXISTS "vat_number"
    `);
  }
}

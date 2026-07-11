import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-07-03 — Template componibile descrizione righe fattura.
 *
 * Aggiunge `template` (text NULL) a `service_invoice_prefixes`: template con
 * segnaposto ({prefisso} {data} {codice_servizio} {nome_servizio}
 * {descrizione_servizio} {descrizione_fattura_sottocategoria} {operatore}
 * {albo} {descrizione_fattura_categoria} {strumenti}) per macro-categoria.
 * NULL → si continua a usare la composizione legacy basata sul prefisso.
 *
 * DB-per-tenant: lanciare con override `DB_DATABASE=clinico_<hash>`.
 * ALTER su tabella esistente → eredita i grant già concessi a `*_svc`.
 */
export class AddServiceInvoicePrefixTemplate1797000000000
  implements MigrationInterface
{
  name = 'AddServiceInvoicePrefixTemplate1797000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddServiceInvoicePrefixTemplate1797000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddServiceInvoicePrefixTemplate: rifiuto di girare sullo schema "${currentSchema}".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(`
      ALTER TABLE "service_invoice_prefixes"
      ADD COLUMN IF NOT EXISTS "template" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddServiceInvoicePrefixTemplate1797000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddServiceInvoicePrefixTemplate.down: rifiuto sullo schema "${currentSchema}".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(`
      ALTER TABLE "service_invoice_prefixes"
      DROP COLUMN IF EXISTS "template"
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabella service_invoice_prefixes.
 *
 * Contiene il prefisso testuale usato per generare automaticamente la
 * descrizione della riga fattura per ogni categoria operatore.
 *
 * Es: per macroCategory=physiotherapist, prefix="Seduta fisioterapica del"
 * produce righe come: "Seduta fisioterapica del 22/04/2026 — Massoterapia ..."
 *
 * Un solo record per macroCategory (vincolo unique). La segreteria/admin
 * può modificare il prefisso dalla pagina Impostazioni.
 *
 * Inserisce anche i default per le 4 categorie esistenti.
 */
export class CreateServiceInvoicePrefixes1780000000005
  implements MigrationInterface
{
  name = 'CreateServiceInvoicePrefixes1780000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public`);

    await queryRunner.query(`
      CREATE TABLE "service_invoice_prefixes" (
        "id" uuid NOT NULL DEFAULT public.uuid_generate_v4(),
        "macroCategory" operators_macrocategory_enum NOT NULL,
        "prefix" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_service_invoice_prefixes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_service_invoice_prefixes_macroCategory" UNIQUE ("macroCategory")
      )
    `);

    // Seed dei default. 'other' NON incluso: la migration che aggiunge il
    // valore all'enum (1780000000004) è stata applicata ma l'ALTER TYPE in
    // alcuni scenari multi-tenant con search_path non rende il valore
    // immediatamente disponibile. Il service backend ha un fallback
    // hardcoded ('Prestazione del') quando il record 'other' non esiste.
    // Chi vuole può inserirlo in seguito via mutation upsertServiceInvoicePrefix
    // (una volta che un ALTER TYPE successivo ha effettivamente propagato
    // il valore).
    await queryRunner.query(`
      INSERT INTO "service_invoice_prefixes" ("macroCategory", "prefix") VALUES
        ('doctor', 'Visita medica del'),
        ('physiotherapist', 'Seduta fisioterapica del'),
        ('gym_instructor', 'Lezione palestra del')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "service_invoice_prefixes"`);
  }
}

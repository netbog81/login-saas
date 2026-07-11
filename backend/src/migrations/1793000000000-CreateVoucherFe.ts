import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PARTE 4.3 — Voucher FE (100% clinico).
 *
 * Crea `voucher_fe` + `voucher_fe_usages`: voucher prepagati gestiti
 * interamente nel clinico, usati come metodo di pagamento SOLO per i
 * trattamenti con sconto FE (che non passano da accounting). Nessun evento
 * verso accounting, nessuna prima nota nel motore contabile.
 *
 * DB-per-tenant: lanciare con override `DB_DATABASE=clinico_<hash>`.
 */
export class CreateVoucherFe1793000000000 implements MigrationInterface {
  name = 'CreateVoucherFe1793000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;
    if (
      currentSchema !== CreateVoucherFe1793000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `CreateVoucherFe: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${CreateVoucherFe1793000000000.TARGET_SCHEMA}", "public".`,
      );
    }
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "voucher_fe" (
        "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
        "code"           varchar(50) NOT NULL,
        "patientId"      uuid NOT NULL,
        "initialAmount"  numeric(10,2) NOT NULL,
        "residualAmount" numeric(10,2) NOT NULL,
        "status"         varchar(20) NOT NULL DEFAULT 'active',
        "expiryDate"     date,
        "notes"          text,
        "createdByUserId" uuid,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_voucher_fe" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_voucher_fe_code" ON "voucher_fe" ("code")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_voucher_fe_patient" ON "voucher_fe" ("patientId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "voucher_fe_usages" (
        "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
        "voucherFeId"    uuid NOT NULL,
        "type"           varchar(20) NOT NULL,
        "amount"         numeric(10,2) NOT NULL,
        "residualAfter"  numeric(10,2) NOT NULL,
        "treatmentId"    uuid,
        "createdByUserId" uuid,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_voucher_fe_usages" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_voucher_fe_usages_voucher" ON "voucher_fe_usages" ("voucherFeId")
    `);

    // Le migration girano come `migrator`, ma il backend si connette come
    // l'utente di servizio `*_svc`. Le tabelle NUOVE create qui avrebbero owner
    // `migrator` senza privilegi per il backend → concediamo esplicitamente i
    // privilegi a ogni ruolo `*_svc` presente (pattern per-tenant).
    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT rolname FROM pg_roles WHERE rolname LIKE '%\\_svc' LOOP
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE voucher_fe, voucher_fe_usages TO %I', r.rolname);
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;
    if (
      currentSchema !== CreateVoucherFe1793000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `CreateVoucherFe.down: rifiuto sullo schema "${currentSchema}".`,
      );
    }
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "voucher_fe_usages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "voucher_fe"`);
  }
}

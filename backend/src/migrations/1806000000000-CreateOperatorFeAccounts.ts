import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-07-12 — CONTI FE (Statistiche → Conti FE).
 *
 * Conteggi compensi operatore sui trattamenti con SCONTO FE, calcolati nel
 * clinico sui campi FE dei servizi (Tariffa servizio FE / Extra studio FE /
 * Totale Sconto FE). Speculare alle tabelle operator_settlements
 * dell'accounting, senza metodo di pagamento / banca / rif. fattura
 * operatore: del pagamento resta solo la data.
 *
 *  - operator_fe_settlements: un conteggio per operatore+periodo (snapshot
 *    immutabile, batchId = lotto di generazione, flag workflow
 *    comunicato/verificato/pagato + paymentDate).
 *  - operator_fe_settlement_lines: le prestazioni conteggiate (riga
 *    servizio × trattamento) con calcolo snapshottato.
 *  - operator_fe_account_settings: periodi standard (mese solare o giorno
 *    di chiusura), al più una riga per tenant.
 *
 * DB-per-tenant: lanciare con override `DB_DATABASE=clinico_<hash>`.
 */
export class CreateOperatorFeAccounts1806000000000
  implements MigrationInterface
{
  name = 'CreateOperatorFeAccounts1806000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  private static async guardSchema(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;
    if (
      currentSchema !== CreateOperatorFeAccounts1806000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `CreateOperatorFeAccounts: rifiuto di girare sullo schema "${currentSchema}".`,
      );
    }
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await CreateOperatorFeAccounts1806000000000.guardSchema(queryRunner);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "operator_fe_settlements" (
        "id"                  uuid NOT NULL DEFAULT gen_random_uuid(),
        "batchId"             uuid,
        "operatorAppUserId"   uuid NOT NULL,
        "operatorName"        varchar(255) NOT NULL,
        "periodFrom"          date NOT NULL,
        "periodTo"            date NOT NULL,
        "includeUnpaid"       boolean NOT NULL DEFAULT false,
        "includeOpen"         boolean NOT NULL DEFAULT false,
        "countTotal"          integer NOT NULL DEFAULT 0,
        "countPaid"           integer NOT NULL DEFAULT 0,
        "countUnpaid"         integer NOT NULL DEFAULT 0,
        "countOpen"           integer NOT NULL DEFAULT 0,
        "grossAmount"         numeric(12,2) NOT NULL DEFAULT 0,
        "baseAmount"          numeric(12,2) NOT NULL DEFAULT 0,
        "compensationAmount"  numeric(12,2) NOT NULL DEFAULT 0,
        "studioShareAmount"   numeric(12,2) NOT NULL DEFAULT 0,
        "studioExtraAmount"   numeric(12,2) NOT NULL DEFAULT 0,
        "communicatedAt"      TIMESTAMP,
        "verifiedAt"          TIMESTAMP,
        "paidAt"              TIMESTAMP,
        "paymentDate"         date,
        "notes"               text,
        "createdByUserId"     uuid,
        "createdByEmail"      varchar(200),
        "createdAt"           TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_operator_fe_settlements" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_operator_fe_settlements_operator"
        ON "operator_fe_settlements" ("operatorAppUserId", "periodFrom")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "operator_fe_settlement_lines" (
        "id"                  uuid NOT NULL DEFAULT gen_random_uuid(),
        "settlementId"        uuid NOT NULL,
        "treatmentId"         uuid NOT NULL,
        "treatmentServiceId"  uuid NOT NULL,
        "executionDate"       date NOT NULL,
        "description"         varchar(255) NOT NULL,
        "serviceName"         varchar(255),
        "patientName"         varchar(255),
        "unitPrice"           numeric(10,2) NOT NULL DEFAULT 0,
        "studioExtraAmount"   numeric(10,2) NOT NULL DEFAULT 0,
        "baseAmount"          numeric(10,2) NOT NULL DEFAULT 0,
        "percentage"          numeric(5,2) NOT NULL DEFAULT 0,
        "compensationAmount"  numeric(10,2) NOT NULL DEFAULT 0,
        "studioShareAmount"   numeric(10,2) NOT NULL DEFAULT 0,
        "state"               varchar(20) NOT NULL,
        "isCustomPrice"       boolean NOT NULL DEFAULT false,
        "createdAt"           TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_operator_fe_settlement_lines" PRIMARY KEY ("id"),
        CONSTRAINT "FK_operator_fe_settlement_lines_settlement"
          FOREIGN KEY ("settlementId") REFERENCES "operator_fe_settlements"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_operator_fe_settlement_lines_settlement"
        ON "operator_fe_settlement_lines" ("settlementId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "operator_fe_account_settings" (
        "id"          uuid NOT NULL DEFAULT gen_random_uuid(),
        "periodMode"  varchar(20) NOT NULL DEFAULT 'CALENDAR_MONTH',
        "cutoffDay"   integer NOT NULL DEFAULT 25,
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_operator_fe_account_settings" PRIMARY KEY ("id")
      )
    `);

    // Le migration girano come `migrator`, ma il backend si connette come
    // l'utente di servizio `*_svc` → grant espliciti sulle tabelle nuove.
    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT rolname FROM pg_roles WHERE rolname LIKE '%\\_svc' LOOP
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE operator_fe_settlements TO %I', r.rolname);
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE operator_fe_settlement_lines TO %I', r.rolname);
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE operator_fe_account_settings TO %I', r.rolname);
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await CreateOperatorFeAccounts1806000000000.guardSchema(queryRunner);
    await queryRunner.query(`DROP TABLE IF EXISTS "operator_fe_settlement_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "operator_fe_settlements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "operator_fe_account_settings"`);
  }
}

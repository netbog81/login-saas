import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-07-15 — Attribuzione compensi: operatore esecutore per riga servizio.
 *
 * Aggiunge `treatment_services.executorOperatorId` (FK operators.id):
 * l'operatore che ha materialmente eseguito QUESTA riga, scelto
 * esplicitamente in UI ("Eseguito da"). NULL = fallback all'operatore del
 * trattamento.
 *
 * Sostituisce l'uso improprio di `executedByOperatorId` (FK app_users.id),
 * che `addTreatmentServiceLine` valorizzava con l'utente LOGGATO: le righe
 * aggiunte dalla segreteria finivano attribuite alla segreteria nei
 * conteggi operatori (accounting) e nei conti FE (clinico). La colonna
 * legacy resta per compatibilità ma non viene più scritta né letta per
 * l'attribuzione dei compensi.
 *
 * DB-per-tenant: lanciare con override `DB_DATABASE=clinico_<hash>`.
 */
export class TreatmentServiceExecutorOperator1807000000000
  implements MigrationInterface
{
  name = 'TreatmentServiceExecutorOperator1807000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  private static async guardSchema(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;
    if (
      currentSchema !==
        TreatmentServiceExecutorOperator1807000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `TreatmentServiceExecutorOperator: rifiuto di girare sullo schema "${currentSchema}".`,
      );
    }
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await TreatmentServiceExecutorOperator1807000000000.guardSchema(
      queryRunner,
    );

    await queryRunner.query(`
      ALTER TABLE "treatment_services"
        ADD COLUMN IF NOT EXISTS "executorOperatorId" uuid
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "treatment_services"
          ADD CONSTRAINT "FK_treatment_services_executor_operator"
          FOREIGN KEY ("executorOperatorId") REFERENCES "operators"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_treatment_services_executor"
        ON "treatment_services" ("executorOperatorId")
        WHERE "executorOperatorId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await TreatmentServiceExecutorOperator1807000000000.guardSchema(
      queryRunner,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_treatment_services_executor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "treatment_services" DROP CONSTRAINT IF EXISTS "FK_treatment_services_executor_operator"`,
    );
    await queryRunner.query(
      `ALTER TABLE "treatment_services" DROP COLUMN IF EXISTS "executorOperatorId"`,
    );
  }
}

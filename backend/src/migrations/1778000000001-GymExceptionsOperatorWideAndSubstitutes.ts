import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refactor gym_exceptions per supportare:
 * 1. Eccezioni "operator-wide" (gymRoomId NULL, operatorId valorizzato,
 *    eccezione valida su tutte le palestre in cui l'operatore ha pattern
 *    quel giorno).
 * 2. Snapshot del tipo di assenza (absenceTypeId soft reference +
 *    absenceTypeSnapshot JSONB) per sopravvivere alla cancellazione del
 *    record OperatorAbsenceType.
 * 3. Tabella figlia gym_exception_substitutes: una riga per ogni slot
 *    originale dell'operatore assente, con sostituto specifico (può essere
 *    NULL = slot scoperto).
 *
 * Le eccezioni preesistenti (gymRoomId NOT NULL, vecchio substituteOperatorId)
 * rimangono leggibili: il service GymExceptionService.getEffectiveOperator
 * mantiene il fallback sul vecchio campo se substitutes è vuoto.
 */
export class GymExceptionsOperatorWideAndSubstitutes1778000000001
  implements MigrationInterface
{
  name = 'GymExceptionsOperatorWideAndSubstitutes1778000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Rendi gymRoomId nullable
    await queryRunner.query(`
      ALTER TABLE "gym_exceptions"
      ALTER COLUMN "gymRoomId" DROP NOT NULL
    `);

    // 2. Aggiungi colonne per snapshot tipo assenza
    await queryRunner.query(`
      ALTER TABLE "gym_exceptions"
      ADD COLUMN "absenceTypeId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "gym_exceptions"
      ADD COLUMN "absenceTypeSnapshot" jsonb
    `);

    // Assicura uuid-ossp (usata da public.uuid_generate_v4() nella tabella sotto)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public`);

    // 3. Tabella figlia per sostituzioni a slot
    await queryRunner.query(`
      CREATE TABLE "gym_exception_substitutes" (
        "id" uuid NOT NULL DEFAULT public.uuid_generate_v4(),
        "gymExceptionId" uuid NOT NULL,
        "gymRoomId" uuid NOT NULL,
        "startTime" TIME NOT NULL,
        "endTime" TIME NOT NULL,
        "substituteOperatorId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gym_exception_substitutes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ges_exception" FOREIGN KEY ("gymExceptionId")
          REFERENCES "gym_exceptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_ges_gymRoom" FOREIGN KEY ("gymRoomId")
          REFERENCES "gym_rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_ges_substitute" FOREIGN KEY ("substituteOperatorId")
          REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ges_exceptionId"
      ON "gym_exception_substitutes" ("gymExceptionId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 3. Drop tabella figlia
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ges_exceptionId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gym_exception_substitutes"`);

    // 2. Drop colonne snapshot
    await queryRunner.query(`
      ALTER TABLE "gym_exceptions"
      DROP COLUMN IF EXISTS "absenceTypeSnapshot"
    `);
    await queryRunner.query(`
      ALTER TABLE "gym_exceptions"
      DROP COLUMN IF EXISTS "absenceTypeId"
    `);

    // 1. Ripristina NOT NULL su gymRoomId. Se esistono righe operator-wide
    // (gymRoomId IS NULL), questa down fallirà — è un comportamento atteso:
    // la down è best-effort e chi la esegue deve sapere se ha dati operator-wide.
    await queryRunner.query(`
      ALTER TABLE "gym_exceptions"
      ALTER COLUMN "gymRoomId" SET NOT NULL
    `);
  }
}

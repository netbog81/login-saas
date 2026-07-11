import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-07-06 — Gestione assenze operatori/medici (passo 2).
 *
 * 1. `availability_exceptions`:
 *    - DROP UNIQUE(operatorId, exceptionDate): serviva quando l'eccezione era
 *      una-per-giorno; con la granularità a fascia/slot servono più eccezioni
 *      nello stesso giorno. L'anti-sovrapposizione è a livello di service.
 *    - `absenceTypeId` + `absenceTypeSnapshot`: tipo di assenza configurabile
 *      (OperatorAbsenceType) con snapshot, stesso pattern della palestra.
 *    - `sourceGroupId`: lega le eccezioni create in blocco (range dal…al,
 *      più operatori — es. studio chiuso per ferie) per la delete di gruppo.
 * 2. `availability_appointments`:
 *    - `conflictSourceExceptionId`: quale eccezione ha generato il conflitto
 *      → clear chirurgico al ripristino (non più per operatore+data).
 *
 * DB-per-tenant: lanciare con override `DB_DATABASE=clinico_<hash>`.
 */
export class OperatorAbsencesConflictSource1802000000000
  implements MigrationInterface
{
  name = 'OperatorAbsencesConflictSource1802000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== OperatorAbsencesConflictSource1802000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `Migration pensata per lo schema ${OperatorAbsencesConflictSource1802000000000.TARGET_SCHEMA} o public, trovato ${currentSchema}`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "availability_exceptions" DROP CONSTRAINT IF EXISTS "UQ_9fc193c0c9a0141a46175ab91c6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "availability_exceptions" ADD COLUMN IF NOT EXISTS "absenceTypeId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "availability_exceptions" ADD COLUMN IF NOT EXISTS "absenceTypeSnapshot" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "availability_exceptions" ADD COLUMN IF NOT EXISTS "sourceGroupId" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_availability_exceptions_source_group" ON "availability_exceptions" ("sourceGroupId") WHERE "sourceGroupId" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "availability_appointments" ADD COLUMN IF NOT EXISTS "conflictSourceExceptionId" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_availability_appointments_conflict_source" ON "availability_appointments" ("conflictSourceExceptionId") WHERE "conflictSourceExceptionId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_availability_appointments_conflict_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "availability_appointments" DROP COLUMN IF EXISTS "conflictSourceExceptionId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_availability_exceptions_source_group"`,
    );
    await queryRunner.query(
      `ALTER TABLE "availability_exceptions" DROP COLUMN IF EXISTS "sourceGroupId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "availability_exceptions" DROP COLUMN IF EXISTS "absenceTypeSnapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "availability_exceptions" DROP COLUMN IF EXISTS "absenceTypeId"`,
    );
    // Il vincolo UNIQUE non viene ripristinato: potrebbero esserci ormai
    // più eccezioni per (operatorId, exceptionDate).
  }
}

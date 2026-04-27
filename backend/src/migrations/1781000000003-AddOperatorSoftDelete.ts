import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soft-delete + archiviazione per Operator.
 *
 * Aggiunge `deletedAt` (timestamp nullable) e `deletedByUserId` (audit
 * dell'admin che ha archiviato), allineandosi al pattern già usato per
 * Instrument, Treatment, TherapeuticPath ecc. nella migration
 * 1781000000000-AddSoftDeleteAndAuditOwnership.
 *
 * Motivazione: oggi `deleteOperator` fa hard delete e o (a) distrugge
 * dati storici via CASCADE su availability_templates, availability_cache,
 * gym_template_pattern, oppure (b) viene rifiutato dal DB con FK
 * constraint quando ci sono record non-cascadabili (gym_schedule,
 * template_assignment, history). Il service applicativo userà
 * d'ora in poi la regola "se ha dipendenze archivia, altrimenti hard
 * delete", preservando lo storico clinico/contabile.
 *
 * L'unique index sull'email NON è ridefinito come parziale: il vincolo
 * resta globale. Per riusare l'email di un operatore archiviato bisogna
 * prima ripristinarlo o cambiare l'email all'archiviato (decisione UX).
 */
export class AddOperatorSoftDelete1781000000003 implements MigrationInterface {
  name = 'AddOperatorSoftDelete1781000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "operators"
      ADD COLUMN "deletedAt" timestamp NULL,
      ADD COLUMN "deletedByUserId" uuid NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_operators_deleted_at"
      ON "operators"("deletedAt")
      WHERE "deletedAt" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_operators_deleted_at"`);
    await queryRunner.query(`
      ALTER TABLE "operators"
      DROP COLUMN "deletedByUserId",
      DROP COLUMN "deletedAt"
    `);
  }
}

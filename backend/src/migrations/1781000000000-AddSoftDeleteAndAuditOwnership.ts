import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soft delete + audit di ownership + snapshot strumenti.
 *
 * Introduce:
 *  - Colonne `deletedAt` e `deletedByUserId` (soft delete con audit di chi
 *    ha eliminato) su: therapeutic_paths, treatments, availability_appointments,
 *    patient_evaluations, evaluation_objectives, evaluation_tests,
 *    evaluation_exams, treatment_instruments, instruments, instrument_categories.
 *  - Colonne di audit chiusura su trattamenti:
 *      treatments.closedByUserId      → AppUser che ha chiuso (segreteria/admin)
 *      treatments.forcedClosure       → true se segreteria ha forzato la chiusura
 *                                        per operatore dimentico
 *    L'ownership di trattamenti/percorsi è derivata dalle FK esistenti
 *    (operatorId/primaryOperatorId → Operator.appUserId): nessuna nuova
 *    colonna createdByUserId, niente backfill necessario.
 *  - Campi snapshot su treatment_instruments, popolati al primo passaggio
 *    del trattamento a OPERATOR_COMPLETED. Consentono di preservare dati
 *    clinicamente rilevanti anche se lo strumento/categoria viene poi
 *    archiviato o modificato.
 *  - Tabella recycle_bin_settings: configurazione tenant-scoped della
 *    retention del cestino. `retentionDays` null = conservazione indefinita.
 *
 * Indici parziali `deletedAt IS NULL` per performance sulle query attive.
 */
export class AddSoftDeleteAndAuditOwnership1781000000000
  implements MigrationInterface
{
  name = 'AddSoftDeleteAndAuditOwnership1781000000000';

  private readonly softDeleteTables = [
    'therapeutic_paths',
    'treatments',
    'availability_appointments',
    'patient_evaluations',
    'evaluation_objectives',
    'evaluation_tests',
    'evaluation_exams',
    'treatment_instruments',
    'instruments',
    'instrument_categories',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== SOFT DELETE COLUMNS ====================
    for (const table of this.softDeleteTables) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD COLUMN "deletedAt" timestamp NULL,
        ADD COLUMN "deletedByUserId" uuid NULL
      `);

      await queryRunner.query(`
        CREATE INDEX "IDX_${table}_deleted_at"
        ON "${table}"("deletedAt")
        WHERE "deletedAt" IS NOT NULL
      `);
    }

    // ==================== AUDIT CHIUSURA / FORCE-CLOSE ====================
    // L'ownership di trattamenti/percorsi è derivata dalle relazioni
    // esistenti (Treatment.operatorId → Operator.appUserId; idem per
    // TherapeuticPath.primaryOperatorId): non aggiungiamo un createdByUserId
    // separato per evitare ridondanza e per non richiedere backfill sui
    // record storici.
    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD COLUMN "closedByUserId" uuid NULL,
      ADD COLUMN "forcedClosure" boolean NOT NULL DEFAULT false
    `);

    // ==================== INSTRUMENT SNAPSHOT ====================
    await queryRunner.query(`
      ALTER TABLE "treatment_instruments"
      ADD COLUMN "instrumentNameSnapshot" varchar(255) NULL,
      ADD COLUMN "brandSnapshot" varchar(255) NULL,
      ADD COLUMN "modelSnapshot" varchar(255) NULL,
      ADD COLUMN "categoryNameSnapshot" varchar(255) NULL,
      ADD COLUMN "technicalDataSnapshot" jsonb NULL,
      ADD COLUMN "snapshotTakenAt" timestamp NULL
    `);

    // ==================== RECYCLE BIN SETTINGS ====================
    // Tabella a riga singola (seed automatico): un solo record per schema tenant.
    await queryRunner.query(`
      CREATE TABLE "recycle_bin_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "retentionDays" int NULL,
        "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedByUserId" uuid NULL,
        CONSTRAINT "CK_recycle_bin_retention_min"
          CHECK ("retentionDays" IS NULL OR "retentionDays" >= 30)
      )
    `);

    await queryRunner.query(`
      INSERT INTO "recycle_bin_settings" ("retentionDays") VALUES (30)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recycle_bin_settings"`);

    await queryRunner.query(`
      ALTER TABLE "treatment_instruments"
      DROP COLUMN "snapshotTakenAt",
      DROP COLUMN "technicalDataSnapshot",
      DROP COLUMN "categoryNameSnapshot",
      DROP COLUMN "modelSnapshot",
      DROP COLUMN "brandSnapshot",
      DROP COLUMN "instrumentNameSnapshot"
    `);

    await queryRunner.query(`
      ALTER TABLE "treatments"
      DROP COLUMN "forcedClosure",
      DROP COLUMN "closedByUserId"
    `);

    for (const table of this.softDeleteTables) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_${table}_deleted_at"`,
      );
      await queryRunner.query(`
        ALTER TABLE "${table}"
        DROP COLUMN "deletedByUserId",
        DROP COLUMN "deletedAt"
      `);
    }
  }
}

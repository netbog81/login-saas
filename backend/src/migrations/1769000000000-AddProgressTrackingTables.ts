import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Progress Tracking Tables
 *
 * Aggiunge le tabelle e colonne necessarie per la Tab "Obiettivi"
 * che permette il tracking del progresso degli obiettivi (scala 0-5)
 * e delle valutazioni dei test con storico completo.
 */
export class AddProgressTrackingTables1769000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Aggiungi colonna progress_level alla tabella anamnesis_objectives
    await queryRunner.query(`
      ALTER TABLE "anamnesis_objectives"
      ADD COLUMN IF NOT EXISTS "progress_level" INT NOT NULL DEFAULT 0
    `);

    // Aggiorna gli obiettivi esistenti: raggiunto=true → progressLevel=5
    await queryRunner.query(`
      UPDATE "anamnesis_objectives"
      SET "progress_level" = 5
      WHERE "raggiunto" = true
    `);

    // 2. Crea tabella objective_progress_history (storico progressi obiettivi)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "objective_progress_history" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "objective_id" UUID NOT NULL REFERENCES "anamnesis_objectives"("id") ON DELETE CASCADE,
        "operator_id" UUID NOT NULL REFERENCES "operators"("id"),
        "previous_level" INT NOT NULL,
        "new_level" INT NOT NULL,
        "treatments_since_last" INT NOT NULL DEFAULT 0,
        "note" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW()
      )
    `);

    // Indici per objective_progress_history
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_objective_progress_history_objective"
      ON "objective_progress_history"("objective_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_objective_progress_history_created"
      ON "objective_progress_history"("created_at")
    `);

    // 3. Crea tabella test_evaluation_history (storico valutazioni test)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "test_evaluation_history" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "test_id" UUID NOT NULL REFERENCES "anamnesis_tests"("id") ON DELETE CASCADE,
        "operator_id" UUID NOT NULL REFERENCES "operators"("id"),
        "evaluation_level" INT NOT NULL,
        "note" TEXT,
        "treatments_since_last" INT NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP DEFAULT NOW()
      )
    `);

    // Indici per test_evaluation_history
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_test_evaluation_history_test"
      ON "test_evaluation_history"("test_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_test_evaluation_history_created"
      ON "test_evaluation_history"("created_at")
    `);

    console.log('✅ Progress tracking tables created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rimuovi indici
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_test_evaluation_history_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_test_evaluation_history_test"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_objective_progress_history_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_objective_progress_history_objective"`);

    // Rimuovi tabelle
    await queryRunner.query(`DROP TABLE IF EXISTS "test_evaluation_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "objective_progress_history"`);

    // Rimuovi colonna progress_level
    await queryRunner.query(`
      ALTER TABLE "anamnesis_objectives"
      DROP COLUMN IF EXISTS "progress_level"
    `);

    console.log('✅ Progress tracking tables removed successfully');
  }
}

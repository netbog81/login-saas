import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * FASE 2a: Drop FK constraints dalle tabelle anamnesis
 *
 * Primo step del rename Anamnesis → Evaluation
 * Rimuove tutte le FK constraints per permettere il rename delle tabelle
 *
 * NOTA: Questa migrazione è ROBUSTA - gestisce tabelle che potrebbero non esistere
 */
export class DropAnamnesisConstraints1770000000001 implements MigrationInterface {
    name = 'DropAnamnesisConstraints1770000000001'

    /**
     * Helper: verifica se una tabella esiste
     */
    private async tableExists(queryRunner: QueryRunner, tableName: string): Promise<boolean> {
        const result = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = $1
            ) as exists
        `, [tableName]);
        return result[0]?.exists === true;
    }

    /**
     * Helper: drop constraint se la tabella esiste
     */
    private async dropConstraintIfTableExists(
        queryRunner: QueryRunner,
        tableName: string,
        constraintName: string
    ): Promise<void> {
        const exists = await this.tableExists(queryRunner, tableName);
        if (exists) {
            await queryRunner.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${constraintName}"`);
            console.log(`    ✓ Dropped ${constraintName} from ${tableName}`);
        } else {
            console.log(`    ⏭ Skipped ${constraintName} (table ${tableName} does not exist)`);
        }
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Step 1/3: Rimozione FK constraints...');

        // FK dalle sotto-tabelle anamnesis
        await this.dropConstraintIfTableExists(queryRunner, 'anamnesis_objectives', 'FK_anamnesis_objectives_anamnesis');
        await this.dropConstraintIfTableExists(queryRunner, 'anamnesis_tests', 'FK_anamnesis_tests_anamnesis');
        await this.dropConstraintIfTableExists(queryRunner, 'anamnesis_exams', 'FK_anamnesis_exams_anamnesis');

        // FK dalla tabella principale
        await this.dropConstraintIfTableExists(queryRunner, 'patient_anamnesis', 'FK_patient_anamnesis_path');
        await this.dropConstraintIfTableExists(queryRunner, 'patient_anamnesis', 'FK_patient_anamnesis_operator');

        // FK dalle tabelle di storico (puntano a anamnesis_objectives e anamnesis_tests)
        await this.dropConstraintIfTableExists(queryRunner, 'objective_progress_history', 'FK_objective_progress_history_objective');
        await this.dropConstraintIfTableExists(queryRunner, 'test_evaluation_history', 'FK_test_evaluation_history_test');

        console.log('✅ FK constraints rimossi (o skippati se tabelle non esistono)!');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Rollback: Ricreazione FK constraints originali...');

        // Ricrea FK per tabelle storico (solo se le tabelle esistono)
        if (await this.tableExists(queryRunner, 'objective_progress_history') &&
            await this.tableExists(queryRunner, 'anamnesis_objectives')) {
            await queryRunner.query(`
                ALTER TABLE "objective_progress_history"
                DROP CONSTRAINT IF EXISTS "FK_objective_progress_history_objective"
            `);
            await queryRunner.query(`
                ALTER TABLE "objective_progress_history"
                ADD CONSTRAINT "FK_objective_progress_history_objective"
                FOREIGN KEY ("objectiveId") REFERENCES "anamnesis_objectives"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            `);
        }

        if (await this.tableExists(queryRunner, 'test_evaluation_history') &&
            await this.tableExists(queryRunner, 'anamnesis_tests')) {
            await queryRunner.query(`
                ALTER TABLE "test_evaluation_history"
                DROP CONSTRAINT IF EXISTS "FK_test_evaluation_history_test"
            `);
            await queryRunner.query(`
                ALTER TABLE "test_evaluation_history"
                ADD CONSTRAINT "FK_test_evaluation_history_test"
                FOREIGN KEY ("testId") REFERENCES "anamnesis_tests"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            `);
        }

        // Ricrea FK per sotto-tabelle
        if (await this.tableExists(queryRunner, 'anamnesis_objectives') &&
            await this.tableExists(queryRunner, 'patient_anamnesis')) {
            await queryRunner.query(`
                ALTER TABLE "anamnesis_objectives"
                DROP CONSTRAINT IF EXISTS "FK_anamnesis_objectives_anamnesis"
            `);
            await queryRunner.query(`
                ALTER TABLE "anamnesis_objectives"
                ADD CONSTRAINT "FK_anamnesis_objectives_anamnesis"
                FOREIGN KEY ("anamnesisId") REFERENCES "patient_anamnesis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            `);
        }

        if (await this.tableExists(queryRunner, 'anamnesis_tests') &&
            await this.tableExists(queryRunner, 'patient_anamnesis')) {
            await queryRunner.query(`
                ALTER TABLE "anamnesis_tests"
                DROP CONSTRAINT IF EXISTS "FK_anamnesis_tests_anamnesis"
            `);
            await queryRunner.query(`
                ALTER TABLE "anamnesis_tests"
                ADD CONSTRAINT "FK_anamnesis_tests_anamnesis"
                FOREIGN KEY ("anamnesisId") REFERENCES "patient_anamnesis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            `);
        }

        if (await this.tableExists(queryRunner, 'anamnesis_exams') &&
            await this.tableExists(queryRunner, 'patient_anamnesis')) {
            await queryRunner.query(`
                ALTER TABLE "anamnesis_exams"
                DROP CONSTRAINT IF EXISTS "FK_anamnesis_exams_anamnesis"
            `);
            await queryRunner.query(`
                ALTER TABLE "anamnesis_exams"
                ADD CONSTRAINT "FK_anamnesis_exams_anamnesis"
                FOREIGN KEY ("anamnesisId") REFERENCES "patient_anamnesis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            `);
        }

        // Ricrea FK per tabella principale
        if (await this.tableExists(queryRunner, 'patient_anamnesis')) {
            await queryRunner.query(`
                ALTER TABLE "patient_anamnesis"
                DROP CONSTRAINT IF EXISTS "FK_patient_anamnesis_path"
            `);
            await queryRunner.query(`
                ALTER TABLE "patient_anamnesis"
                ADD CONSTRAINT "FK_patient_anamnesis_path"
                FOREIGN KEY ("therapeuticPathId") REFERENCES "therapeutic_paths"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            `);
            await queryRunner.query(`
                ALTER TABLE "patient_anamnesis"
                DROP CONSTRAINT IF EXISTS "FK_patient_anamnesis_operator"
            `);
            await queryRunner.query(`
                ALTER TABLE "patient_anamnesis"
                ADD CONSTRAINT "FK_patient_anamnesis_operator"
                FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE NO ACTION
            `);
        }

        console.log('✅ FK constraints ricreati!');
    }
}

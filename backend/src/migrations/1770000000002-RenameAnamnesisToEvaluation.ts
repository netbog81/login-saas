import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * FASE 2b: Rename tabelle, colonne, indici, constraints e enum
 *
 * Secondo step del rename Anamnesis → Evaluation
 * PREREQUISITO: Migration 1770000000001a deve essere già eseguita (FK rimossi)
 *
 * NOTA: Questa migrazione è ROBUSTA - gestisce tabelle che potrebbero non esistere
 */
export class RenameAnamnesisToEvaluation1770000000002 implements MigrationInterface {
    name = 'RenameAnamnesisToEvaluation1770000000002'

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
     * Helper: verifica se un enum type esiste
     */
    private async enumExists(queryRunner: QueryRunner, enumName: string): Promise<boolean> {
        const result = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 FROM pg_type
                WHERE typname = $1
            ) as exists
        `, [enumName]);
        return result[0]?.exists === true;
    }

    /**
     * Helper: verifica se una colonna esiste in una tabella
     */
    private async columnExists(queryRunner: QueryRunner, tableName: string, columnName: string): Promise<boolean> {
        const result = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = $1
                AND column_name = $2
            ) as exists
        `, [tableName, columnName]);
        return result[0]?.exists === true;
    }

    /**
     * Helper: verifica se un constraint esiste
     */
    private async constraintExists(queryRunner: QueryRunner, constraintName: string): Promise<boolean> {
        const result = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = $1
            ) as exists
        `, [constraintName]);
        return result[0]?.exists === true;
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Step 2/3: Rename Anamnesis → Evaluation...');

        // ========== STEP 1: Rename tabelle principali ==========
        console.log('  1/5 Rename tabelle...');

        // patient_anamnesis → patient_evaluations
        const patientAnamnesisExists = await this.tableExists(queryRunner, 'patient_anamnesis');
        const patientEvaluationsExists = await this.tableExists(queryRunner, 'patient_evaluations');

        if (patientAnamnesisExists && !patientEvaluationsExists) {
            await queryRunner.query(`ALTER TABLE "patient_anamnesis" RENAME TO "patient_evaluations"`);
            console.log('    ✓ patient_anamnesis → patient_evaluations');
        } else if (patientEvaluationsExists) {
            console.log('    ⏭ patient_evaluations already exists (skipping rename)');
        } else {
            console.log('    ⚠ Neither patient_anamnesis nor patient_evaluations exist');
        }

        // anamnesis_objectives → evaluation_objectives
        if (await this.tableExists(queryRunner, 'anamnesis_objectives')) {
            await queryRunner.query(`ALTER TABLE "anamnesis_objectives" RENAME TO "evaluation_objectives"`);
            console.log('    ✓ anamnesis_objectives → evaluation_objectives');
        } else if (await this.tableExists(queryRunner, 'evaluation_objectives')) {
            console.log('    ⏭ evaluation_objectives already exists');
        } else {
            console.log('    ⏭ anamnesis_objectives does not exist (skipping)');
        }

        // anamnesis_tests → evaluation_tests
        if (await this.tableExists(queryRunner, 'anamnesis_tests')) {
            await queryRunner.query(`ALTER TABLE "anamnesis_tests" RENAME TO "evaluation_tests"`);
            console.log('    ✓ anamnesis_tests → evaluation_tests');
        } else if (await this.tableExists(queryRunner, 'evaluation_tests')) {
            console.log('    ⏭ evaluation_tests already exists');
        } else {
            console.log('    ⏭ anamnesis_tests does not exist (skipping)');
        }

        // anamnesis_exams → evaluation_exams
        if (await this.tableExists(queryRunner, 'anamnesis_exams')) {
            await queryRunner.query(`ALTER TABLE "anamnesis_exams" RENAME TO "evaluation_exams"`);
            console.log('    ✓ anamnesis_exams → evaluation_exams');
        } else if (await this.tableExists(queryRunner, 'evaluation_exams')) {
            console.log('    ⏭ evaluation_exams already exists');
        } else {
            console.log('    ⏭ anamnesis_exams does not exist (skipping)');
        }

        // ========== STEP 2: Rename colonne FK (anamnesisId → evaluationId) ==========
        console.log('  2/5 Rename colonne FK...');

        if (await this.tableExists(queryRunner, 'evaluation_objectives')) {
            if (await this.columnExists(queryRunner, 'evaluation_objectives', 'anamnesisId')) {
                await queryRunner.query(`ALTER TABLE "evaluation_objectives" RENAME COLUMN "anamnesisId" TO "evaluationId"`);
                console.log('    ✓ evaluation_objectives.anamnesisId → evaluationId');
            } else {
                console.log('    ⏭ evaluation_objectives.evaluationId already exists or anamnesisId missing');
            }
        }

        if (await this.tableExists(queryRunner, 'evaluation_tests')) {
            if (await this.columnExists(queryRunner, 'evaluation_tests', 'anamnesisId')) {
                await queryRunner.query(`ALTER TABLE "evaluation_tests" RENAME COLUMN "anamnesisId" TO "evaluationId"`);
                console.log('    ✓ evaluation_tests.anamnesisId → evaluationId');
            } else {
                console.log('    ⏭ evaluation_tests.evaluationId already exists or anamnesisId missing');
            }
        }

        if (await this.tableExists(queryRunner, 'evaluation_exams')) {
            if (await this.columnExists(queryRunner, 'evaluation_exams', 'anamnesisId')) {
                await queryRunner.query(`ALTER TABLE "evaluation_exams" RENAME COLUMN "anamnesisId" TO "evaluationId"`);
                console.log('    ✓ evaluation_exams.anamnesisId → evaluationId');
            } else {
                console.log('    ⏭ evaluation_exams.evaluationId already exists or anamnesisId missing');
            }
        }

        // ========== STEP 3: Rename indici ==========
        console.log('  3/5 Rename indici...');
        // Usiamo IF EXISTS per sicurezza
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_patient_anamnesis_path" RENAME TO "IDX_patient_evaluations_path"`);
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_patient_anamnesis_operator" RENAME TO "IDX_patient_evaluations_operator"`);
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_anamnesis_objectives_anamnesis" RENAME TO "IDX_evaluation_objectives_evaluation"`);
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_anamnesis_objectives_tipo" RENAME TO "IDX_evaluation_objectives_tipo"`);
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_anamnesis_tests_anamnesis" RENAME TO "IDX_evaluation_tests_evaluation"`);
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_anamnesis_tests_sezione" RENAME TO "IDX_evaluation_tests_sezione"`);
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_anamnesis_exams_anamnesis" RENAME TO "IDX_evaluation_exams_evaluation"`);
        console.log('    ✓ Indici rinominati (se esistevano)');

        // ========== STEP 4: Rename primary key e unique constraints ==========
        console.log('  4/5 Rename PK e unique constraints...');

        if (await this.tableExists(queryRunner, 'patient_evaluations')) {
            if (await this.constraintExists(queryRunner, 'PK_patient_anamnesis')) {
                await queryRunner.query(`ALTER TABLE "patient_evaluations" RENAME CONSTRAINT "PK_patient_anamnesis" TO "PK_patient_evaluations"`);
            }
            if (await this.constraintExists(queryRunner, 'UQ_patient_anamnesis_path')) {
                await queryRunner.query(`ALTER TABLE "patient_evaluations" RENAME CONSTRAINT "UQ_patient_anamnesis_path" TO "UQ_patient_evaluations_path"`);
            }
        }

        if (await this.tableExists(queryRunner, 'evaluation_objectives') && await this.constraintExists(queryRunner, 'PK_anamnesis_objectives')) {
            await queryRunner.query(`ALTER TABLE "evaluation_objectives" RENAME CONSTRAINT "PK_anamnesis_objectives" TO "PK_evaluation_objectives"`);
        }

        if (await this.tableExists(queryRunner, 'evaluation_tests') && await this.constraintExists(queryRunner, 'PK_anamnesis_tests')) {
            await queryRunner.query(`ALTER TABLE "evaluation_tests" RENAME CONSTRAINT "PK_anamnesis_tests" TO "PK_evaluation_tests"`);
        }

        if (await this.tableExists(queryRunner, 'evaluation_exams') && await this.constraintExists(queryRunner, 'PK_anamnesis_exams')) {
            await queryRunner.query(`ALTER TABLE "evaluation_exams" RENAME CONSTRAINT "PK_anamnesis_exams" TO "PK_evaluation_exams"`);
        }

        console.log('    ✓ PK/UQ constraints rinominati (se esistevano)');

        // ========== STEP 5: Rename enum types ==========
        console.log('  5/5 Rename enum types...');

        if (await this.enumExists(queryRunner, 'anamnesis_objectives_tipo_enum')) {
            await queryRunner.query(`ALTER TYPE "public"."anamnesis_objectives_tipo_enum" RENAME TO "evaluation_objectives_tipo_enum"`);
            console.log('    ✓ anamnesis_objectives_tipo_enum → evaluation_objectives_tipo_enum');
        } else {
            console.log('    ⏭ anamnesis_objectives_tipo_enum does not exist (skipping)');
        }

        if (await this.enumExists(queryRunner, 'anamnesis_tests_sezione_enum')) {
            await queryRunner.query(`ALTER TYPE "public"."anamnesis_tests_sezione_enum" RENAME TO "evaluation_tests_sezione_enum"`);
            console.log('    ✓ anamnesis_tests_sezione_enum → evaluation_tests_sezione_enum');
        } else {
            console.log('    ⏭ anamnesis_tests_sezione_enum does not exist (skipping)');
        }

        console.log('✅ Rename completato!');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Rollback: Rename Evaluation → Anamnesis...');

        // ========== STEP 1: Rename enum types back ==========
        if (await this.enumExists(queryRunner, 'evaluation_objectives_tipo_enum')) {
            await queryRunner.query(`ALTER TYPE "public"."evaluation_objectives_tipo_enum" RENAME TO "anamnesis_objectives_tipo_enum"`);
        }
        if (await this.enumExists(queryRunner, 'evaluation_tests_sezione_enum')) {
            await queryRunner.query(`ALTER TYPE "public"."evaluation_tests_sezione_enum" RENAME TO "anamnesis_tests_sezione_enum"`);
        }

        // ========== STEP 2: Rename PK e unique constraints back ==========
        if (await this.tableExists(queryRunner, 'patient_evaluations')) {
            if (await this.constraintExists(queryRunner, 'UQ_patient_evaluations_path')) {
                await queryRunner.query(`ALTER TABLE "patient_evaluations" RENAME CONSTRAINT "UQ_patient_evaluations_path" TO "UQ_patient_anamnesis_path"`);
            }
            if (await this.constraintExists(queryRunner, 'PK_patient_evaluations')) {
                await queryRunner.query(`ALTER TABLE "patient_evaluations" RENAME CONSTRAINT "PK_patient_evaluations" TO "PK_patient_anamnesis"`);
            }
        }

        if (await this.tableExists(queryRunner, 'evaluation_objectives') && await this.constraintExists(queryRunner, 'PK_evaluation_objectives')) {
            await queryRunner.query(`ALTER TABLE "evaluation_objectives" RENAME CONSTRAINT "PK_evaluation_objectives" TO "PK_anamnesis_objectives"`);
        }
        if (await this.tableExists(queryRunner, 'evaluation_tests') && await this.constraintExists(queryRunner, 'PK_evaluation_tests')) {
            await queryRunner.query(`ALTER TABLE "evaluation_tests" RENAME CONSTRAINT "PK_evaluation_tests" TO "PK_anamnesis_tests"`);
        }
        if (await this.tableExists(queryRunner, 'evaluation_exams') && await this.constraintExists(queryRunner, 'PK_evaluation_exams')) {
            await queryRunner.query(`ALTER TABLE "evaluation_exams" RENAME CONSTRAINT "PK_evaluation_exams" TO "PK_anamnesis_exams"`);
        }

        // ========== STEP 3: Rename indici back ==========
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_patient_evaluations_path" RENAME TO "IDX_patient_anamnesis_path"`);
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_patient_evaluations_operator" RENAME TO "IDX_patient_anamnesis_operator"`);
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_evaluation_objectives_evaluation" RENAME TO "IDX_anamnesis_objectives_anamnesis"`);
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_evaluation_objectives_tipo" RENAME TO "IDX_anamnesis_objectives_tipo"`);
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_evaluation_tests_evaluation" RENAME TO "IDX_anamnesis_tests_anamnesis"`);
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_evaluation_tests_sezione" RENAME TO "IDX_anamnesis_tests_sezione"`);
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_evaluation_exams_evaluation" RENAME TO "IDX_anamnesis_exams_anamnesis"`);

        // ========== STEP 4: Rename colonne FK back ==========
        if (await this.tableExists(queryRunner, 'evaluation_objectives') && await this.columnExists(queryRunner, 'evaluation_objectives', 'evaluationId')) {
            await queryRunner.query(`ALTER TABLE "evaluation_objectives" RENAME COLUMN "evaluationId" TO "anamnesisId"`);
        }
        if (await this.tableExists(queryRunner, 'evaluation_tests') && await this.columnExists(queryRunner, 'evaluation_tests', 'evaluationId')) {
            await queryRunner.query(`ALTER TABLE "evaluation_tests" RENAME COLUMN "evaluationId" TO "anamnesisId"`);
        }
        if (await this.tableExists(queryRunner, 'evaluation_exams') && await this.columnExists(queryRunner, 'evaluation_exams', 'evaluationId')) {
            await queryRunner.query(`ALTER TABLE "evaluation_exams" RENAME COLUMN "evaluationId" TO "anamnesisId"`);
        }

        // ========== STEP 5: Rename tabelle back ==========
        if (await this.tableExists(queryRunner, 'patient_evaluations')) {
            await queryRunner.query(`ALTER TABLE "patient_evaluations" RENAME TO "patient_anamnesis"`);
        }
        if (await this.tableExists(queryRunner, 'evaluation_objectives')) {
            await queryRunner.query(`ALTER TABLE "evaluation_objectives" RENAME TO "anamnesis_objectives"`);
        }
        if (await this.tableExists(queryRunner, 'evaluation_tests')) {
            await queryRunner.query(`ALTER TABLE "evaluation_tests" RENAME TO "anamnesis_tests"`);
        }
        if (await this.tableExists(queryRunner, 'evaluation_exams')) {
            await queryRunner.query(`ALTER TABLE "evaluation_exams" RENAME TO "anamnesis_exams"`);
        }

        console.log('✅ Rollback completato!');
    }
}

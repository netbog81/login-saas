import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * FASE 2c: Ricrea FK constraints con i nuovi nomi
 *
 * Terzo step del rename Anamnesis → Evaluation
 * PREREQUISITO: Migration 1770000000001b deve essere già eseguita (tabelle rinominate)
 *
 * NOTA: Questa migrazione è ROBUSTA e IDEMPOTENTE:
 * - Verifica esistenza tabelle prima di operare
 * - Elimina vincoli esistenti prima di ricrearli
 * - Può essere eseguita multiple volte senza errori
 */
export class AddEvaluationConstraints1770000000003 implements MigrationInterface {
    name = 'AddEvaluationConstraints1770000000003'

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
     * Helper: aggiunge FK constraint in modo sicuro (drop + add)
     */
    private async safeAddForeignKey(
        queryRunner: QueryRunner,
        tableName: string,
        constraintName: string,
        columnName: string,
        referencedTable: string,
        referencedColumn: string,
        onDelete: string = 'CASCADE',
        onUpdate: string = 'NO ACTION'
    ): Promise<void> {
        // Prima verifica che la tabella esista
        if (!await this.tableExists(queryRunner, tableName)) {
            console.log(`    ⏭ ${constraintName}: table ${tableName} does not exist (skipping)`);
            return;
        }

        // Verifica che la tabella referenziata esista
        if (!await this.tableExists(queryRunner, referencedTable)) {
            console.log(`    ⏭ ${constraintName}: referenced table ${referencedTable} does not exist (skipping)`);
            return;
        }

        // Drop se esiste, poi crea
        await queryRunner.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${constraintName}"`);
        await queryRunner.query(`
            ALTER TABLE "${tableName}"
            ADD CONSTRAINT "${constraintName}"
            FOREIGN KEY ("${columnName}") REFERENCES "${referencedTable}"("${referencedColumn}") ON DELETE ${onDelete} ON UPDATE ${onUpdate}
        `);
        console.log(`    ✓ ${constraintName} added to ${tableName}`);
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Step 3/3: Ricreazione FK constraints...');

        // ========== FK per patient_evaluations ==========
        console.log('  → patient_evaluations FK...');
        await this.safeAddForeignKey(
            queryRunner,
            'patient_evaluations',
            'FK_patient_evaluations_path',
            'therapeuticPathId',
            'therapeutic_paths',
            'id',
            'CASCADE'
        );
        await this.safeAddForeignKey(
            queryRunner,
            'patient_evaluations',
            'FK_patient_evaluations_operator',
            'operatorId',
            'operators',
            'id',
            'SET NULL'
        );

        // ========== FK per evaluation_objectives ==========
        console.log('  → evaluation_objectives FK...');
        await this.safeAddForeignKey(
            queryRunner,
            'evaluation_objectives',
            'FK_evaluation_objectives_evaluation',
            'evaluationId',
            'patient_evaluations',
            'id',
            'CASCADE'
        );

        // ========== FK per evaluation_tests ==========
        console.log('  → evaluation_tests FK...');
        await this.safeAddForeignKey(
            queryRunner,
            'evaluation_tests',
            'FK_evaluation_tests_evaluation',
            'evaluationId',
            'patient_evaluations',
            'id',
            'CASCADE'
        );

        // ========== FK per evaluation_exams ==========
        console.log('  → evaluation_exams FK...');
        await this.safeAddForeignKey(
            queryRunner,
            'evaluation_exams',
            'FK_evaluation_exams_evaluation',
            'evaluationId',
            'patient_evaluations',
            'id',
            'CASCADE'
        );

        // ========== FK per tabelle di storico ==========
        // NOTA: Le colonne nel DB usano snake_case (objective_id, test_id)
        console.log('  → history tables FK...');
        await this.safeAddForeignKey(
            queryRunner,
            'objective_progress_history',
            'FK_objective_progress_history_objective',
            'objective_id',  // snake_case nel DB
            'evaluation_objectives',
            'id',
            'CASCADE'
        );
        await this.safeAddForeignKey(
            queryRunner,
            'test_evaluation_history',
            'FK_test_evaluation_history_test',
            'test_id',  // snake_case nel DB
            'evaluation_tests',
            'id',
            'CASCADE'
        );

        console.log('✅ FK constraints ricreati (dove le tabelle esistono)!');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Rollback: Rimozione FK constraints...');

        // Drop FK in modo sicuro (solo se la tabella esiste)
        const tablesToCheck = [
            { table: 'objective_progress_history', constraint: 'FK_objective_progress_history_objective' },
            { table: 'test_evaluation_history', constraint: 'FK_test_evaluation_history_test' },
            { table: 'evaluation_objectives', constraint: 'FK_evaluation_objectives_evaluation' },
            { table: 'evaluation_tests', constraint: 'FK_evaluation_tests_evaluation' },
            { table: 'evaluation_exams', constraint: 'FK_evaluation_exams_evaluation' },
            { table: 'patient_evaluations', constraint: 'FK_patient_evaluations_path' },
            { table: 'patient_evaluations', constraint: 'FK_patient_evaluations_operator' },
        ];

        for (const { table, constraint } of tablesToCheck) {
            if (await this.tableExists(queryRunner, table)) {
                await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${constraint}"`);
                console.log(`    ✓ Dropped ${constraint}`);
            } else {
                console.log(`    ⏭ ${constraint}: table ${table} does not exist (skipping)`);
            }
        }

        console.log('✅ FK constraints rimossi!');
    }
}

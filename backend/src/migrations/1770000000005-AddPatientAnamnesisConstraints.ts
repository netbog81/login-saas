import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * FASE 5b: Aggiunge indici e FK constraints alla tabella patient_anamnesis
 *
 * PREREQUISITO: Migration 1770000000002a deve essere già eseguita (tabella creata)
 */
export class AddPatientAnamnesisConstraints1770000000005 implements MigrationInterface {
    name = 'AddPatientAnamnesisConstraints1770000000005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Aggiunta indici e FK a patient_anamnesis...');

        // Creazione indici
        console.log('  1/2 Creazione indici...');
        await queryRunner.query(`
            CREATE INDEX "IDX_patient_anamnesis_patient" ON "patient_anamnesis" ("patient_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_patient_anamnesis_operator" ON "patient_anamnesis" ("operator_id")
        `);

        // Creazione FK constraints
        console.log('  2/2 Creazione FK constraints...');
        await queryRunner.query(`
            ALTER TABLE "patient_anamnesis"
            ADD CONSTRAINT "FK_patient_anamnesis_patient"
            FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "patient_anamnesis"
            ADD CONSTRAINT "FK_patient_anamnesis_operator"
            FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        console.log('✅ Indici e FK aggiunti!');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Rollback: rimozione indici e FK da patient_anamnesis...');

        // Drop FK constraints
        await queryRunner.query(`ALTER TABLE "patient_anamnesis" DROP CONSTRAINT IF EXISTS "FK_patient_anamnesis_operator"`);
        await queryRunner.query(`ALTER TABLE "patient_anamnesis" DROP CONSTRAINT IF EXISTS "FK_patient_anamnesis_patient"`);

        // Drop indici
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_patient_anamnesis_operator"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_patient_anamnesis_patient"`);

        console.log('✅ Rollback completato!');
    }
}

import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * FASE 1.1: Rimuove la tabella patient_evaluations legacy (inutilizzata)
 * Questa tabella era stata creata per un sistema di template dinamici mai implementato.
 * Deve essere rimossa prima di rinominare patient_anamnesis → patient_evaluations.
 */
export class RemoveLegacyPatientEvaluations1770000000000 implements MigrationInterface {
    name = 'RemoveLegacyPatientEvaluations1770000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Verifica se la tabella esiste prima di eliminarla
        const tableExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'patient_evaluations'
            );
        `);

        if (tableExists[0]?.exists) {
            // Rimuovi eventuali foreign key constraints
            await queryRunner.query(`
                ALTER TABLE "patient_evaluations"
                DROP CONSTRAINT IF EXISTS "FK_patient_evaluations_path"
            `);
            await queryRunner.query(`
                ALTER TABLE "patient_evaluations"
                DROP CONSTRAINT IF EXISTS "FK_patient_evaluations_operator"
            `);

            // Rimuovi indici
            await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_evaluations_path"`);
            await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_evaluations_operator"`);

            // Elimina la tabella
            await queryRunner.query(`DROP TABLE IF EXISTS "patient_evaluations" CASCADE`);

            console.log('✅ Tabella patient_evaluations (legacy) eliminata con successo');
        } else {
            console.log('ℹ️ Tabella patient_evaluations non esiste, skip');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Ricrea la tabella legacy (per rollback)
        await queryRunner.query(`
            CREATE TABLE "patient_evaluations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "therapeuticPathId" uuid NOT NULL,
                "operatorId" uuid NOT NULL,
                "templateId" uuid,
                "chiefComplaint" text,
                "historyOfPresentIllness" text,
                "aggravatingFactors" text,
                "relievingFactors" text,
                "patientGoals" text,
                "therapistGoals" text,
                "functionalAssessment" text,
                "conclusions" text,
                "fieldValues" jsonb,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_patient_evaluations" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX "IDX_patient_evaluations_path" ON "patient_evaluations" ("therapeuticPathId")`);
        await queryRunner.query(`CREATE INDEX "IDX_patient_evaluations_operator" ON "patient_evaluations" ("operatorId")`);

        await queryRunner.query(`
            ALTER TABLE "patient_evaluations"
            ADD CONSTRAINT "FK_patient_evaluations_path"
            FOREIGN KEY ("therapeuticPathId") REFERENCES "therapeutic_paths"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "patient_evaluations"
            ADD CONSTRAINT "FK_patient_evaluations_operator"
            FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        console.log('✅ Tabella patient_evaluations (legacy) ricreata per rollback');
    }
}

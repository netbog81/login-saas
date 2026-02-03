import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * FASE 5a: Crea nuova tabella patient_anamnesis (solo struttura)
 *
 * Questa tabella contiene l'anamnesi del paziente (indipendente dal percorso terapeutico).
 * Relazione 1:1 con Patient.
 *
 * Campi:
 * - patologiePregresse: storia patologica remota
 * - interventiChirurgici: interventi subiti
 * - traumi: traumi significativi
 * - terapiaFarmacologica: farmaci in uso (array)
 * - allergie: allergie note (NUOVO)
 * - storiaFamiliare: anamnesi familiare (NUOVO)
 *
 * NOTA: Questa migrazione è IDEMPOTENTE - verifica se la tabella esiste già
 */
export class CreatePatientAnamnesisTable1770000000004 implements MigrationInterface {
    name = 'CreatePatientAnamnesisTable1770000000004'

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

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Creazione tabella patient_anamnesis (struttura)...');

        // Verifica se la tabella esiste già
        if (await this.tableExists(queryRunner, 'patient_anamnesis')) {
            console.log('    ⏭ patient_anamnesis already exists (skipping creation)');
            return;
        }

        await queryRunner.query(`
            CREATE TABLE "patient_anamnesis" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "patient_id" integer NOT NULL,
                "operator_id" uuid,

                -- Anamnesi Patologica Remota
                "patologie_pregresse" text,
                "interventi_chirurgici" text,
                "traumi" text,
                "terapia_farmacologica" varchar[] DEFAULT '{}',

                -- Nuovi campi
                "allergie" text,
                "storia_familiare" text,

                -- Note generali
                "note" text,

                -- Audit
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),

                CONSTRAINT "PK_patient_anamnesis" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_patient_anamnesis_patient" UNIQUE ("patient_id")
            )
        `);

        console.log('✅ Tabella patient_anamnesis creata!');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Rollback: eliminazione tabella patient_anamnesis...');

        await queryRunner.query(`DROP TABLE IF EXISTS "patient_anamnesis"`);

        console.log('✅ Rollback completato!');
    }
}

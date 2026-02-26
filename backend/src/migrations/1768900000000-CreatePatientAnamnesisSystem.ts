import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePatientAnamnesisSystem1768900000000 implements MigrationInterface {
    name = 'CreatePatientAnamnesisSystem1768900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create objective_type enum
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."anamnesis_objectives_tipo_enum" AS ENUM('breve_termine', 'medio_termine', 'lungo_termine'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

        // 2. Create test_section enum
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."anamnesis_tests_sezione_enum" AS ENUM('esame_obiettivo', 'monitoraggio'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

        // 3. Create patient_anamnesis table (main entity with all 8 sections)
        await queryRunner.query(`
            CREATE TABLE "patient_anamnesis" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "therapeuticPathId" uuid NOT NULL,
                "operatorId" uuid NOT NULL,

                -- Sezione 1: Informazioni Generali
                "professione" character varying(255),
                "sportPraticati" character varying[] DEFAULT '{}',
                "bmi" decimal(5,2),

                -- Sezione 2: Immagine Corporea (JSONB for markers)
                "bodyMapMarkers" jsonb DEFAULT '[]',

                -- Sezione 3: Anamnesi Patologica Remota
                "patologiePregresse" text,
                "interventiChirurgici" text,
                "traumi" text,
                "terapiaFarmacologica" character varying[] DEFAULT '{}',

                -- Sezione 4: Anamnesi Patologica Prossima
                "motivoConsulto" text,
                "esordioSintomi" text,
                "statoAttualeSintomi" text,
                "fattoriAllevianti" character varying[] DEFAULT '{}',
                "fattoriAggravanti" character varying[] DEFAULT '{}',
                "andamentoDolore" text,

                -- Sezione 5: Esame Obiettivo
                "osservazione" text,
                "palpazione" text,
                "movimentoPassivo" text,
                "movimentoAttivo" text,
                "forzaMuscolare" text,
                "equilibrio" text,
                "esameNeurologico" text,
                "limitazioniAttivita" text,
                "fattoriPrognosticiPositivi" text,
                "fattoriPrognosticiNegativi" text,
                "strategieCoping" text,
                "diagnosiFisioterapica" text,

                -- Sezione 7: Pianificazione Trattamento
                "interventiProposti" character varying[] DEFAULT '{}',
                "frequenzaSedute" character varying(255),

                -- Sezione 8: Monitoraggio
                "outcome" text,
                "criticita" character varying[] DEFAULT '{}',

                -- Audit fields
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

                CONSTRAINT "PK_patient_anamnesis" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_patient_anamnesis_path" UNIQUE ("therapeuticPathId")
            )
        `);

        // 4. Create anamnesis_objectives table (for Sezione 7 goals - reused in Valutazione Trattamento)
        await queryRunner.query(`
            CREATE TABLE "anamnesis_objectives" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "anamnesisId" uuid NOT NULL,
                "tipo" "public"."anamnesis_objectives_tipo_enum" NOT NULL,
                "descrizione" character varying(500) NOT NULL,
                "raggiunto" boolean NOT NULL DEFAULT false,
                "dataRaggiungimento" TIMESTAMP,
                "orderIndex" integer NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_anamnesis_objectives" PRIMARY KEY ("id")
            )
        `);

        // 5. Create anamnesis_tests table (for Sezione 5 and 8 tests - reused in Valutazione Trattamento)
        await queryRunner.query(`
            CREATE TABLE "anamnesis_tests" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "anamnesisId" uuid NOT NULL,
                "sezione" "public"."anamnesis_tests_sezione_enum" NOT NULL,
                "nome" character varying(255) NOT NULL,
                "risultato" character varying(500),
                "superato" boolean,
                "dataEsecuzione" TIMESTAMP,
                "orderIndex" integer NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_anamnesis_tests" PRIMARY KEY ("id")
            )
        `);

        // 6. Create anamnesis_exams table (for Sezione 6 diagnostic exams)
        await queryRunner.query(`
            CREATE TABLE "anamnesis_exams" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "anamnesisId" uuid NOT NULL,
                "nomeEsame" character varying(255) NOT NULL,
                "data" TIMESTAMP,
                "note" text,
                "orderIndex" integer NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_anamnesis_exams" PRIMARY KEY ("id")
            )
        `);

        // 7. Create indexes for patient_anamnesis
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_patient_anamnesis_path" ON "patient_anamnesis" ("therapeuticPathId")`);
        await queryRunner.query(`CREATE INDEX "IDX_patient_anamnesis_operator" ON "patient_anamnesis" ("operatorId")`);

        // 8. Create indexes for anamnesis_objectives
        await queryRunner.query(`CREATE INDEX "IDX_anamnesis_objectives_anamnesis" ON "anamnesis_objectives" ("anamnesisId")`);
        await queryRunner.query(`CREATE INDEX "IDX_anamnesis_objectives_tipo" ON "anamnesis_objectives" ("tipo")`);

        // 9. Create indexes for anamnesis_tests
        await queryRunner.query(`CREATE INDEX "IDX_anamnesis_tests_anamnesis" ON "anamnesis_tests" ("anamnesisId")`);
        await queryRunner.query(`CREATE INDEX "IDX_anamnesis_tests_sezione" ON "anamnesis_tests" ("sezione")`);

        // 10. Create indexes for anamnesis_exams
        await queryRunner.query(`CREATE INDEX "IDX_anamnesis_exams_anamnesis" ON "anamnesis_exams" ("anamnesisId")`);

        // 11. Add foreign key constraints for patient_anamnesis
        await queryRunner.query(`
            ALTER TABLE "patient_anamnesis"
            ADD CONSTRAINT "FK_patient_anamnesis_path"
            FOREIGN KEY ("therapeuticPathId") REFERENCES "therapeutic_paths"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "patient_anamnesis"
            ADD CONSTRAINT "FK_patient_anamnesis_operator"
            FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        // 12. Add foreign key constraints for anamnesis_objectives
        await queryRunner.query(`
            ALTER TABLE "anamnesis_objectives"
            ADD CONSTRAINT "FK_anamnesis_objectives_anamnesis"
            FOREIGN KEY ("anamnesisId") REFERENCES "patient_anamnesis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        // 13. Add foreign key constraints for anamnesis_tests
        await queryRunner.query(`
            ALTER TABLE "anamnesis_tests"
            ADD CONSTRAINT "FK_anamnesis_tests_anamnesis"
            FOREIGN KEY ("anamnesisId") REFERENCES "patient_anamnesis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        // 14. Add foreign key constraints for anamnesis_exams
        await queryRunner.query(`
            ALTER TABLE "anamnesis_exams"
            ADD CONSTRAINT "FK_anamnesis_exams_anamnesis"
            FOREIGN KEY ("anamnesisId") REFERENCES "patient_anamnesis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign keys for anamnesis_exams
        await queryRunner.query(`ALTER TABLE "anamnesis_exams" DROP CONSTRAINT IF EXISTS "FK_anamnesis_exams_anamnesis"`);

        // Drop foreign keys for anamnesis_tests
        await queryRunner.query(`ALTER TABLE "anamnesis_tests" DROP CONSTRAINT IF EXISTS "FK_anamnesis_tests_anamnesis"`);

        // Drop foreign keys for anamnesis_objectives
        await queryRunner.query(`ALTER TABLE "anamnesis_objectives" DROP CONSTRAINT IF EXISTS "FK_anamnesis_objectives_anamnesis"`);

        // Drop foreign keys for patient_anamnesis
        await queryRunner.query(`ALTER TABLE "patient_anamnesis" DROP CONSTRAINT IF EXISTS "FK_patient_anamnesis_operator"`);
        await queryRunner.query(`ALTER TABLE "patient_anamnesis" DROP CONSTRAINT IF EXISTS "FK_patient_anamnesis_path"`);

        // Drop indexes for anamnesis_exams
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_anamnesis_exams_anamnesis"`);

        // Drop indexes for anamnesis_tests
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_anamnesis_tests_sezione"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_anamnesis_tests_anamnesis"`);

        // Drop indexes for anamnesis_objectives
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_anamnesis_objectives_tipo"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_anamnesis_objectives_anamnesis"`);

        // Drop indexes for patient_anamnesis
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_anamnesis_operator"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_anamnesis_path"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS "anamnesis_exams"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "anamnesis_tests"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "anamnesis_objectives"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "patient_anamnesis"`);

        // Drop enums
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."anamnesis_tests_sezione_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."anamnesis_objectives_tipo_enum"`);
    }
}

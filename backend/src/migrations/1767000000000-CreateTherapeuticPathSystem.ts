import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTherapeuticPathSystem1767000000000 implements MigrationInterface {
    name = 'CreateTherapeuticPathSystem1767000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create therapeutic_path_status enum
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."therapeutic_paths_status_enum" AS ENUM('active', 'suspended', 'completed', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

        // 2. Create document_type enum
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."path_documents_type_enum" AS ENUM('pdf', 'image', 'video', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

        // 3. Create document_category enum
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."path_documents_category_enum" AS ENUM('prescription', 'report', 'radiology', 'consent', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

        // 4. Create therapeutic_paths table
        await queryRunner.query(`
            CREATE TABLE "therapeutic_paths" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "patientId" integer NOT NULL,
                "primaryOperatorId" uuid NOT NULL,
                "name" character varying(255) NOT NULL,
                "diagnosis" text,
                "icdCode" character varying(20),
                "status" "public"."therapeutic_paths_status_enum" NOT NULL DEFAULT 'active',
                "externalDoctorName" character varying(255),
                "externalPrescriptionRef" character varying(255),
                "notes" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "closedAt" TIMESTAMP,
                CONSTRAINT "PK_therapeutic_paths" PRIMARY KEY ("id")
            )
        `);

        // 5. Create patient_evaluations table
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

        // 6. Create path_documents table
        await queryRunner.query(`
            CREATE TABLE "path_documents" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "therapeuticPathId" uuid NOT NULL,
                "type" "public"."path_documents_type_enum" NOT NULL DEFAULT 'other',
                "category" "public"."path_documents_category_enum" NOT NULL DEFAULT 'other',
                "fileName" character varying(255) NOT NULL,
                "originalFileName" character varying(255),
                "mimeType" character varying(100) NOT NULL,
                "fileSize" integer NOT NULL,
                "storagePath" text NOT NULL,
                "thumbnailPath" text,
                "externalDoctorName" character varying(255),
                "notes" text,
                "description" text,
                "uploadedBy" uuid,
                "uploadedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_path_documents" PRIMARY KEY ("id")
            )
        `);

        // 7. Create indexes for therapeutic_paths
        await queryRunner.query(`CREATE INDEX "IDX_therapeutic_paths_patient" ON "therapeutic_paths" ("patientId")`);
        await queryRunner.query(`CREATE INDEX "IDX_therapeutic_paths_operator" ON "therapeutic_paths" ("primaryOperatorId")`);
        await queryRunner.query(`CREATE INDEX "IDX_therapeutic_paths_status" ON "therapeutic_paths" ("status")`);

        // 8. Create indexes for patient_evaluations
        await queryRunner.query(`CREATE INDEX "IDX_patient_evaluations_path" ON "patient_evaluations" ("therapeuticPathId")`);
        await queryRunner.query(`CREATE INDEX "IDX_patient_evaluations_operator" ON "patient_evaluations" ("operatorId")`);

        // 9. Create indexes for path_documents
        await queryRunner.query(`CREATE INDEX "IDX_path_documents_path" ON "path_documents" ("therapeuticPathId")`);
        await queryRunner.query(`CREATE INDEX "IDX_path_documents_category" ON "path_documents" ("category")`);

        // 10. Add foreign key constraints for therapeutic_paths
        await queryRunner.query(`
            ALTER TABLE "therapeutic_paths"
            ADD CONSTRAINT "FK_therapeutic_paths_patient"
            FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "therapeutic_paths"
            ADD CONSTRAINT "FK_therapeutic_paths_operator"
            FOREIGN KEY ("primaryOperatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        // 11. Add foreign key constraints for patient_evaluations
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

        // 12. Add foreign key constraints for path_documents
        await queryRunner.query(`
            ALTER TABLE "path_documents"
            ADD CONSTRAINT "FK_path_documents_path"
            FOREIGN KEY ("therapeuticPathId") REFERENCES "therapeutic_paths"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign keys for path_documents
        await queryRunner.query(`ALTER TABLE "path_documents" DROP CONSTRAINT IF EXISTS "FK_path_documents_path"`);

        // Drop foreign keys for patient_evaluations
        await queryRunner.query(`ALTER TABLE "patient_evaluations" DROP CONSTRAINT IF EXISTS "FK_patient_evaluations_operator"`);
        await queryRunner.query(`ALTER TABLE "patient_evaluations" DROP CONSTRAINT IF EXISTS "FK_patient_evaluations_path"`);

        // Drop foreign keys for therapeutic_paths
        await queryRunner.query(`ALTER TABLE "therapeutic_paths" DROP CONSTRAINT IF EXISTS "FK_therapeutic_paths_operator"`);
        await queryRunner.query(`ALTER TABLE "therapeutic_paths" DROP CONSTRAINT IF EXISTS "FK_therapeutic_paths_patient"`);

        // Drop indexes for path_documents
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_path_documents_category"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_path_documents_path"`);

        // Drop indexes for patient_evaluations
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_evaluations_operator"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_patient_evaluations_path"`);

        // Drop indexes for therapeutic_paths
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_therapeutic_paths_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_therapeutic_paths_operator"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_therapeutic_paths_patient"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS "path_documents"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "patient_evaluations"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "therapeutic_paths"`);

        // Drop enums
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."path_documents_category_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."path_documents_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."therapeutic_paths_status_enum"`);
    }
}

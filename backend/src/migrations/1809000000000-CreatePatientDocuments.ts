import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Documenti scheda paziente — sostituisce path_documents.
 *
 * - Nuova tabella patient_documents: metadati + materiale envelope encryption
 *   (wrap DEK Transit, IV, auth tag GCM). Il blob vive su S3 MicroCeph
 *   (bucket-per-tenant curandis-clinico-docs-<alias>), MAI nel DB.
 * - Tre livelli di associazione: generale / percorso / trattamento
 *   (percorso denormalizzato quando c'è il trattamento — CHECK constraint).
 * - path_documents viene RINOMINATA in path_documents_legacy, non droppata:
 *   conteneva solo metadati senza file reali dietro (lo storage non è mai
 *   esistito). Drop manuale dopo verifica in produzione.
 */
export class CreatePatientDocuments1809000000000 implements MigrationInterface {
  name = 'CreatePatientDocuments1809000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Patient documents migration...');

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_document_category_enum') THEN
          CREATE TYPE "patient_document_category_enum" AS ENUM
            ('prescription', 'report', 'radiology', 'consent', 'other');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_document_kind_enum') THEN
          CREATE TYPE "patient_document_kind_enum" AS ENUM
            ('pdf', 'image', 'video', 'audio', 'spreadsheet', 'document', 'other');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_documents" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "subject_id" uuid NOT NULL,
        "organization_id" uuid,
        "therapeutic_path_id" uuid,
        "treatment_id" uuid,
        "category" "patient_document_category_enum" NOT NULL DEFAULT 'other',
        "content_kind" "patient_document_kind_enum" NOT NULL DEFAULT 'other',
        "original_file_name" varchar(255) NOT NULL,
        "mime_type" varchar(150) NOT NULL,
        "file_size" bigint NOT NULL,
        "sha256" varchar(64) NOT NULL,
        "bucket" varchar(63) NOT NULL,
        "object_key" text NOT NULL,
        "enc_algorithm" varchar(20) NOT NULL DEFAULT 'aes-256-gcm',
        "enc_wrapped_dek" text NOT NULL,
        "enc_iv" varchar(32) NOT NULL,
        "enc_auth_tag" varchar(32) NOT NULL,
        "enc_key_name" varchar(100) NOT NULL,
        "enc_key_version" int NOT NULL DEFAULT 1,
        "external_doctor_name" varchar(255),
        "notes" text,
        "description" text,
        "uploaded_by" uuid,
        "uploaded_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_patient_documents" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_patient_documents_treatment_has_path"
          CHECK ("treatment_id" IS NULL OR "therapeutic_path_id" IS NOT NULL)
      )
    `);

    // FK SET NULL: cancellare percorso/trattamento non deve mai perdere il documento
    // (degrada a documento generale / di percorso)
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_patient_documents_path') THEN
          ALTER TABLE "patient_documents" ADD CONSTRAINT "FK_patient_documents_path"
            FOREIGN KEY ("therapeutic_path_id") REFERENCES "therapeutic_paths"("id") ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_patient_documents_treatment') THEN
          ALTER TABLE "patient_documents" ADD CONSTRAINT "FK_patient_documents_treatment"
            FOREIGN KEY ("treatment_id") REFERENCES "treatments"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_documents_subject" ON "patient_documents" ("subject_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_documents_path" ON "patient_documents" ("therapeutic_path_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_documents_treatment" ON "patient_documents" ("treatment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_documents_category" ON "patient_documents" ("category")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_documents_deleted" ON "patient_documents" ("deleted_at") WHERE "deleted_at" IS NOT NULL`,
    );

    // Tabella legacy: rename, non drop (nessun file reale è mai esistito dietro
    // le righe di path_documents; drop manuale dopo verifica).
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'path_documents')
           AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'path_documents_legacy') THEN
          ALTER TABLE "path_documents" RENAME TO "path_documents_legacy";
        END IF;
      END $$;
    `);

    console.log('Patient documents migration done.');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'path_documents_legacy')
           AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'path_documents') THEN
          ALTER TABLE "path_documents_legacy" RENAME TO "path_documents";
        END IF;
      END $$;
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_documents"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "patient_document_kind_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "patient_document_category_enum"`);
  }
}

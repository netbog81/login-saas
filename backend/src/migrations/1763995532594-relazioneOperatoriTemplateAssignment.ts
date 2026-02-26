import { MigrationInterface, QueryRunner } from "typeorm";

export class RelazioneOperatoriTemplateAssignment1763995532594 implements MigrationInterface {
    name = 'RelazioneOperatoriTemplateAssignment1763995532594'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Idempotent ENUM upgrade: if the old (5-value) type exists rename it and recreate with 6 values.
        // If the new (6-value) type already exists (e.g. tenant schema migration re-run), skip entirely.
        await queryRunner.query(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                    WHERE t.typname = 'availability_exceptions_exceptiontype_enum'
                    AND n.nspname = 'public'
                    AND NOT EXISTS (
                        SELECT 1 FROM pg_enum e WHERE e.enumtypid = t.oid AND e.enumlabel = 'personal_leave'
                    )
                ) THEN
                    ALTER TYPE "public"."availability_exceptions_exceptiontype_enum" RENAME TO "availability_exceptions_exceptiontype_enum_old";
                    CREATE TYPE "public"."availability_exceptions_exceptiontype_enum" AS ENUM('unavailable', 'modified', 'holiday', 'sick', 'vacation', 'personal_leave');
                    ALTER TABLE "availability_exceptions" ALTER COLUMN "exceptionType" TYPE "public"."availability_exceptions_exceptiontype_enum" USING "exceptionType"::"text"::"public"."availability_exceptions_exceptiontype_enum";
                    DROP TYPE "public"."availability_exceptions_exceptiontype_enum_old";
                ELSIF NOT EXISTS (
                    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                    WHERE t.typname = 'availability_exceptions_exceptiontype_enum'
                    AND n.nspname = 'public'
                ) THEN
                    CREATE TYPE "public"."availability_exceptions_exceptiontype_enum" AS ENUM('unavailable', 'modified', 'holiday', 'sick', 'vacation', 'personal_leave');
                END IF;
            END $$
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."availability_exceptions_exceptiontype_enum_old" AS ENUM('unavailable', 'modified', 'holiday', 'sick', 'vacation')`);
        await queryRunner.query(`ALTER TABLE "availability_exceptions" ALTER COLUMN "exceptionType" TYPE "public"."availability_exceptions_exceptiontype_enum_old" USING "exceptionType"::"text"::"public"."availability_exceptions_exceptiontype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."availability_exceptions_exceptiontype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."availability_exceptions_exceptiontype_enum_old" RENAME TO "availability_exceptions_exceptiontype_enum"`);
    }

}

import { MigrationInterface, QueryRunner } from "typeorm";

export class RelazioneOperatoriTemplateAssignment1763995532594 implements MigrationInterface {
    name = 'RelazioneOperatoriTemplateAssignment1763995532594'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."availability_exceptions_exceptiontype_enum" RENAME TO "availability_exceptions_exceptiontype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."availability_exceptions_exceptiontype_enum" AS ENUM('unavailable', 'modified', 'holiday', 'sick', 'vacation', 'personal_leave')`);
        await queryRunner.query(`ALTER TABLE "availability_exceptions" ALTER COLUMN "exceptionType" TYPE "public"."availability_exceptions_exceptiontype_enum" USING "exceptionType"::"text"::"public"."availability_exceptions_exceptiontype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."availability_exceptions_exceptiontype_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."availability_exceptions_exceptiontype_enum_old" AS ENUM('unavailable', 'modified', 'holiday', 'sick', 'vacation')`);
        await queryRunner.query(`ALTER TABLE "availability_exceptions" ALTER COLUMN "exceptionType" TYPE "public"."availability_exceptions_exceptiontype_enum_old" USING "exceptionType"::"text"::"public"."availability_exceptions_exceptiontype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."availability_exceptions_exceptiontype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."availability_exceptions_exceptiontype_enum_old" RENAME TO "availability_exceptions_exceptiontype_enum"`);
    }

}

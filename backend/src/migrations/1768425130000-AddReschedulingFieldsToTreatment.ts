import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReschedulingFieldsToTreatment1768425130000 implements MigrationInterface {
    name = 'AddReschedulingFieldsToTreatment1768425130000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "treatments" ADD "reschedulingType" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "treatments" ADD "suggestInDays" integer`);
        await queryRunner.query(`ALTER TABLE "treatments" ADD "suggestDateRangeStart" date`);
        await queryRunner.query(`ALTER TABLE "treatments" ADD "suggestDateRangeEnd" date`);
        await queryRunner.query(`ALTER TABLE "treatments" ADD "reschedulingNotes" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "reschedulingNotes"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "suggestDateRangeEnd"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "suggestDateRangeStart"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "suggestInDays"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "reschedulingType"`);
    }

}

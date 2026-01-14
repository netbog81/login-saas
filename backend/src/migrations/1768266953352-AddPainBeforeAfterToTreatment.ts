import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPainBeforeAfterToTreatment1768266953352 implements MigrationInterface {
    name = 'AddPainBeforeAfterToTreatment1768266953352'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "treatments" ADD "painLevel" integer`);
        await queryRunner.query(`ALTER TABLE "treatments" ADD "painBefore" integer`);
        await queryRunner.query(`ALTER TABLE "treatments" ADD "painAfter" integer`);
        await queryRunner.query(`ALTER TABLE "treatments" ADD "rescheduleRequested" boolean DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "rescheduleRequested"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "painAfter"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "painBefore"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "painLevel"`);
    }

}

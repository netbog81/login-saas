import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPatientNotesToTreatment1768400000000 implements MigrationInterface {
    name = 'AddPatientNotesToTreatment1768400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "treatments" ADD "patientNotes" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "patientNotes"`);
    }

}

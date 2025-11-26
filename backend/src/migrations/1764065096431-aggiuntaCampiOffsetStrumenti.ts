import { MigrationInterface, QueryRunner } from "typeorm";

export class AggiuntaCampiOffsetStrumenti1764065096431 implements MigrationInterface {
    name = 'AggiuntaCampiOffsetStrumenti1764065096431'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "services" ADD "defaultInstrumentSlotOffset" integer DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "services" ADD "reverseInstrumentOrder" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "reverseInstrumentOrder"`);
        await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "defaultInstrumentSlotOffset"`);
    }

}

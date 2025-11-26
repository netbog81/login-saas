import { MigrationInterface, QueryRunner } from "typeorm";

export class AggiuntaUserIdToOperators1764145678259 implements MigrationInterface {
    name = 'AggiuntaUserIdToOperators1764145678259'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "operators" ADD "userId" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "operators" DROP COLUMN "userId"`);
    }

}

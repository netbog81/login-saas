import { MigrationInterface, QueryRunner } from "typeorm";

export class AggiornamentoColonnaTemplateAssignmentData1764154654182 implements MigrationInterface {
    name = 'AggiornamentoColonnaTemplateAssignmentData1764154654182'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_71860755fad0e250833179807c"`);
        await queryRunner.query(`ALTER TABLE "template_assignments" DROP COLUMN "patternStartDate"`);
        await queryRunner.query(`ALTER TABLE "template_assignments" ADD "patternStartDate" TIMESTAMP NOT NULL DEFAULT NOW()`);
        await queryRunner.query(`ALTER TABLE "template_assignments" ALTER COLUMN "patternStartDate" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "template_assignments" DROP COLUMN "validFrom"`);
        await queryRunner.query(`ALTER TABLE "template_assignments" ADD "validFrom" TIMESTAMP NOT NULL DEFAULT NOW()`);
        await queryRunner.query(`ALTER TABLE "template_assignments" ALTER COLUMN "validFrom" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "template_assignments" DROP COLUMN "validUntil"`);
        await queryRunner.query(`ALTER TABLE "template_assignments" ADD "validUntil" TIMESTAMP`);
        await queryRunner.query(`CREATE INDEX "IDX_71860755fad0e250833179807c" ON "template_assignments" ("validFrom", "validUntil") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_71860755fad0e250833179807c"`);
        await queryRunner.query(`ALTER TABLE "template_assignments" DROP COLUMN "validUntil"`);
        await queryRunner.query(`ALTER TABLE "template_assignments" ADD "validUntil" date`);
        await queryRunner.query(`ALTER TABLE "template_assignments" DROP COLUMN "validFrom"`);
        await queryRunner.query(`ALTER TABLE "template_assignments" ADD "validFrom" date NOT NULL`);
        await queryRunner.query(`ALTER TABLE "template_assignments" DROP COLUMN "patternStartDate"`);
        await queryRunner.query(`ALTER TABLE "template_assignments" ADD "patternStartDate" date NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_71860755fad0e250833179807c" ON "template_assignments" ("validFrom", "validUntil") `);
    }

}

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTreatmentTherapeuticPathRelation1767100000000 implements MigrationInterface {
    name = 'AddTreatmentTherapeuticPathRelation1767100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add therapeuticPathId column (NOT NULL)
        await queryRunner.query(`
            ALTER TABLE "treatments" ADD COLUMN "therapeuticPathId" uuid NOT NULL
        `);

        // 2. Add scontoFE column with default value
        await queryRunner.query(`
            ALTER TABLE "treatments" ADD COLUMN "scontoFE" boolean NOT NULL DEFAULT false
        `);

        // 3. Create index on therapeuticPathId for query performance
        await queryRunner.query(`
            CREATE INDEX "IDX_treatments_therapeutic_path" ON "treatments" ("therapeuticPathId")
        `);

        // 4. Add foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "treatments" ADD CONSTRAINT "FK_treatments_therapeutic_path"
            FOREIGN KEY ("therapeuticPathId") REFERENCES "therapeutic_paths"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "treatments" DROP CONSTRAINT IF EXISTS "FK_treatments_therapeutic_path"
        `);

        // Drop index
        await queryRunner.query(`
            DROP INDEX IF EXISTS "public"."IDX_treatments_therapeutic_path"
        `);

        // Drop columns
        await queryRunner.query(`
            ALTER TABLE "treatments" DROP COLUMN IF EXISTS "scontoFE"
        `);

        await queryRunner.query(`
            ALTER TABLE "treatments" DROP COLUMN IF EXISTS "therapeuticPathId"
        `);
    }
}

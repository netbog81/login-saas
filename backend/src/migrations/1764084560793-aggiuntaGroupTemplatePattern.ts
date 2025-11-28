import { MigrationInterface, QueryRunner } from "typeorm";

export class AggiuntaGroupTemplatePattern1764084560793 implements MigrationInterface {
    name = 'AggiuntaGroupTemplatePattern1764084560793'

    public async up(queryRunner: QueryRunner): Promise<void> {
       // await queryRunner.query(`ALTER TABLE "template_assignments" DROP CONSTRAINT "FK_a6c7d8c752f01bef612089e6c7a"`);
        //await queryRunner.query(`ALTER TABLE "template_assignments" RENAME COLUMN "patternId" TO "patternGroupId"`);
       // await queryRunner.query(`CREATE TABLE "pattern_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text, "patternDuration" integer NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c341a7f9fafc15ecf7a4a9bde05" PRIMARY KEY ("id"))`);
       // await queryRunner.query(`CREATE INDEX "IDX_24f009b8fc133a685475885022" ON "pattern_groups" ("name") `);
       // await queryRunner.query(`ALTER TABLE "template_patterns" ADD "patternGroupId" uuid NOT NULL`);
       // await queryRunner.query(`CREATE INDEX "IDX_a603bf44d711b323a27583c6c8" ON "template_patterns" ("patternGroupId") `);
       // await queryRunner.query(`ALTER TABLE "template_patterns" ADD CONSTRAINT "FK_a603bf44d711b323a27583c6c85" FOREIGN KEY ("patternGroupId") REFERENCES "pattern_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        //await queryRunner.query(`ALTER TABLE "template_assignments" ADD CONSTRAINT "FK_8fe71d93f51a3cd42c2b03a8c2c" FOREIGN KEY ("patternGroupId") REFERENCES "pattern_groups"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
       // await queryRunner.query(`ALTER TABLE "template_assignments" DROP CONSTRAINT "FK_8fe71d93f51a3cd42c2b03a8c2c"`);
      //  await queryRunner.query(`ALTER TABLE "template_patterns" DROP CONSTRAINT "FK_a603bf44d711b323a27583c6c85"`);
     //   await queryRunner.query(`DROP INDEX "public"."IDX_a603bf44d711b323a27583c6c8"`);
       // await queryRunner.query(`ALTER TABLE "template_patterns" DROP COLUMN "patternGroupId"`);
        //await queryRunner.query(`DROP INDEX "public"."IDX_24f009b8fc133a685475885022"`);
        //await queryRunner.query(`DROP TABLE "pattern_groups"`);
      //  await queryRunner.query(`ALTER TABLE "template_assignments" RENAME COLUMN "patternGroupId" TO "patternId"`);
       // await queryRunner.query(`ALTER TABLE "template_assignments" ADD CONSTRAINT "FK_a6c7d8c752f01bef612089e6c7a" FOREIGN KEY ("patternId") REFERENCES "template_patterns"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}

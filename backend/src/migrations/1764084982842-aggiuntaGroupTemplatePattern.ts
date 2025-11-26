import { MigrationInterface, QueryRunner } from "typeorm";

export class AggiuntaGroupTemplatePattern1764084982842 implements MigrationInterface {
    name = 'AggiuntaGroupTemplatePattern1764084982842'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "template_assignments" DROP CONSTRAINT "FK_a6c7d8c752f01bef612089e6c7a"`);
        await queryRunner.query(`ALTER TABLE "template_assignments" RENAME COLUMN "patternId" TO "patternGroupId"`);
        await queryRunner.query(`CREATE TABLE "pattern_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text, "patternDuration" integer NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c341a7f9fafc15ecf7a4a9bde05" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_24f009b8fc133a685475885022" ON "pattern_groups" ("name") `);   
      //  await queryRunner.query(`ALTER TABLE "services" ADD "defaultInstrumentSlotOffset" integer DEFAULT '0'`);
     //   await queryRunner.query(`ALTER TABLE "services" ADD "reverseInstrumentOrder" boolean NOT NULL DEFAULT false`);
// RIGA ORIGINALE (da ELIMINARE):

       // await queryRunner.query(`ALTER TABLE "template_patterns" ADD "patternGroupId" uuid NOT NULL`);

// SOSTITUISCI CON QUESTO:
// 3. CREA UN PATTERN GROUP DI DEFAULT PRIMA DI AGGIUNGERE LA COLONNA
await queryRunner.query(`
    INSERT INTO "pattern_groups" ("name", "description", "patternDuration", "isActive")
    VALUES ('Default Group', 'Default pattern group for existing templates', 60, true)
`);

// 4. Aggiungi la colonna patternGroupId come NULLABLE inizialmente
await queryRunner.query(`ALTER TABLE "template_patterns" ADD "patternGroupId" uuid`);

// 5. POPOLA LA COLONNA CON L'ID DEL GRUPPO DI DEFAULT
const defaultGroup = await queryRunner.query(`SELECT id FROM "pattern_groups" WHERE name = 'Default Group' LIMIT 1`);
if (defaultGroup.length > 0) {
    await queryRunner.query(`UPDATE "template_patterns" SET "patternGroupId" = $1`, [defaultGroup[0].id]);
}

// 6. ORA RENDI LA COLONNA NOT NULL (dopo aver popolato tutti i record)
await queryRunner.query(`ALTER TABLE "template_patterns" ALTER COLUMN "patternGroupId" SET NOT NULL`);

        await queryRunner.query(`CREATE INDEX "IDX_a603bf44d711b323a27583c6c8" ON "template_patterns" ("patternGroupId") `);
        await queryRunner.query(`ALTER TABLE "template_patterns" ADD CONSTRAINT "FK_a603bf44d711b323a27583c6c85" FOREIGN KEY ("patternGroupId") REFERENCES "pattern_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "template_assignments" ADD CONSTRAINT "FK_8fe71d93f51a3cd42c2b03a8c2c" FOREIGN KEY ("patternGroupId") REFERENCES "pattern_groups"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "template_assignments" DROP CONSTRAINT "FK_8fe71d93f51a3cd42c2b03a8c2c"`);
        await queryRunner.query(`ALTER TABLE "template_patterns" DROP CONSTRAINT "FK_a603bf44d711b323a27583c6c85"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a603bf44d711b323a27583c6c8"`);
        await queryRunner.query(`ALTER TABLE "template_patterns" DROP COLUMN "patternGroupId"`);
     //   await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "reverseInstrumentOrder"`);
    //    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "defaultInstrumentSlotOffset"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_24f009b8fc133a685475885022"`);
        await queryRunner.query(`DROP TABLE "pattern_groups"`);
        await queryRunner.query(`ALTER TABLE "template_assignments" RENAME COLUMN "patternGroupId" TO "patternId"`);
        await queryRunner.query(`ALTER TABLE "template_assignments" ADD CONSTRAINT "FK_a6c7d8c752f01bef612089e6c7a" FOREIGN KEY ("patternId") REFERENCES "template_patterns"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}

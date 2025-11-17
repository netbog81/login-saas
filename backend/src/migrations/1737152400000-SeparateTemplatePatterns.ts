import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeparateTemplatePatterns1737152400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create template_patterns table
    await queryRunner.query(`
      CREATE TABLE "template_patterns" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "description" text,
        "dayInPattern" integer NOT NULL,
        "patternDuration" integer NOT NULL,
        "startTime" time NOT NULL,
        "endTime" time NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    // 2. Create index on name for template_patterns
    await queryRunner.query(`
      CREATE INDEX "IDX_template_patterns_name" ON "template_patterns" ("name")
    `);

    // 3. Create template_assignments table
    await queryRunner.query(`
      CREATE TABLE "template_assignments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "operatorId" uuid NOT NULL,
        "patternId" uuid NOT NULL,
        "patternStartDate" date NOT NULL,
        "validFrom" date NOT NULL,
        "validUntil" date,
        "version" integer NOT NULL DEFAULT 1,
        "isCurrent" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_template_assignments_operator" FOREIGN KEY ("operatorId")
          REFERENCES "operators"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_template_assignments_pattern" FOREIGN KEY ("patternId")
          REFERENCES "template_patterns"("id") ON DELETE RESTRICT
      )
    `);

    // 4. Create indexes for template_assignments
    await queryRunner.query(`
      CREATE INDEX "IDX_template_assignments_operator_current"
        ON "template_assignments" ("operatorId", "isCurrent")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_template_assignments_validity"
        ON "template_assignments" ("validFrom", "validUntil")
    `);

    // 5. Migrate existing data from availability_templates
    // First, extract unique patterns (group by name, dayInPattern, patternDuration, startTime, endTime)
    await queryRunner.query(`
      INSERT INTO "template_patterns"
        ("name", "description", "dayInPattern", "patternDuration", "startTime", "endTime", "createdAt", "updatedAt")
      SELECT DISTINCT ON (name, "dayInPattern", "patternDuration", "startTime", "endTime")
        COALESCE(name, 'Pattern Senza Nome') as name,
        description,
        "dayInPattern",
        "patternDuration",
        "startTime",
        "endTime",
        MIN("createdAt") as "createdAt",
        MAX("updatedAt") as "updatedAt"
      FROM "availability_templates"
      WHERE "operatorId" IS NOT NULL
      GROUP BY name, description, "dayInPattern", "patternDuration", "startTime", "endTime"
    `);

    // 6. Create assignments by linking existing availability_templates to patterns
    await queryRunner.query(`
      INSERT INTO "template_assignments"
        ("operatorId", "patternId", "patternStartDate", "validFrom", "validUntil", "version", "isCurrent", "createdAt", "updatedAt")
      SELECT
        at."operatorId",
        tp.id as "patternId",
        at."patternStartDate",
        at."validFrom",
        at."validUntil",
        at.version,
        at."isCurrent",
        at."createdAt",
        at."updatedAt"
      FROM "availability_templates" at
      INNER JOIN "template_patterns" tp ON
        COALESCE(at.name, 'Pattern Senza Nome') = tp.name AND
        at."dayInPattern" = tp."dayInPattern" AND
        at."patternDuration" = tp."patternDuration" AND
        at."startTime" = tp."startTime" AND
        at."endTime" = tp."endTime"
      WHERE at."operatorId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop template_assignments table
    await queryRunner.query(`DROP TABLE IF EXISTS "template_assignments"`);

    // Drop template_patterns table
    await queryRunner.query(`DROP TABLE IF EXISTS "template_patterns"`);
  }
}

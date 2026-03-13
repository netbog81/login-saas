import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWaitingListTable1776000000000 implements MigrationInterface {
  name = 'CreateWaitingListTable1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type
    await queryRunner.query(`
      CREATE TYPE "waiting_list_status_enum" AS ENUM ('waiting', 'contacted', 'scheduled', 'removed')
    `);

    // Create table
    await queryRunner.query(`
      CREATE TABLE "waiting_list_entries" (
        "id" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
        "patientId" uuid,
        "patientName" varchar(255) NOT NULL,
        "phone" varchar(50),
        "operatorId" uuid,
        "notes" text,
        "priority" integer NOT NULL DEFAULT 1,
        "position" integer NOT NULL DEFAULT 0,
        "status" "waiting_list_status_enum" NOT NULL DEFAULT 'waiting',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_waiting_list_entries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_waiting_list_patient" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_waiting_list_operator" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_waiting_list_status" ON "waiting_list_entries" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_waiting_list_priority_position" ON "waiting_list_entries" ("priority" DESC, "position" ASC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_waiting_list_priority_position"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_waiting_list_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "waiting_list_entries"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "waiting_list_status_enum"`);
  }
}

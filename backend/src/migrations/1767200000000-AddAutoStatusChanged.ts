import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAutoStatusChanged1767200000000 implements MigrationInterface {
    name = 'AddAutoStatusChanged1767200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add autoStatusChanged column to track if status was changed automatically
        // This prevents infinite loops between automatic and manual status changes
        await queryRunner.query(`
            ALTER TABLE "availability_appointments"
            ADD COLUMN "autoStatusChanged" boolean NOT NULL DEFAULT false
        `);

        // Create index for efficient querying of appointments that haven't been auto-changed
        await queryRunner.query(`
            CREATE INDEX "IDX_availability_appointments_auto_status_changed"
            ON "availability_appointments" ("autoStatusChanged")
            WHERE "autoStatusChanged" = false
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop index
        await queryRunner.query(`
            DROP INDEX IF EXISTS "public"."IDX_availability_appointments_auto_status_changed"
        `);

        // Drop column
        await queryRunner.query(`
            ALTER TABLE "availability_appointments"
            DROP COLUMN IF EXISTS "autoStatusChanged"
        `);
    }
}

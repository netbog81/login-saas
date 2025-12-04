import { MigrationInterface, QueryRunner } from "typeorm";

export class AggiungiCampiRicorrenzaAppuntamento1764600000000 implements MigrationInterface {
    name = 'AggiungiCampiRicorrenzaAppuntamento1764600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Aggiungi colonna isRecurring
        await queryRunner.query(`
            ALTER TABLE "availability_appointments"
            ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN NOT NULL DEFAULT false
        `);

        // Aggiungi colonna recurringGroupId
        await queryRunner.query(`
            ALTER TABLE "availability_appointments"
            ADD COLUMN IF NOT EXISTS "recurringGroupId" UUID NULL
        `);

        // Aggiungi colonna repeatConfig (JSONB)
        await queryRunner.query(`
            ALTER TABLE "availability_appointments"
            ADD COLUMN IF NOT EXISTS "repeatConfig" JSONB NULL
        `);

        // Crea indice per recurringGroupId
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_availability_appointments_recurring_group"
            ON "availability_appointments" ("recurringGroupId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rimuovi indice
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_availability_appointments_recurring_group"
        `);

        // Rimuovi colonne
        await queryRunner.query(`
            ALTER TABLE "availability_appointments"
            DROP COLUMN IF EXISTS "repeatConfig"
        `);

        await queryRunner.query(`
            ALTER TABLE "availability_appointments"
            DROP COLUMN IF EXISTS "recurringGroupId"
        `);

        await queryRunner.query(`
            ALTER TABLE "availability_appointments"
            DROP COLUMN IF EXISTS "isRecurring"
        `);
    }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aggiunge campi per il tracciamento master/child degli appuntamenti ricorrenti.
 *
 * - `isMaster`: flag che indica l'appuntamento master (primo della serie)
 * - `masterAppointmentId`: FK self-referential verso il master (per i child)
 *
 * Back-fill: per ogni recurringGroupId esistente, il record più vecchio
 * (createdAt ASC) diventa master, tutti gli altri ricevono masterAppointmentId.
 */
export class AddRecurringMasterFields1779000000000
  implements MigrationInterface
{
  name = 'AddRecurringMasterFields1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Aggiunge colonna isMaster
    await queryRunner.query(`
      ALTER TABLE "availability_appointments"
      ADD COLUMN "isMaster" boolean NOT NULL DEFAULT false
    `);

    // 2. Aggiunge colonna masterAppointmentId con FK self-referential
    await queryRunner.query(`
      ALTER TABLE "availability_appointments"
      ADD COLUMN "masterAppointmentId" uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "availability_appointments"
      ADD CONSTRAINT "FK_availability_appointments_master"
        FOREIGN KEY ("masterAppointmentId")
        REFERENCES "availability_appointments"("id")
        ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_availability_appointments_masterAppointmentId"
      ON "availability_appointments"("masterAppointmentId")
    `);

    // 3. Back-fill: imposta isMaster = true sul record più vecchio di ogni gruppo
    await queryRunner.query(`
      UPDATE "availability_appointments"
      SET "isMaster" = true
      WHERE id IN (
        SELECT DISTINCT ON ("recurringGroupId") id
        FROM "availability_appointments"
        WHERE "recurringGroupId" IS NOT NULL
        ORDER BY "recurringGroupId", "createdAt" ASC
      )
    `);

    // 4. Back-fill: imposta masterAppointmentId sui child
    await queryRunner.query(`
      UPDATE "availability_appointments" AS child
      SET "masterAppointmentId" = master.id
      FROM (
        SELECT DISTINCT ON ("recurringGroupId") id, "recurringGroupId"
        FROM "availability_appointments"
        WHERE "recurringGroupId" IS NOT NULL
        ORDER BY "recurringGroupId", "createdAt" ASC
      ) AS master
      WHERE child."recurringGroupId" = master."recurringGroupId"
        AND child.id <> master.id
        AND child."recurringGroupId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_availability_appointments_masterAppointmentId"
    `);
    await queryRunner.query(`
      ALTER TABLE "availability_appointments"
      DROP CONSTRAINT IF EXISTS "FK_availability_appointments_master"
    `);
    await queryRunner.query(`
      ALTER TABLE "availability_appointments"
      DROP COLUMN IF EXISTS "masterAppointmentId"
    `);
    await queryRunner.query(`
      ALTER TABLE "availability_appointments"
      DROP COLUMN IF EXISTS "isMaster"
    `);
  }
}

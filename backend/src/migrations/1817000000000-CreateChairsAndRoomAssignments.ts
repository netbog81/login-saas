import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Studi e poltrone per le assegnazioni template:
 *  - chairs: poltrone/riuniti dentro uno studio (rooms, tabella già esistente)
 *  - template_assignments.roomId/chairId: studio/poltrona di default
 *  - template_assignment_room_overrides: override per giorno/fascia oraria
 *  - availability_appointments.roomId/chairId: snapshot alla prenotazione
 */
export class CreateChairsAndRoomAssignments1817000000000 implements MigrationInterface {
  name = 'CreateChairsAndRoomAssignments1817000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chairs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "roomId" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "color" character varying(7),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chairs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chairs_room" FOREIGN KEY ("roomId")
          REFERENCES "rooms"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_chairs_roomId" ON "chairs" ("roomId")`,
    );

    await queryRunner.query(`ALTER TABLE "template_assignments" ADD "roomId" uuid`);
    await queryRunner.query(`ALTER TABLE "template_assignments" ADD "chairId" uuid`);
    await queryRunner.query(`
      ALTER TABLE "template_assignments"
        ADD CONSTRAINT "FK_template_assignments_room" FOREIGN KEY ("roomId")
          REFERENCES "rooms"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "template_assignments"
        ADD CONSTRAINT "FK_template_assignments_chair" FOREIGN KEY ("chairId")
          REFERENCES "chairs"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_template_assignments_roomId" ON "template_assignments" ("roomId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "template_assignment_room_overrides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "assignmentId" uuid NOT NULL,
        "dayInPattern" integer NOT NULL,
        "startTime" TIME,
        "endTime" TIME,
        "roomId" uuid NOT NULL,
        "chairId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_template_assignment_room_overrides" PRIMARY KEY ("id"),
        CONSTRAINT "FK_taro_assignment" FOREIGN KEY ("assignmentId")
          REFERENCES "template_assignments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_taro_room" FOREIGN KEY ("roomId")
          REFERENCES "rooms"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_taro_chair" FOREIGN KEY ("chairId")
          REFERENCES "chairs"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_taro_assignmentId" ON "template_assignment_room_overrides" ("assignmentId")`,
    );

    await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "roomId" uuid`);
    await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "chairId" uuid`);
    await queryRunner.query(`
      ALTER TABLE "availability_appointments"
        ADD CONSTRAINT "FK_availability_appointments_room" FOREIGN KEY ("roomId")
          REFERENCES "rooms"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "availability_appointments"
        ADD CONSTRAINT "FK_availability_appointments_chair" FOREIGN KEY ("chairId")
          REFERENCES "chairs"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_availability_appointments_room_date" ON "availability_appointments" ("roomId", "appointmentDate")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_availability_appointments_room_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "availability_appointments" DROP CONSTRAINT "FK_availability_appointments_chair"`,
    );
    await queryRunner.query(
      `ALTER TABLE "availability_appointments" DROP CONSTRAINT "FK_availability_appointments_room"`,
    );
    await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "chairId"`);
    await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "roomId"`);

    await queryRunner.query(`DROP TABLE "template_assignment_room_overrides"`);

    await queryRunner.query(`DROP INDEX "IDX_template_assignments_roomId"`);
    await queryRunner.query(
      `ALTER TABLE "template_assignments" DROP CONSTRAINT "FK_template_assignments_chair"`,
    );
    await queryRunner.query(
      `ALTER TABLE "template_assignments" DROP CONSTRAINT "FK_template_assignments_room"`,
    );
    await queryRunner.query(`ALTER TABLE "template_assignments" DROP COLUMN "chairId"`);
    await queryRunner.query(`ALTER TABLE "template_assignments" DROP COLUMN "roomId"`);

    await queryRunner.query(`DROP TABLE "chairs"`);
  }
}

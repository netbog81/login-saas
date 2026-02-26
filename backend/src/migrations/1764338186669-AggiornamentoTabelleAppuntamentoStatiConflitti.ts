import { MigrationInterface, QueryRunner } from "typeorm";

export class AggiornamentoTabelleAppuntamentoStatiConflitti1764338186669 implements MigrationInterface {
    name = 'AggiornamentoTabelleAppuntamentoStatiConflitti1764338186669'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_availability_appointments_status_active"`);
        await queryRunner.query(`CREATE TABLE "general_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying(100) NOT NULL, "value" jsonb NOT NULL, "description" character varying(255), "valueType" character varying(50) NOT NULL DEFAULT 'string', "category" character varying(50), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_3f56621b93eaa50c42d22fb605a" UNIQUE ("key"), CONSTRAINT "PK_c3b79ecb7c2446f3ba18a07f8e4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."appointment_logs_eventtype_enum" AS ENUM('cancelled', 'no_show', 'operator_absent', 'rescheduled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
        await queryRunner.query(`CREATE TABLE "appointment_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "appointmentId" uuid NOT NULL, "patientId" integer, "operatorId" uuid NOT NULL, "eventType" "public"."appointment_logs_eventtype_enum" NOT NULL, "reason" text, "performedBy" uuid, "originalDate" date NOT NULL, "originalStartTime" TIME NOT NULL, "newDate" date, "newStartTime" TIME, "year" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6cec5201edf8cab90b082d4e287" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_appointment_logs_date" ON "appointment_logs" ("originalDate") `);
        await queryRunner.query(`CREATE INDEX "IDX_appointment_logs_operator" ON "appointment_logs" ("operatorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_appointment_logs_event" ON "appointment_logs" ("eventType") `);
        await queryRunner.query(`CREATE INDEX "IDX_appointment_logs_patient" ON "appointment_logs" ("patientId") `);
        await queryRunner.query(`ALTER TABLE "patients" ADD "cancellationsByYear" jsonb NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "patients" ADD "noShowsByYear" jsonb NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "patients" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "patientId" integer`);
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."availability_appointments_bookingstatus_enum" AS ENUM('scheduled', 'confirmed', 'cancelled', 'no_show'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "bookingStatus" "public"."availability_appointments_bookingstatus_enum" NOT NULL DEFAULT 'scheduled'`);
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."availability_appointments_treatmentstatus_enum" AS ENUM('waiting', 'in_progress', 'operator_completed', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "treatmentStatus" "public"."availability_appointments_treatmentstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "hasConflict" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."availability_appointments_conflictreason_enum" AS ENUM('template_change', 'operator_sick', 'operator_vacation', 'operator_unavailable'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "conflictReason" "public"."availability_appointments_conflictreason_enum"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "conflictDetectedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "operatorNotes" text`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "treatmentStartedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "treatmentCompletedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "closedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ALTER COLUMN "status" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`CREATE INDEX "IDX_availability_appointments_conflict" ON "availability_appointments" ("hasConflict") WHERE "hasConflict" = true`);
        await queryRunner.query(`CREATE INDEX "IDX_availability_appointments_booking_status" ON "availability_appointments" ("bookingStatus") `);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD CONSTRAINT "FK_59fcefd8c2518c0211bde3cbc43" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointment_logs" ADD CONSTRAINT "FK_1a5a53b948ea288492ec51447ad" FOREIGN KEY ("appointmentId") REFERENCES "availability_appointments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "appointment_logs" DROP CONSTRAINT "FK_1a5a53b948ea288492ec51447ad"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP CONSTRAINT "FK_59fcefd8c2518c0211bde3cbc43"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_availability_appointments_booking_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_availability_appointments_conflict"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ALTER COLUMN "status" SET DEFAULT 'scheduled'`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ALTER COLUMN "status" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "closedAt"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "treatmentCompletedAt"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "treatmentStartedAt"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "operatorNotes"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "conflictDetectedAt"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "conflictReason"`);
        await queryRunner.query(`DROP TYPE "public"."availability_appointments_conflictreason_enum"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "hasConflict"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "treatmentStatus"`);
        await queryRunner.query(`DROP TYPE "public"."availability_appointments_treatmentstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "bookingStatus"`);
        await queryRunner.query(`DROP TYPE "public"."availability_appointments_bookingstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "patientId"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "noShowsByYear"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "cancellationsByYear"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_appointment_logs_patient"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_appointment_logs_event"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_appointment_logs_operator"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_appointment_logs_date"`);
        await queryRunner.query(`DROP TABLE "appointment_logs"`);
        await queryRunner.query(`DROP TYPE "public"."appointment_logs_eventtype_enum"`);
        await queryRunner.query(`DROP TABLE "general_settings"`);
        await queryRunner.query(`CREATE INDEX "IDX_availability_appointments_status_active" ON "availability_appointments" ("status") WHERE (status <> 'cancelled'::availability_appointments_status_enum)`);
    }

}

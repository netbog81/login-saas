import { MigrationInterface, QueryRunner } from "typeorm";

export class CreazioneAppuntamentiStrumentiFixIndiciUnivoci1763976154607 implements MigrationInterface {
    name = 'CreazioneAppuntamentiStrumentiFixIndiciUnivoci1763976154607'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_382f8ecad92978d1f059dd995b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d6a99307ed59dcd74bff0b46c6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2ed2edc46c1de2ac23457389c1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d56a473d5a543083b104f41033"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_07d6c761ba9b5a3da515a1c909"`);
        await queryRunner.query(`CREATE TABLE "appointment_instruments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "appointmentId" uuid NOT NULL, "instrumentId" uuid NOT NULL, "startOffsetMinutes" integer NOT NULL, "endOffsetMinutes" integer NOT NULL, "orderPosition" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_31a357851a36b8ebde3ab4da131" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_appointment_instruments_instrument_appointment" ON "appointment_instruments" ("instrumentId", "appointmentId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_appointment_instruments_appointment_instrument" ON "appointment_instruments" ("appointmentId", "instrumentId") `);
        await queryRunner.query(`CREATE TABLE "service_instruments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "serviceId" uuid NOT NULL, "instrumentCategoryId" uuid NOT NULL, "isRequired" boolean NOT NULL DEFAULT true, "orderPosition" integer, "quantity" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_48a68e7368dd9272d8b66de4202" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_service_instruments_service_category" ON "service_instruments" ("serviceId", "instrumentCategoryId") `);
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."services_macrocategory_enum" AS ENUM('doctor', 'physiotherapist', 'gym_instructor'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
        await queryRunner.query(`ALTER TABLE "services" ADD "macroCategory" "public"."services_macrocategory_enum"`);
        await queryRunner.query(`ALTER TABLE "services" ADD "preferredDuration" integer`);
        await queryRunner.query(`ALTER TABLE "services" ADD "instrumentOrderMatters" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."availability_appointments_appointmenttype_enum" AS ENUM('standard', 'gym'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "appointmentType" "public"."availability_appointments_appointmenttype_enum" NOT NULL DEFAULT 'standard'`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "gymRoomId" uuid`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "instrumentOrderMatters" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`CREATE INDEX "IDX_gym_schedules_operator_day" ON "gym_schedules" ("operatorId", "dayOfWeek") `);
        await queryRunner.query(`CREATE INDEX "IDX_gym_schedules_room_day" ON "gym_schedules" ("gymRoomId", "dayOfWeek") `);
        await queryRunner.query(`CREATE INDEX "IDX_availability_appointments_status_active" ON "availability_appointments" ("status") WHERE status != 'cancelled'`);
        await queryRunner.query(`CREATE INDEX "IDX_availability_appointments_date_time" ON "availability_appointments" ("appointmentDate", "startTime") `);
        await queryRunner.query(`CREATE INDEX "IDX_availability_appointments_operator_date" ON "availability_appointments" ("operatorId", "appointmentDate") `);
        await queryRunner.query(`ALTER TABLE "appointment_instruments" ADD CONSTRAINT "FK_521a599116f018403e4f3ef0f14" FOREIGN KEY ("appointmentId") REFERENCES "availability_appointments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointment_instruments" ADD CONSTRAINT "FK_59a1d8219ca943a141a3e1249f2" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_instruments" ADD CONSTRAINT "FK_5639803a34be3a08154f5deff60" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_instruments" ADD CONSTRAINT "FK_56f51717c831b1b4874e3f3e731" FOREIGN KEY ("instrumentCategoryId") REFERENCES "instrument_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD CONSTRAINT "FK_76c64f67fe069e86abe22d7fc0a" FOREIGN KEY ("gymRoomId") REFERENCES "gym_rooms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP CONSTRAINT "FK_76c64f67fe069e86abe22d7fc0a"`);
        await queryRunner.query(`ALTER TABLE "service_instruments" DROP CONSTRAINT "FK_56f51717c831b1b4874e3f3e731"`);
        await queryRunner.query(`ALTER TABLE "service_instruments" DROP CONSTRAINT "FK_5639803a34be3a08154f5deff60"`);
        await queryRunner.query(`ALTER TABLE "appointment_instruments" DROP CONSTRAINT "FK_59a1d8219ca943a141a3e1249f2"`);
        await queryRunner.query(`ALTER TABLE "appointment_instruments" DROP CONSTRAINT "FK_521a599116f018403e4f3ef0f14"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_availability_appointments_operator_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_availability_appointments_date_time"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_availability_appointments_status_active"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_gym_schedules_room_day"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_gym_schedules_operator_day"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "instrumentOrderMatters"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "gymRoomId"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "appointmentType"`);
        await queryRunner.query(`DROP TYPE "public"."availability_appointments_appointmenttype_enum"`);
        await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "instrumentOrderMatters"`);
        await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "preferredDuration"`);
        await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "macroCategory"`);
        await queryRunner.query(`DROP TYPE "public"."services_macrocategory_enum"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_service_instruments_service_category"`);
        await queryRunner.query(`DROP TABLE "service_instruments"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_appointment_instruments_appointment_instrument"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_appointment_instruments_instrument_appointment"`);
        await queryRunner.query(`DROP TABLE "appointment_instruments"`);
        await queryRunner.query(`CREATE INDEX "IDX_07d6c761ba9b5a3da515a1c909" ON "availability_appointments" ("appointmentDate", "operatorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d56a473d5a543083b104f41033" ON "availability_appointments" ("appointmentDate", "startTime") `);
        await queryRunner.query(`CREATE INDEX "IDX_2ed2edc46c1de2ac23457389c1" ON "availability_appointments" ("status") WHERE (status <> 'cancelled'::availability_appointments_status_enum)`);
        await queryRunner.query(`CREATE INDEX "IDX_d6a99307ed59dcd74bff0b46c6" ON "gym_schedules" ("dayOfWeek", "gymRoomId") `);
        await queryRunner.query(`CREATE INDEX "IDX_382f8ecad92978d1f059dd995b" ON "gym_schedules" ("dayOfWeek", "operatorId") `);
    }

}

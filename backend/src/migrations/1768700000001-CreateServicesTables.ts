import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateServicesTables1768700000001 implements MigrationInterface {
    name = 'CreateServicesTables1768700000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Crea tabella appointment_services (senza FK)
        await queryRunner.query(`
            CREATE TABLE "appointment_services" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "appointmentId" uuid NOT NULL,
                "serviceId" uuid NOT NULL,
                "customDuration" integer,
                "customPrice" decimal(10,2),
                "orderPosition" integer NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_appointment_services" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_appointment_service" UNIQUE ("appointmentId", "serviceId")
            )
        `);

        // 2. Crea tabella treatment_services (senza FK)
        await queryRunner.query(`
            CREATE TABLE "treatment_services" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "treatmentId" uuid NOT NULL,
                "serviceId" uuid NOT NULL,
                "price" decimal(10,2),
                "duration" integer,
                "orderPosition" integer NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_treatment_services" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_treatment_service" UNIQUE ("treatmentId", "serviceId")
            )
        `);

        // 3. Crea indici
        await queryRunner.query(`CREATE INDEX "IDX_appointment_services_appointment" ON "appointment_services" ("appointmentId")`);
        await queryRunner.query(`CREATE INDEX "IDX_appointment_services_service" ON "appointment_services" ("serviceId")`);
        await queryRunner.query(`CREATE INDEX "IDX_treatment_services_treatment" ON "treatment_services" ("treatmentId")`);
        await queryRunner.query(`CREATE INDEX "IDX_treatment_services_service" ON "treatment_services" ("serviceId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_treatment_services_service"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_treatment_services_treatment"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_appointment_services_service"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_appointment_services_appointment"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "treatment_services"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "appointment_services"`);
    }
}

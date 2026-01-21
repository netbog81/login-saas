import { MigrationInterface, QueryRunner } from "typeorm";

export class AddForeignKeysToServicesTables1768700000002 implements MigrationInterface {
    name = 'AddForeignKeysToServicesTables1768700000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "appointment_services"
            ADD CONSTRAINT "FK_appointment_services_appointment"
            FOREIGN KEY ("appointmentId") REFERENCES "availability_appointments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "appointment_services"
            ADD CONSTRAINT "FK_appointment_services_service"
            FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "treatment_services"
            ADD CONSTRAINT "FK_treatment_services_treatment"
            FOREIGN KEY ("treatmentId") REFERENCES "treatments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "treatment_services"
            ADD CONSTRAINT "FK_treatment_services_service"
            FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "treatment_services" DROP CONSTRAINT IF EXISTS "FK_treatment_services_service"`);
        await queryRunner.query(`ALTER TABLE "treatment_services" DROP CONSTRAINT IF EXISTS "FK_treatment_services_treatment"`);
        await queryRunner.query(`ALTER TABLE "appointment_services" DROP CONSTRAINT IF EXISTS "FK_appointment_services_service"`);
        await queryRunner.query(`ALTER TABLE "appointment_services" DROP CONSTRAINT IF EXISTS "FK_appointment_services_appointment"`);
    }
}

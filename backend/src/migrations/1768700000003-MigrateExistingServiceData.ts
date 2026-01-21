import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrateExistingServiceData1768700000003 implements MigrationInterface {
    name = 'MigrateExistingServiceData1768700000003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Migra dati esistenti da availability_appointments.serviceId a appointment_services
        await queryRunner.query(`
            INSERT INTO "appointment_services" ("appointmentId", "serviceId", "orderPosition")
            SELECT "id", "serviceId", 0
            FROM "availability_appointments"
            WHERE "serviceId" IS NOT NULL
        `);

        // Migra dati esistenti da treatments.serviceId a treatment_services
        await queryRunner.query(`
            INSERT INTO "treatment_services" ("treatmentId", "serviceId", "price", "orderPosition")
            SELECT "id", "serviceId", "price", 0
            FROM "treatments"
            WHERE "serviceId" IS NOT NULL
        `);

        // NOTA: Le colonne serviceId legacy vengono mantenute per retrocompatibilità.
        // Verranno rimosse in una migration successiva dopo la verifica del funzionamento.
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "treatment_services"`);
        await queryRunner.query(`DELETE FROM "appointment_services"`);
    }
}

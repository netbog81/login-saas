import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAppointmentConditionalIndices1765500000001 implements MigrationInterface {
    name = 'CreateAppointmentConditionalIndices1765500000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Forza il commit della transazione corrente
        await queryRunner.commitTransaction();
        
        // Ora inizia una nuova transazione
        await queryRunner.startTransaction();
        
        try {
            // Ora i nuovi valori ENUM sono committati e possono essere usati
            await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS "IDX_appointments_cancelled_late" 
                ON "availability_appointments" ("bookingStatus") 
                WHERE "bookingStatus" = 'cancelled_late'
            `);
            
            await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS "IDX_appointments_cancelled_early" 
                ON "availability_appointments" ("bookingStatus") 
                WHERE "bookingStatus" = 'cancelled_early'
            `);
            
            await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS "IDX_appointments_attended" 
                ON "availability_appointments" ("bookingStatus") 
                WHERE "bookingStatus" = 'attended'
            `);
        } catch (error) {
            // In caso di errore, rollback e rilancia
            await queryRunner.rollbackTransaction();
            throw error;
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_appointments_attended"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_appointments_cancelled_early"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_appointments_cancelled_late"`);
    }
}
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTreatmentSystem1765500000000 implements MigrationInterface {
    name = 'CreateTreatmentSystem1765500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add new values to booking_status enum
        await queryRunner.query(`ALTER TYPE "public"."availability_appointments_bookingstatus_enum" ADD VALUE IF NOT EXISTS 'cancelled_early'`);
        await queryRunner.query(`ALTER TYPE "public"."availability_appointments_bookingstatus_enum" ADD VALUE IF NOT EXISTS 'cancelled_late'`);
        await queryRunner.query(`ALTER TYPE "public"."availability_appointments_bookingstatus_enum" ADD VALUE IF NOT EXISTS 'attended'`);

        // 2. Add cancellation fields to availability_appointments
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "cancelledAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "cancelledBy" uuid`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "cancellationHoursNotice" decimal(10,2)`);

        // 3. Create treatment_status enum
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."treatments_status_enum" AS ENUM('in_progress', 'operator_completed', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

        // 4. Create payment_method enum
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."treatments_paymentmethod_enum" AS ENUM('cash', 'card', 'transfer', 'satispay', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

        // 5. Create treatments table
        await queryRunner.query(`
            CREATE TABLE "treatments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "appointmentId" uuid NOT NULL,
                "operatorId" uuid NOT NULL,
                "patientId" integer,
                "serviceId" uuid,
                "status" "public"."treatments_status_enum" NOT NULL DEFAULT 'in_progress',
                "isTest" boolean NOT NULL DEFAULT false,
                "startedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "completedAt" TIMESTAMP,
                "closedAt" TIMESTAMP,
                "clinicalNotes" text,
                "secretaryNotes" text,
                "operatorNotes" text,
                "price" decimal(10,2) NOT NULL DEFAULT '0',
                "isPaid" boolean NOT NULL DEFAULT false,
                "paymentMethod" "public"."treatments_paymentmethod_enum",
                "paidAt" TIMESTAMP,
                "collectedBy" uuid,
                "isInvoicedToPatient" boolean NOT NULL DEFAULT false,
                "invoicedToPatientAt" TIMESTAMP,
                "patientInvoiceNumber" character varying(100),
                "isInvoicedByOperator" boolean NOT NULL DEFAULT false,
                "invoicedByOperatorAt" TIMESTAMP,
                "operatorInvoiceNumber" character varying(100),
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_treatments_appointment" UNIQUE ("appointmentId"),
                CONSTRAINT "PK_treatments" PRIMARY KEY ("id")
            )
        `);

        // 6. Create treatment_instruments table
        await queryRunner.query(`
            CREATE TABLE "treatment_instruments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "treatmentId" uuid NOT NULL,
                "instrumentId" uuid NOT NULL,
                "instrumentCategoryId" uuid,
                "wasUsed" boolean NOT NULL DEFAULT true,
                "startOffsetMinutes" integer NOT NULL DEFAULT 0,
                "endOffsetMinutes" integer NOT NULL DEFAULT 30,
                "orderPosition" integer,
                CONSTRAINT "PK_treatment_instruments" PRIMARY KEY ("id")
            )
        `);

        // 7. Add royaltyPercentage to operators
        await queryRunner.query(`ALTER TABLE "operators" ADD "royaltyPercentage" decimal(5,2) NOT NULL DEFAULT '0'`);

        // 8. Create indexes for treatments
        await queryRunner.query(`CREATE INDEX "IDX_treatments_appointment" ON "treatments" ("appointmentId")`);
        await queryRunner.query(`CREATE INDEX "IDX_treatments_operator" ON "treatments" ("operatorId")`);
        await queryRunner.query(`CREATE INDEX "IDX_treatments_patient" ON "treatments" ("patientId")`);
        await queryRunner.query(`CREATE INDEX "IDX_treatments_status" ON "treatments" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_treatments_started_at" ON "treatments" ("startedAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_treatments_is_paid" ON "treatments" ("isPaid") WHERE "isPaid" = false`);
        await queryRunner.query(`CREATE INDEX "IDX_treatments_invoiced_patient" ON "treatments" ("isInvoicedToPatient") WHERE "isInvoicedToPatient" = false`);
        await queryRunner.query(`CREATE INDEX "IDX_treatments_invoiced_operator" ON "treatments" ("isInvoicedByOperator") WHERE "isInvoicedByOperator" = false`);

        // 9. Create indexes for treatment_instruments
        await queryRunner.query(`CREATE INDEX "IDX_treatment_instruments_treatment" ON "treatment_instruments" ("treatmentId")`);
        await queryRunner.query(`CREATE INDEX "IDX_treatment_instruments_instrument" ON "treatment_instruments" ("instrumentId")`);

        // 10. Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "treatments"
            ADD CONSTRAINT "FK_treatments_appointment"
            FOREIGN KEY ("appointmentId") REFERENCES "availability_appointments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "treatments"
            ADD CONSTRAINT "FK_treatments_operator"
            FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "treatments"
            ADD CONSTRAINT "FK_treatments_patient"
            FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "treatments"
            ADD CONSTRAINT "FK_treatments_service"
            FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "treatment_instruments"
            ADD CONSTRAINT "FK_treatment_instruments_treatment"
            FOREIGN KEY ("treatmentId") REFERENCES "treatments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "treatment_instruments"
            ADD CONSTRAINT "FK_treatment_instruments_instrument"
            FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "treatment_instruments"
            ADD CONSTRAINT "FK_treatment_instruments_category"
            FOREIGN KEY ("instrumentCategoryId") REFERENCES "instrument_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        // 11. RIMOSSO: CREATE INDEX "IDX_appointments_cancelled_late" 
        // Questo indice verrà creato in una migrazione separata perché usa un nuovo valore ENUM
        // che non può essere referenziato nella stessa transazione in cui viene creato
        
        // In alternativa, puoi creare un indice generico (senza WHERE) ora:
        await queryRunner.query(`CREATE INDEX "IDX_appointments_booking_status" ON "availability_appointments" ("bookingStatus")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_appointments_booking_status"`);

        // Drop foreign keys for treatment_instruments
        await queryRunner.query(`ALTER TABLE "treatment_instruments" DROP CONSTRAINT IF EXISTS "FK_treatment_instruments_category"`);
        await queryRunner.query(`ALTER TABLE "treatment_instruments" DROP CONSTRAINT IF EXISTS "FK_treatment_instruments_instrument"`);
        await queryRunner.query(`ALTER TABLE "treatment_instruments" DROP CONSTRAINT IF EXISTS "FK_treatment_instruments_treatment"`);

        // Drop foreign keys for treatments
        await queryRunner.query(`ALTER TABLE "treatments" DROP CONSTRAINT IF EXISTS "FK_treatments_service"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP CONSTRAINT IF EXISTS "FK_treatments_patient"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP CONSTRAINT IF EXISTS "FK_treatments_operator"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP CONSTRAINT IF EXISTS "FK_treatments_appointment"`);

        // Drop indexes for treatment_instruments
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_treatment_instruments_instrument"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_treatment_instruments_treatment"`);

        // Drop indexes for treatments
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_treatments_invoiced_operator"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_treatments_invoiced_patient"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_treatments_is_paid"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_treatments_started_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_treatments_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_treatments_patient"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_treatments_operator"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_treatments_appointment"`);

        // Drop royaltyPercentage from operators
        await queryRunner.query(`ALTER TABLE "operators" DROP COLUMN IF EXISTS "royaltyPercentage"`);

        // Drop treatment_instruments table
        await queryRunner.query(`DROP TABLE IF EXISTS "treatment_instruments"`);

        // Drop treatments table
        await queryRunner.query(`DROP TABLE IF EXISTS "treatments"`);

        // Drop enums
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."treatments_paymentmethod_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."treatments_status_enum"`);

        // Remove cancellation fields from availability_appointments
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN IF EXISTS "cancellationHoursNotice"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN IF EXISTS "cancelledBy"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN IF EXISTS "cancelledAt"`);

        // Note: Cannot easily remove enum values in PostgreSQL, they will remain
        // The old enum values 'scheduled', 'confirmed', 'cancelled', 'no_show' still work
    }
}
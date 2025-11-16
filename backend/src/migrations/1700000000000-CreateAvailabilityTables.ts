import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAvailabilityTables1700000000000 implements MigrationInterface {
    name = 'CreateAvailabilityTables1700000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create operators table
        await queryRunner.query(`
            CREATE TYPE "operator_type_enum" AS ENUM('standard', 'gym', 'resource');
        `);

        await queryRunner.query(`
            CREATE TABLE "operators" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "name" character varying(255) NOT NULL,
                "surname" character varying(255),
                "email" character varying(255) UNIQUE,
                "phone" character varying(50),
                "color" character varying(7),
                "operatorType" "operator_type_enum" NOT NULL DEFAULT 'standard',
                "maxConcurrentAppointments" integer NOT NULL DEFAULT 1,
                "isActive" boolean NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_operators" PRIMARY KEY ("id")
            );
        `);

        // Create services table
        await queryRunner.query(`
            CREATE TABLE "services" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "name" character varying(255) NOT NULL,
                "duration" integer NOT NULL,
                "bufferTime" integer NOT NULL DEFAULT 0,
                "color" character varying(7),
                "isActive" boolean NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_services" PRIMARY KEY ("id")
            );
        `);

        // Create operator_services table
        await queryRunner.query(`
            CREATE TABLE "operator_services" (
                "operatorId" uuid NOT NULL,
                "serviceId" uuid NOT NULL,
                "customDuration" integer,
                "customBufferTime" integer,
                CONSTRAINT "PK_operator_services" PRIMARY KEY ("operatorId", "serviceId"),
                CONSTRAINT "FK_operator_services_operator" FOREIGN KEY ("operatorId")
                    REFERENCES "operators"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_operator_services_service" FOREIGN KEY ("serviceId")
                    REFERENCES "services"("id") ON DELETE CASCADE
            );
        `);

        // Create availability_templates table
        await queryRunner.query(`
            CREATE TABLE "availability_templates" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "operatorId" uuid NOT NULL,
                "name" character varying(255),
                "description" text,
                "dayInPattern" integer NOT NULL,
                "patternDuration" integer NOT NULL,
                "patternStartDate" date NOT NULL,
                "startTime" time NOT NULL,
                "endTime" time NOT NULL,
                "version" integer NOT NULL DEFAULT 1,
                "isCurrent" boolean NOT NULL DEFAULT true,
                "validFrom" date NOT NULL,
                "validUntil" date,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_availability_templates" PRIMARY KEY ("id"),
                CONSTRAINT "FK_availability_templates_operator" FOREIGN KEY ("operatorId")
                    REFERENCES "operators"("id") ON DELETE CASCADE,
                CONSTRAINT "CHK_valid_pattern" CHECK ("dayInPattern" >= 0 AND "dayInPattern" < "patternDuration"),
                CONSTRAINT "CHK_valid_times" CHECK ("endTime" > "startTime")
            );
        `);

        // Create indices for availability_templates
        await queryRunner.query(`
            CREATE INDEX "IDX_availability_templates_operator_current"
                ON "availability_templates" ("operatorId", "isCurrent");
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_availability_templates_date_range"
                ON "availability_templates" ("validFrom", "validUntil");
        `);

        // Create group_exceptions table
        await queryRunner.query(`
            CREATE TABLE "group_exceptions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "name" character varying(255) NOT NULL,
                "exceptionDate" date NOT NULL,
                "exceptionType" character varying(50) NOT NULL,
                "appliesToAll" boolean NOT NULL DEFAULT false,
                "reason" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_group_exceptions" PRIMARY KEY ("id")
            );
        `);

        // Create exception type enum
        await queryRunner.query(`
            CREATE TYPE "exception_type_enum" AS ENUM('unavailable', 'modified', 'holiday', 'sick', 'vacation');
        `);

        // Create availability_exceptions table
        await queryRunner.query(`
            CREATE TABLE "availability_exceptions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "operatorId" uuid NOT NULL,
                "exceptionDate" date NOT NULL,
                "exceptionType" "exception_type_enum" NOT NULL,
                "startTime" time,
                "endTime" time,
                "groupExceptionId" uuid,
                "reason" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_availability_exceptions" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_availability_exceptions_operator_date" UNIQUE ("operatorId", "exceptionDate"),
                CONSTRAINT "FK_availability_exceptions_operator" FOREIGN KEY ("operatorId")
                    REFERENCES "operators"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_availability_exceptions_group" FOREIGN KEY ("groupExceptionId")
                    REFERENCES "group_exceptions"("id") ON DELETE CASCADE
            );
        `);

        // Create index for availability_exceptions
        await queryRunner.query(`
            CREATE INDEX "IDX_availability_exceptions_operator_date"
                ON "availability_exceptions" ("operatorId", "exceptionDate");
        `);

        // Create group_exception_operators junction table
        await queryRunner.query(`
            CREATE TABLE "group_exception_operators" (
                "groupExceptionId" uuid NOT NULL,
                "operatorId" uuid NOT NULL,
                CONSTRAINT "PK_group_exception_operators" PRIMARY KEY ("groupExceptionId", "operatorId"),
                CONSTRAINT "FK_group_exception_operators_group" FOREIGN KEY ("groupExceptionId")
                    REFERENCES "group_exceptions"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_group_exception_operators_operator" FOREIGN KEY ("operatorId")
                    REFERENCES "operators"("id") ON DELETE CASCADE
            );
        `);

        // Create availability_cache table
        await queryRunner.query(`
            CREATE TABLE "availability_cache" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "operatorId" uuid NOT NULL,
                "availableDate" date NOT NULL,
                "startTime" time NOT NULL,
                "endTime" time NOT NULL,
                "totalCapacity" integer NOT NULL DEFAULT 1,
                "bookedCapacity" integer NOT NULL DEFAULT 0,
                "source" character varying(50),
                "sourceId" uuid,
                "lastUpdated" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_availability_cache" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_availability_cache_operator_date_time"
                    UNIQUE ("operatorId", "availableDate", "startTime"),
                CONSTRAINT "FK_availability_cache_operator" FOREIGN KEY ("operatorId")
                    REFERENCES "operators"("id") ON DELETE CASCADE
            );
        `);

        // Create indices for availability_cache
        await queryRunner.query(`
            CREATE INDEX "IDX_availability_cache_lookup"
                ON "availability_cache" ("operatorId", "availableDate");
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_availability_cache_date_range"
                ON "availability_cache" ("availableDate", "startTime");
        `);

        // Create appointment status enum
        await queryRunner.query(`
            CREATE TYPE "appointment_status_enum" AS ENUM('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
        `);

        // Create appointments table
        await queryRunner.query(`
            CREATE TABLE "appointments" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "operatorId" uuid,
                "serviceId" uuid,
                "clientName" character varying(255) NOT NULL,
                "clientEmail" character varying(255),
                "clientPhone" character varying(50),
                "appointmentDate" date NOT NULL,
                "startTime" time NOT NULL,
                "endTime" time NOT NULL,
                "status" "appointment_status_enum" NOT NULL DEFAULT 'scheduled',
                "participantCount" integer NOT NULL DEFAULT 1,
                "maxParticipants" integer,
                "notes" text,
                "cancellationReason" text,
                "createdBy" uuid,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_appointments" PRIMARY KEY ("id"),
                CONSTRAINT "FK_appointments_operator" FOREIGN KEY ("operatorId")
                    REFERENCES "operators"("id") ON DELETE SET NULL,
                CONSTRAINT "FK_appointments_service" FOREIGN KEY ("serviceId")
                    REFERENCES "services"("id") ON DELETE SET NULL,
                CONSTRAINT "CHK_valid_appointment_times" CHECK ("endTime" > "startTime")
            );
        `);

        // Create indices for appointments
        await queryRunner.query(`
            CREATE INDEX "IDX_appointments_operator_date"
                ON "appointments" ("operatorId", "appointmentDate");
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_appointments_date_time"
                ON "appointments" ("appointmentDate", "startTime");
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_appointments_status"
                ON "appointments" ("status")
                WHERE "status" != 'cancelled';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop tables in reverse order of dependencies
        await queryRunner.query(`DROP TABLE "appointments"`);
        await queryRunner.query(`DROP TYPE "appointment_status_enum"`);

        await queryRunner.query(`DROP TABLE "availability_cache"`);
        await queryRunner.query(`DROP TABLE "group_exception_operators"`);
        await queryRunner.query(`DROP TABLE "availability_exceptions"`);
        await queryRunner.query(`DROP TYPE "exception_type_enum"`);

        await queryRunner.query(`DROP TABLE "group_exceptions"`);
        await queryRunner.query(`DROP TABLE "availability_templates"`);
        await queryRunner.query(`DROP TABLE "operator_services"`);
        await queryRunner.query(`DROP TABLE "services"`);
        await queryRunner.query(`DROP TABLE "operators"`);
        await queryRunner.query(`DROP TYPE "operator_type_enum"`);
    }
}
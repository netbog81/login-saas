import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1763633879179 implements MigrationInterface {
    name = 'InitialSchema1763633879179'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "availability_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "operatorId" uuid NOT NULL, "name" character varying(255), "description" text, "dayInPattern" integer NOT NULL, "patternDuration" integer NOT NULL, "patternStartDate" date NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "version" integer NOT NULL DEFAULT '1', "isCurrent" boolean NOT NULL DEFAULT true, "validFrom" date NOT NULL, "validUntil" date, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_19d5fc85a226201158cbc6d2523" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9eec370230efdd95bef9b08f98" ON "availability_templates" ("validFrom", "validUntil") `);
        await queryRunner.query(`CREATE INDEX "IDX_9bd0d69454e5241114fc838892" ON "availability_templates" ("operatorId", "isCurrent") `);
        await queryRunner.query(`CREATE TABLE "group_exceptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "exceptionDate" date NOT NULL, "exceptionType" character varying(50) NOT NULL, "appliesToAll" boolean NOT NULL DEFAULT false, "reason" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0e2a62f172b16b0b50bb104fa35" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."availability_exceptions_exceptiontype_enum" AS ENUM('unavailable', 'modified', 'holiday', 'sick', 'vacation')`);
        await queryRunner.query(`CREATE TABLE "availability_exceptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "operatorId" uuid NOT NULL, "exceptionDate" date NOT NULL, "exceptionType" "public"."availability_exceptions_exceptiontype_enum" NOT NULL, "startTime" TIME, "endTime" TIME, "groupExceptionId" uuid, "reason" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9fc193c0c9a0141a46175ab91c6" UNIQUE ("operatorId", "exceptionDate"), CONSTRAINT "PK_f5a89a7a6221bc93b517a13351f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9fc193c0c9a0141a46175ab91c" ON "availability_exceptions" ("operatorId", "exceptionDate") `);
        await queryRunner.query(`CREATE TABLE "operator_services" ("operatorId" uuid NOT NULL, "serviceId" uuid NOT NULL, "customDuration" integer, "customBufferTime" integer, CONSTRAINT "PK_6b40802bc4bca55a466ea0977e8" PRIMARY KEY ("operatorId", "serviceId"))`);
        await queryRunner.query(`CREATE TABLE "services" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text, "defaultDuration" integer NOT NULL, "defaultPrice" numeric(10,2) NOT NULL DEFAULT '0', "bufferTimeBefore" integer NOT NULL DEFAULT '0', "bufferTimeAfter" integer NOT NULL DEFAULT '0', "color" character varying(7), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ba2d347a3168a296416c6c5ccb2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."availability_appointments_status_enum" AS ENUM('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')`);
        await queryRunner.query(`CREATE TABLE "availability_appointments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "operatorId" uuid, "serviceId" uuid, "clientName" character varying(255) NOT NULL, "clientEmail" character varying(255), "clientPhone" character varying(50), "appointmentDate" date NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "status" "public"."availability_appointments_status_enum" NOT NULL DEFAULT 'scheduled', "participantCount" integer NOT NULL DEFAULT '1', "maxParticipants" integer, "notes" text, "cancellationReason" text, "createdBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_63207d8062d4ff10839937b2efd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2ed2edc46c1de2ac23457389c1" ON "availability_appointments" ("status") WHERE status != 'cancelled'`);
        await queryRunner.query(`CREATE INDEX "IDX_d56a473d5a543083b104f41033" ON "availability_appointments" ("appointmentDate", "startTime") `);
        await queryRunner.query(`CREATE INDEX "IDX_07d6c761ba9b5a3da515a1c909" ON "availability_appointments" ("operatorId", "appointmentDate") `);
        await queryRunner.query(`CREATE TYPE "public"."operators_operatortype_enum" AS ENUM('standard', 'gym', 'resource')`);
        await queryRunner.query(`CREATE TABLE "operators" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "surname" character varying(255), "email" character varying(255), "phone" character varying(50), "color" character varying(7), "operatorType" "public"."operators_operatortype_enum" NOT NULL DEFAULT 'standard', "maxConcurrentAppointments" integer NOT NULL DEFAULT '1', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1570f3d85c3ff08bb99815897a2" UNIQUE ("email"), CONSTRAINT "PK_3d02b3692836893720335a79d1b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "template_patterns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text, "dayInPattern" integer NOT NULL, "patternDuration" integer NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a0a7db63ee084e02341767ec1cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2d195a091aaf4522a303cc7d88" ON "template_patterns" ("name") `);
        await queryRunner.query(`CREATE TABLE "template_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "operatorId" uuid NOT NULL, "patternId" uuid NOT NULL, "patternStartDate" date NOT NULL, "validFrom" date NOT NULL, "validUntil" date, "version" integer NOT NULL DEFAULT '1', "isCurrent" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0a6dab5a9e55a1f3906f709961e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_71860755fad0e250833179807c" ON "template_assignments" ("validFrom", "validUntil") `);
        await queryRunner.query(`CREATE INDEX "IDX_ae93f27aede9f9eb5f8734ab0d" ON "template_assignments" ("operatorId", "isCurrent") `);
        await queryRunner.query(`CREATE TABLE "availability_cache" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "operatorId" uuid NOT NULL, "availableDate" date NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "totalCapacity" integer NOT NULL DEFAULT '1', "bookedCapacity" integer NOT NULL DEFAULT '0', "source" character varying(50), "sourceId" uuid, "lastUpdated" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_941caae8b5de3e258c8b625eb8b" UNIQUE ("operatorId", "availableDate", "startTime"), CONSTRAINT "PK_0a1d447b99f5ce003a351e9b1bf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d725703578e0626694bdc6b67e" ON "availability_cache" ("availableDate", "startTime") `);
        await queryRunner.query(`CREATE INDEX "IDX_27e9b90da3514d3fffad4f3a6f" ON "availability_cache" ("operatorId", "availableDate") `);
        await queryRunner.query(`CREATE TABLE "patients" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "surname" character varying NOT NULL, "phone" character varying NOT NULL, "email" character varying, "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a7f0b9fcbb3469d5ec0b0aceaa7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "appointments" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "date" date NOT NULL, "startTime" character varying NOT NULL, "endTime" character varying NOT NULL, "userId" integer NOT NULL, "patientId" integer, "notes" text, "repeat" jsonb, "recurringGroupId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "availabilities" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "date" date NOT NULL, "startTime" character varying NOT NULL, "endTime" character varying NOT NULL, "available" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9562bd8681d40361b1a124ea52c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "type" character varying NOT NULL, "color" character varying NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "group_exception_operators" ("groupExceptionId" uuid NOT NULL, "operatorId" uuid NOT NULL, CONSTRAINT "PK_14eae2e7a2856bfcff5e6d1a9e3" PRIMARY KEY ("groupExceptionId", "operatorId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_02a9f063ab63eb1622f79d78c7" ON "group_exception_operators" ("groupExceptionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_306b38a87ea02a8e72e1775481" ON "group_exception_operators" ("operatorId") `);
        await queryRunner.query(`ALTER TABLE "availability_templates" ADD CONSTRAINT "FK_6a837a58662795648489a4b00b2" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "availability_exceptions" ADD CONSTRAINT "FK_25a5bf7a2c537001025441543e8" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "availability_exceptions" ADD CONSTRAINT "FK_31f3e4250baf4c991f4ae0fedb3" FOREIGN KEY ("groupExceptionId") REFERENCES "group_exceptions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "operator_services" ADD CONSTRAINT "FK_ff81248e9409885facfa2469ac0" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "operator_services" ADD CONSTRAINT "FK_43c4c1380201e0f7e44add24dfa" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD CONSTRAINT "FK_18f0c83cad918228c7e5c8744bb" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD CONSTRAINT "FK_b2253cfad22d2828de4173013f5" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "template_assignments" ADD CONSTRAINT "FK_2bd9bce5e3f9dc9b8240e300de8" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "template_assignments" ADD CONSTRAINT "FK_a6c7d8c752f01bef612089e6c7a" FOREIGN KEY ("patternId") REFERENCES "template_patterns"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "availability_cache" ADD CONSTRAINT "FK_79e846140b3e6ece0a4d12fdd8c" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_01733651151c8a1d6d980135cc4" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_13c2e57cb81b44f062ba24df57d" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "availabilities" ADD CONSTRAINT "FK_4cf4c255dc6d83b9e978a5ab0a0" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_exception_operators" ADD CONSTRAINT "FK_02a9f063ab63eb1622f79d78c77" FOREIGN KEY ("groupExceptionId") REFERENCES "group_exceptions"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "group_exception_operators" ADD CONSTRAINT "FK_306b38a87ea02a8e72e1775481b" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group_exception_operators" DROP CONSTRAINT "FK_306b38a87ea02a8e72e1775481b"`);
        await queryRunner.query(`ALTER TABLE "group_exception_operators" DROP CONSTRAINT "FK_02a9f063ab63eb1622f79d78c77"`);
        await queryRunner.query(`ALTER TABLE "availabilities" DROP CONSTRAINT "FK_4cf4c255dc6d83b9e978a5ab0a0"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_13c2e57cb81b44f062ba24df57d"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_01733651151c8a1d6d980135cc4"`);
        await queryRunner.query(`ALTER TABLE "availability_cache" DROP CONSTRAINT "FK_79e846140b3e6ece0a4d12fdd8c"`);
        await queryRunner.query(`ALTER TABLE "template_assignments" DROP CONSTRAINT "FK_a6c7d8c752f01bef612089e6c7a"`);
        await queryRunner.query(`ALTER TABLE "template_assignments" DROP CONSTRAINT "FK_2bd9bce5e3f9dc9b8240e300de8"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP CONSTRAINT "FK_b2253cfad22d2828de4173013f5"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP CONSTRAINT "FK_18f0c83cad918228c7e5c8744bb"`);
        await queryRunner.query(`ALTER TABLE "operator_services" DROP CONSTRAINT "FK_43c4c1380201e0f7e44add24dfa"`);
        await queryRunner.query(`ALTER TABLE "operator_services" DROP CONSTRAINT "FK_ff81248e9409885facfa2469ac0"`);
        await queryRunner.query(`ALTER TABLE "availability_exceptions" DROP CONSTRAINT "FK_31f3e4250baf4c991f4ae0fedb3"`);
        await queryRunner.query(`ALTER TABLE "availability_exceptions" DROP CONSTRAINT "FK_25a5bf7a2c537001025441543e8"`);
        await queryRunner.query(`ALTER TABLE "availability_templates" DROP CONSTRAINT "FK_6a837a58662795648489a4b00b2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_306b38a87ea02a8e72e1775481"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_02a9f063ab63eb1622f79d78c7"`);
        await queryRunner.query(`DROP TABLE "group_exception_operators"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "availabilities"`);
        await queryRunner.query(`DROP TABLE "appointments"`);
        await queryRunner.query(`DROP TABLE "patients"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_27e9b90da3514d3fffad4f3a6f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d725703578e0626694bdc6b67e"`);
        await queryRunner.query(`DROP TABLE "availability_cache"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ae93f27aede9f9eb5f8734ab0d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_71860755fad0e250833179807c"`);
        await queryRunner.query(`DROP TABLE "template_assignments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d195a091aaf4522a303cc7d88"`);
        await queryRunner.query(`DROP TABLE "template_patterns"`);
        await queryRunner.query(`DROP TABLE "operators"`);
        await queryRunner.query(`DROP TYPE "public"."operators_operatortype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_07d6c761ba9b5a3da515a1c909"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d56a473d5a543083b104f41033"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2ed2edc46c1de2ac23457389c1"`);
        await queryRunner.query(`DROP TABLE "availability_appointments"`);
        await queryRunner.query(`DROP TYPE "public"."availability_appointments_status_enum"`);
        await queryRunner.query(`DROP TABLE "services"`);
        await queryRunner.query(`DROP TABLE "operator_services"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9fc193c0c9a0141a46175ab91c"`);
        await queryRunner.query(`DROP TABLE "availability_exceptions"`);
        await queryRunner.query(`DROP TYPE "public"."availability_exceptions_exceptiontype_enum"`);
        await queryRunner.query(`DROP TABLE "group_exceptions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9bd0d69454e5241114fc838892"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9eec370230efdd95bef9b08f98"`);
        await queryRunner.query(`DROP TABLE "availability_templates"`);
    }

}

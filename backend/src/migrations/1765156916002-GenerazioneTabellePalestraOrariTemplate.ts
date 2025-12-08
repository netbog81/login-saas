import { MigrationInterface, QueryRunner } from "typeorm";

export class GenerazioneTabellePalestraOrariTemplate1765156916002 implements MigrationInterface {
    name = 'GenerazioneTabellePalestraOrariTemplate1765156916002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_appointments_operatorId"`);
        await queryRunner.query(`CREATE TABLE "gym_template_patterns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "gymPatternGroupId" uuid NOT NULL, "operatorId" uuid NOT NULL, "dayInPattern" integer NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_10e3e454f402749ef7ffa31b80c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_82be949da27ed0530b635f12fa" ON "gym_template_patterns" ("operatorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a9696f98c51c7507de58c71095" ON "gym_template_patterns" ("gymPatternGroupId", "dayInPattern") `);
        await queryRunner.query(`CREATE INDEX "IDX_3958316e2c49cf81f3db43bbfb" ON "gym_template_patterns" ("gymPatternGroupId") `);
        await queryRunner.query(`CREATE TABLE "gym_pattern_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "gymRoomId" uuid NOT NULL, "name" character varying(255) NOT NULL, "description" text, "patternDuration" integer NOT NULL DEFAULT '7', "patternStartDate" date NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "isCurrent" boolean NOT NULL DEFAULT true, "version" integer NOT NULL DEFAULT '1', "validFrom" date NOT NULL, "validUntil" date, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ded6903bc4018d7b85ec3c74693" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0685eb48213022765487e1ff06" ON "gym_pattern_groups" ("gymRoomId", "isCurrent") WHERE "isCurrent" = true`);
        await queryRunner.query(`CREATE INDEX "IDX_03da86cbd59fbda993dfa3ab51" ON "gym_pattern_groups" ("gymRoomId") `);
        await queryRunner.query(`CREATE TYPE "public"."gym_exceptions_exceptiontype_enum" AS ENUM('closed', 'operator_absent', 'modified_hours')`);
        await queryRunner.query(`CREATE TABLE "gym_exceptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "gymRoomId" uuid NOT NULL, "operatorId" uuid, "exceptionDate" date NOT NULL, "startTime" TIME, "endTime" TIME, "exceptionType" "public"."gym_exceptions_exceptiontype_enum" NOT NULL, "substituteOperatorId" uuid, "reason" text, "createdBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a6e0ffe31b83877006d1fa623ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_59df9a10f23b8a7da4236efb3a" ON "gym_exceptions" ("operatorId", "exceptionDate") `);
        await queryRunner.query(`CREATE INDEX "IDX_f1a33deee249503f333af8626a" ON "gym_exceptions" ("gymRoomId", "exceptionDate") `);
        await queryRunner.query(`ALTER TABLE "gym_rooms" ADD "defaultStartTime" TIME`);
        await queryRunner.query(`ALTER TABLE "gym_rooms" ADD "defaultEndTime" TIME`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "originalOperatorId" uuid`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "isSubstitution" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD "substitutionReason" text`);
        await queryRunner.query(`ALTER TABLE "gym_template_patterns" ADD CONSTRAINT "FK_3958316e2c49cf81f3db43bbfb9" FOREIGN KEY ("gymPatternGroupId") REFERENCES "gym_pattern_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gym_template_patterns" ADD CONSTRAINT "FK_82be949da27ed0530b635f12fa6" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gym_pattern_groups" ADD CONSTRAINT "FK_03da86cbd59fbda993dfa3ab510" FOREIGN KEY ("gymRoomId") REFERENCES "gym_rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gym_exceptions" ADD CONSTRAINT "FK_75bafdcc5f31ff825591c29fa79" FOREIGN KEY ("gymRoomId") REFERENCES "gym_rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gym_exceptions" ADD CONSTRAINT "FK_4feec5f3d7715e5b67f77c0f5e3" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gym_exceptions" ADD CONSTRAINT "FK_0c2eabff69a1074924ae80a6bcd" FOREIGN KEY ("substituteOperatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" ADD CONSTRAINT "FK_1a13560959a60dec360171ed8e4" FOREIGN KEY ("originalOperatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_c981ad9ee411175b3eccd9ca97d" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_c981ad9ee411175b3eccd9ca97d"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP CONSTRAINT "FK_1a13560959a60dec360171ed8e4"`);
        await queryRunner.query(`ALTER TABLE "gym_exceptions" DROP CONSTRAINT "FK_0c2eabff69a1074924ae80a6bcd"`);
        await queryRunner.query(`ALTER TABLE "gym_exceptions" DROP CONSTRAINT "FK_4feec5f3d7715e5b67f77c0f5e3"`);
        await queryRunner.query(`ALTER TABLE "gym_exceptions" DROP CONSTRAINT "FK_75bafdcc5f31ff825591c29fa79"`);
        await queryRunner.query(`ALTER TABLE "gym_pattern_groups" DROP CONSTRAINT "FK_03da86cbd59fbda993dfa3ab510"`);
        await queryRunner.query(`ALTER TABLE "gym_template_patterns" DROP CONSTRAINT "FK_82be949da27ed0530b635f12fa6"`);
        await queryRunner.query(`ALTER TABLE "gym_template_patterns" DROP CONSTRAINT "FK_3958316e2c49cf81f3db43bbfb9"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "substitutionReason"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "isSubstitution"`);
        await queryRunner.query(`ALTER TABLE "availability_appointments" DROP COLUMN "originalOperatorId"`);
        await queryRunner.query(`ALTER TABLE "gym_rooms" DROP COLUMN "defaultEndTime"`);
        await queryRunner.query(`ALTER TABLE "gym_rooms" DROP COLUMN "defaultStartTime"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f1a33deee249503f333af8626a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_59df9a10f23b8a7da4236efb3a"`);
        await queryRunner.query(`DROP TABLE "gym_exceptions"`);
        await queryRunner.query(`DROP TYPE "public"."gym_exceptions_exceptiontype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_03da86cbd59fbda993dfa3ab51"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0685eb48213022765487e1ff06"`);
        await queryRunner.query(`DROP TABLE "gym_pattern_groups"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3958316e2c49cf81f3db43bbfb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a9696f98c51c7507de58c71095"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_82be949da27ed0530b635f12fa"`);
        await queryRunner.query(`DROP TABLE "gym_template_patterns"`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_appointments_operatorId" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}

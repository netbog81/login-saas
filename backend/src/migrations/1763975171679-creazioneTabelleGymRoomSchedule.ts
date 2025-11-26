import { MigrationInterface, QueryRunner } from "typeorm";

export class CreazioneTabelleGymRoomSchedule1763975171679 implements MigrationInterface {
    name = 'CreazioneTabelleGymRoomSchedule1763975171679'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "gym_rooms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "maxCapacity" integer NOT NULL DEFAULT '4', "slotDuration" integer NOT NULL DEFAULT '60', "color" character varying(7), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_40ad1032779efdaaabb6dc73928" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "gym_schedules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "gymRoomId" uuid NOT NULL, "operatorId" uuid NOT NULL, "dayOfWeek" integer NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "validFrom" date, "validUntil" date, "isCurrent" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3f2592946b810b753db77726102" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_382f8ecad92978d1f059dd995b" ON "gym_schedules" ("operatorId", "dayOfWeek") `);
        await queryRunner.query(`CREATE INDEX "IDX_d6a99307ed59dcd74bff0b46c6" ON "gym_schedules" ("gymRoomId", "dayOfWeek") `);
        await queryRunner.query(`ALTER TABLE "gym_schedules" ADD CONSTRAINT "FK_babdf2f392c4f38335241b60455" FOREIGN KEY ("gymRoomId") REFERENCES "gym_rooms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gym_schedules" ADD CONSTRAINT "FK_32fba8b6818c2d3e87712331806" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "gym_schedules" DROP CONSTRAINT "FK_32fba8b6818c2d3e87712331806"`);
        await queryRunner.query(`ALTER TABLE "gym_schedules" DROP CONSTRAINT "FK_babdf2f392c4f38335241b60455"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d6a99307ed59dcd74bff0b46c6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_382f8ecad92978d1f059dd995b"`);
        await queryRunner.query(`DROP TABLE "gym_schedules"`);
        await queryRunner.query(`DROP TABLE "gym_rooms"`);
    }

}

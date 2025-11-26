import { MigrationInterface, QueryRunner } from "typeorm";

export class CreazioneRooms1763977304695 implements MigrationInterface {
    name = 'CreazioneRooms1763977304695'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "rooms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "capacity" integer NOT NULL DEFAULT '1', "color" character varying(7), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0368a2d7c215f2d0458a54933f2" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "rooms"`);
    }

}

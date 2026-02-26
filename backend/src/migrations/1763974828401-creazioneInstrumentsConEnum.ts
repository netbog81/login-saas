import { MigrationInterface, QueryRunner } from "typeorm";

export class CreazioneInstrumentsConEnum1763974828401 implements MigrationInterface {
    name = 'CreazioneInstrumentsConEnum1763974828401'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."instruments_status_enum" AS ENUM('active', 'unavailable', 'maintenance'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
        await queryRunner.query(`CREATE TABLE "instruments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "categoryId" uuid NOT NULL, "name" character varying(255) NOT NULL, "brand" character varying(255), "model" character varying(255), "verificationExpiry" date, "status" "public"."instruments_status_enum" NOT NULL DEFAULT 'active', "technicalData" jsonb, "color" character varying(7), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_44d772c3199b38559c5fb666eb6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "instruments" ADD CONSTRAINT "FK_c727b9cb6a98c7e72d5ad615f4d" FOREIGN KEY ("categoryId") REFERENCES "instrument_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "instruments" DROP CONSTRAINT "FK_c727b9cb6a98c7e72d5ad615f4d"`);
        await queryRunner.query(`DROP TABLE "instruments"`);
        await queryRunner.query(`DROP TYPE "public"."instruments_status_enum"`);
    }

}

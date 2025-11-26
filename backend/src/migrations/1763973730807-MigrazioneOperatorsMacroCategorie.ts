import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrazioneOperatorsMacroCategorie1763973730807 implements MigrationInterface {
    name = 'MigrazioneOperatorsMacroCategorie1763973730807'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."operator_categories_macrocategory_enum" AS ENUM('doctor', 'physiotherapist', 'gym_instructor')`);
        await queryRunner.query(`CREATE TABLE "operator_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "macroCategory" "public"."operator_categories_macrocategory_enum" NOT NULL, "name" character varying(255) NOT NULL, "description" text, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_371a981e437515b54c6f4287031" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."instrument_categories_macrocategory_enum" AS ENUM('doctor', 'physiotherapist', 'gym_instructor')`);
        await queryRunner.query(`CREATE TABLE "instrument_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "macroCategory" "public"."instrument_categories_macrocategory_enum" NOT NULL DEFAULT 'physiotherapist', "name" character varying(255) NOT NULL, "description" text, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_30d5514b366f5dbd4b3528c75d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "operators" DROP COLUMN "operatorType"`);
        await queryRunner.query(`DROP TYPE "public"."operators_operatortype_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."operators_macrocategory_enum" AS ENUM('doctor', 'physiotherapist', 'gym_instructor')`);
        await queryRunner.query(`ALTER TABLE "operators" ADD "macroCategory" "public"."operators_macrocategory_enum" NOT NULL DEFAULT 'physiotherapist'`);
        await queryRunner.query(`ALTER TABLE "operators" ADD "categoryId" uuid`);
        await queryRunner.query(`ALTER TABLE "operators" ADD "preferredDurations" integer array`);
        await queryRunner.query(`ALTER TABLE "operators" ADD "legacyUserId" integer`);
        await queryRunner.query(`ALTER TABLE "operators" ADD CONSTRAINT "FK_e29a32cc62c0c6e3ed9749436ff" FOREIGN KEY ("categoryId") REFERENCES "operator_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "operators" DROP CONSTRAINT "FK_e29a32cc62c0c6e3ed9749436ff"`);
        await queryRunner.query(`ALTER TABLE "operators" DROP COLUMN "legacyUserId"`);
        await queryRunner.query(`ALTER TABLE "operators" DROP COLUMN "preferredDurations"`);
        await queryRunner.query(`ALTER TABLE "operators" DROP COLUMN "categoryId"`);
        await queryRunner.query(`ALTER TABLE "operators" DROP COLUMN "macroCategory"`);
        await queryRunner.query(`DROP TYPE "public"."operators_macrocategory_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."operators_operatortype_enum" AS ENUM('standard', 'gym', 'resource')`);
        await queryRunner.query(`ALTER TABLE "operators" ADD "operatorType" "public"."operators_operatortype_enum" NOT NULL DEFAULT 'standard'`);
        await queryRunner.query(`DROP TABLE "instrument_categories"`);
        await queryRunner.query(`DROP TYPE "public"."instrument_categories_macrocategory_enum"`);
        await queryRunner.query(`DROP TABLE "operator_categories"`);
        await queryRunner.query(`DROP TYPE "public"."operator_categories_macrocategory_enum"`);
    }

}

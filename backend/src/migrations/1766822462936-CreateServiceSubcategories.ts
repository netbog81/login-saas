import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateServiceSubcategories1766821781021 implements MigrationInterface {
    name = 'CreateServiceSubcategories1766821781021'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // STEP 1: Prima aggiornare i valori NULL a 'other'
        // Ora 'other' esiste già (committato nella migration precedente)
        await queryRunner.query(`
            UPDATE "services" 
            SET "macroCategory" = 'other'
            WHERE "macroCategory" IS NULL
        `);

        // STEP 2: Creare enum per la tabella sottocategorie
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."service_subcategories_macrocategory_enum" AS ENUM('doctor', 'physiotherapist', 'gym_instructor', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

        // STEP 3: Creare tabella service_subcategories
        await queryRunner.query(`
            CREATE TABLE "service_subcategories" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "macroCategory" "public"."service_subcategories_macrocategory_enum" NOT NULL,
                "name" character varying(255) NOT NULL,
                "description" text,
                "isActive" boolean NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_service_subcategories" PRIMARY KEY ("id")
            )
        `);

        // STEP 4: Aggiungere nuove colonne a services
        await queryRunner.query(`ALTER TABLE "services" ADD "discountFE" decimal(10,2)`);
        await queryRunner.query(`ALTER TABLE "services" ADD "subcategoryId" uuid`);

        // STEP 5: Aggiungere foreign key
        await queryRunner.query(`
            ALTER TABLE "services"
            ADD CONSTRAINT "FK_services_subcategory"
            FOREIGN KEY ("subcategoryId") REFERENCES "service_subcategories"("id")
            ON DELETE SET NULL
        `);

        // STEP 6: Verifica che non ci siano più valori NULL
        const result = await queryRunner.query(`
            SELECT COUNT(*) as null_count 
            FROM "services" 
            WHERE "macroCategory" IS NULL
        `);
        
        if (parseInt(result[0]?.null_count) > 0) {
            console.warn(`ATTENZIONE: Rimangono ${result[0].null_count} servizi con macroCategory NULL`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // STEP 1: Rimuovere foreign key
        await queryRunner.query(`ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "FK_services_subcategory"`);

        // STEP 2: Rimuovere colonne
        await queryRunner.query(`ALTER TABLE "services" DROP COLUMN IF EXISTS "subcategoryId"`);
        await queryRunner.query(`ALTER TABLE "services" DROP COLUMN IF EXISTS "discountFE"`);

        // STEP 3: Rimuovere tabella sottocategorie
        await queryRunner.query(`DROP TABLE IF EXISTS "service_subcategories"`);
        
        // STEP 4: Rimuovere il tipo enum creato
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."service_subcategories_macrocategory_enum"`);
        
        // STEP 5: Impostare i valori 'other' a NULL per il rollback completo
        await queryRunner.query(`
            UPDATE "services" 
            SET "macroCategory" = NULL 
            WHERE "macroCategory" = 'other'
        `);
    }
}
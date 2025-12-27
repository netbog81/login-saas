import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOtherToServicesEnum1766821781020 implements MigrationInterface {
    name = 'AddOtherToServicesEnum1766821781020'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // STEP 1: Solo aggiungere il valore all'enum
        // NON fare UPDATE nella stessa transazione
        await queryRunner.query(`
            ALTER TYPE "public"."services_macrocategory_enum" 
            ADD VALUE IF NOT EXISTS 'other'
        `);
        
        // NOTA: L'UPDATE verrà fatto nella migration successiva
        // dopo che questa transazione è stata committata
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Non possiamo rimuovere 'other' dall'enum
        // Ma possiamo gestire il rollback in modo diverso
        console.warn("NOTA: Non è possibile rimuovere 'other' dall'enum services_macrocategory_enum");
        console.warn("I valori 'other' rimarranno nell'enum ma verranno impostati a NULL");
        
        // Imposta i valori 'other' a NULL (sarà gestito dalla seconda migration nel down)
        await queryRunner.query(`
            UPDATE "services" 
            SET "macroCategory" = NULL 
            WHERE "macroCategory" = 'other'
        `);
    }
}
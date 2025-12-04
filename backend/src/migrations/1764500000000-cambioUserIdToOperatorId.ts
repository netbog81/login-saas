import { MigrationInterface, QueryRunner } from "typeorm";

export class CambioUserIdToOperatorId1764500000000 implements MigrationInterface {
    name = 'CambioUserIdToOperatorId1764500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Rimuovi la foreign key esistente verso users
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "FK_01733651151c8a1d6d980135cc4"`);

        // 2. Aggiungi la nuova colonna operatorId come UUID
        await queryRunner.query(`ALTER TABLE "appointments" ADD "operatorId" uuid`);

        // 3. Aggiungi la foreign key verso operators
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_appointments_operatorId" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        // 4. Rimuovi la vecchia colonna userId
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN IF EXISTS "userId"`);

        // 5. Rendi operatorId NOT NULL (dopo aver migrato i dati esistenti se necessario)
        // NOTA: Se ci sono appuntamenti esistenti senza operatorId, questa query fallirà
        // In quel caso, prima migra i dati o rimuovi gli appuntamenti orfani
        await queryRunner.query(`ALTER TABLE "appointments" ALTER COLUMN "operatorId" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Ripristina userId
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "FK_appointments_operatorId"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "operatorId"`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "userId" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_01733651151c8a1d6d980135cc4" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }
}

import { MigrationInterface, QueryRunner } from "typeorm";

export class CambioTipoVerificationExpiry1764400000000 implements MigrationInterface {
    name = 'CambioTipoVerificationExpiry1764400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Cambia il tipo della colonna da date a timestamp
        await queryRunner.query(`ALTER TABLE "instruments" ALTER COLUMN "verificationExpiry" TYPE TIMESTAMP USING "verificationExpiry"::timestamp`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Ripristina il tipo originale date
        await queryRunner.query(`ALTER TABLE "instruments" ALTER COLUMN "verificationExpiry" TYPE DATE USING "verificationExpiry"::date`);
    }

}

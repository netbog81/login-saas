import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabella operator_absence_types (tassonomia configurabile
 * dei tipi di assenza operatore usata nelle GymException OPERATOR_ABSENT).
 *
 * Le GymException mantengono uno snapshot del tipo (nome + descrizione) al
 * momento della creazione, quindi la cancellazione di un tipo non comporta
 * perdita di dati storici — per questo motivo non c'è una FK diretta da
 * gym_exceptions.absenceTypeId → operator_absence_types.id (vedi migrazione
 * 1778000000001).
 */
export class CreateOperatorAbsenceTypes1778000000000 implements MigrationInterface {
  name = 'CreateOperatorAbsenceTypes1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Assicura che l'estensione uuid-ossp sia presente nello schema public
    // (necessaria per public.uuid_generate_v4() richiamata sotto).
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public`);

    await queryRunner.query(`
      CREATE TABLE "operator_absence_types" (
        "id" uuid NOT NULL DEFAULT public.uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "description" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_operator_absence_types" PRIMARY KEY ("id")
      )
    `);

    // Univocità case-insensitive sul nome
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_operator_absence_types_name_lower"
      ON "operator_absence_types" (LOWER("name"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_operator_absence_types_name_lower"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "operator_absence_types"`);
  }
}

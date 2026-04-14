import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aggiunge il flag esplicito `isClosed` su gym_exception_substitutes per
 * distinguere tra:
 *  - slot scoperto/dimenticato (substituteOperatorId NULL, isClosed=false)
 *  - slot chiuso esplicitamente dall'utente (substituteOperatorId NULL, isClosed=true)
 *
 * Nota: la semantica runtime di indisponibilità è la stessa per entrambi
 * (nessun nuovo appuntamento, vecchi appuntamenti vanno in /conflicts), ma il
 * marker permette di distinguere intenzionalità nelle UI e nei conflictReason.
 *
 * Default: false → tutti i record esistenti vengono trattati come "scoperti",
 * coerente con il comportamento precedente alla feature.
 */
export class AddIsClosedToGymExceptionSubstitutes1778000000002
  implements MigrationInterface
{
  name = 'AddIsClosedToGymExceptionSubstitutes1778000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "gym_exception_substitutes"
      ADD COLUMN "isClosed" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "gym_exception_substitutes"
      DROP COLUMN IF EXISTS "isClosed"
    `);
  }
}

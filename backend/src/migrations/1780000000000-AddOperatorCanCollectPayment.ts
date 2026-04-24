import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aggiunge il flag `canCollectPayment` sugli operatori.
 *
 * Determina se l'operatore ha il permesso di registrare pagamenti sui
 * propri trattamenti. Gli istruttori palestra (GYM_INSTRUCTOR) vengono
 * inizializzati a `false`; tutti gli altri (DOCTOR, PHYSIOTHERAPIST,
 * OTHER) a `true`. Il flag è poi editabile dall'admin nella UI.
 *
 * Il default SQL è `true`: i nuovi operatori nascono abilitati e la
 * logica applicativa (service `createOperator`) può eventualmente
 * forzare `false` in base alla macroCategory.
 */
export class AddOperatorCanCollectPayment1780000000000
  implements MigrationInterface
{
  name = 'AddOperatorCanCollectPayment1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "operators"
      ADD COLUMN "canCollectPayment" boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      UPDATE "operators"
      SET "canCollectPayment" = false
      WHERE "macroCategory" = 'gym_instructor'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "operators"
      DROP COLUMN "canCollectPayment"
    `);
  }
}

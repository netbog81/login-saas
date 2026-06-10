import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill delle nuove colonne del Service introdotte da
 * `1787000000000-AddServiceFeeBreakdown`:
 *
 *   - per ogni service esistente, `serviceFee = defaultPrice`,
 *     `studioExtra = 0`
 *   - se `discountFE` è valorizzato, `serviceFeeFE = discountFE`,
 *     `studioExtraFE = 0`
 *
 * In questo modo la somma autoritativa (serviceFee + studioExtra) coincide
 * subito con il prezzo finale fatturato (`defaultPrice`), e l'operatore può
 * poi spostare quota su `studioExtra` editando il servizio.
 *
 * Separata dalla DDL per evitare DDL+DML nella stessa migration
 * (pattern Postgres: ridurre il rischio di lock e transazioni miste).
 *
 * Idempotente: i `WHERE ... IS NULL` evitano di sovrascrivere eventuali
 * valori già popolati a mano fra le due migration.
 *
 * SCOPE: tenant target = `bdq` (schema `t_4701c4aaba73713294696ae7ae46d21b`).
 */
export class BackfillServiceFeeBreakdown1787000000001
  implements MigrationInterface
{
  name = 'BackfillServiceFeeBreakdown1787000000001';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== BackfillServiceFeeBreakdown1787000000001.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `BackfillServiceFeeBreakdown: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${BackfillServiceFeeBreakdown1787000000001.TARGET_SCHEMA}", "public".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      UPDATE "services"
      SET "serviceFee" = "defaultPrice",
          "studioExtra" = 0
      WHERE "serviceFee" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "services"
      SET "serviceFeeFE" = "discountFE",
          "studioExtraFE" = 0
      WHERE "discountFE" IS NOT NULL
        AND "serviceFeeFE" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== BackfillServiceFeeBreakdown1787000000001.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `BackfillServiceFeeBreakdown.down: rifiuto sullo schema "${currentSchema}".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(`
      UPDATE "services"
      SET "serviceFee" = NULL,
          "studioExtra" = NULL,
          "serviceFeeFE" = NULL,
          "studioExtraFE" = NULL
    `);
  }
}

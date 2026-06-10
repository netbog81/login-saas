import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Scompone il prezzo del Service in due voci separate:
 *   serviceFee     = tariffa servizio (base provvigione fisioterapista)
 *   studioExtra    = quota per manutenzione strumenti (esclusa dalla provvigione)
 *
 *   defaultPrice = serviceFee + studioExtra  (somma autoritativa lato resolver)
 *
 * Idem per il prezzo alternativo "Sconto FE":
 *   serviceFeeFE   = tariffa servizio scontata
 *   studioExtraFE  = extra studio sulla tariffa FE
 *
 *   discountFE = serviceFeeFE + studioExtraFE
 *
 * `defaultPrice` e `discountFE` restano i prezzi finali fatturati e sono
 * mantenuti invariati per fatturazione / accounting / calcolo totalPrice.
 *
 * Migration DDL pura: solo aggiunta colonne, nessun backfill (vedi
 * `1787000000001-BackfillServiceFeeBreakdown` per il popolamento).
 *
 * SCOPE: tenant target = `bdq` (schema `t_4701c4aaba73713294696ae7ae46d21b`).
 */
export class AddServiceFeeBreakdown1787000000000 implements MigrationInterface {
  name = 'AddServiceFeeBreakdown1787000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddServiceFeeBreakdown1787000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddServiceFeeBreakdown: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${AddServiceFeeBreakdown1787000000000.TARGET_SCHEMA}", "public".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      ALTER TABLE "services"
      ADD COLUMN "serviceFee"    decimal(10,2),
      ADD COLUMN "studioExtra"   decimal(10,2) DEFAULT 0,
      ADD COLUMN "serviceFeeFE"  decimal(10,2),
      ADD COLUMN "studioExtraFE" decimal(10,2) DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddServiceFeeBreakdown1787000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddServiceFeeBreakdown.down: rifiuto sullo schema "${currentSchema}".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(`
      ALTER TABLE "services"
      DROP COLUMN IF EXISTS "studioExtraFE",
      DROP COLUMN IF EXISTS "serviceFeeFE",
      DROP COLUMN IF EXISTS "studioExtra",
      DROP COLUMN IF EXISTS "serviceFee"
    `);
  }
}

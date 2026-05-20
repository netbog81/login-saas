import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Step 7.4 — Aggiunge 3 colonne dedicate all'audit della cancellation
 * di un treatment (transition `billingStatus → CANCELLED` da
 * `cancelTreatment` mutation).
 *
 *   cancelledAt        timestamptz NULL
 *   cancelledByUserId  uuid NULL  (AppUser locale che ha cancellato)
 *   cancellationReason text NULL  (motivo, free-text)
 *
 * RAZIONALE colonne dedicate (vs. riuso deletedByUserId / accountingRefundReason):
 *   - `deletedByUserId` ha semantica TypeORM precisa ("chi ha valorizzato
 *     deletedAt"); setting senza deletedAt produce stato inconsistente.
 *   - `accountingRefundReason` è il motivo del refund da accounting; un
 *     refund successivo su un treatment cancellato sovrascriverebbe il
 *     reason originale di cancellation. Collisione semantica.
 *
 * SCOPE: tenant target = `bdq` (schema `t_4701c4aaba73713294696ae7ae46d21b`).
 * Stessa guard di Step 1 — niente run su tenant_demo4 / tt_4701original.
 */
export class AddTreatmentCancellationAudit1785000000000
  implements MigrationInterface
{
  name = 'AddTreatmentCancellationAudit1785000000000';

  /** Schema su cui questa migration è autorizzata a girare (oltre a `public`). */
  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddTreatmentCancellationAudit1785000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddTreatmentCancellationAudit: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${AddTreatmentCancellationAudit1785000000000.TARGET_SCHEMA}", "public".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD COLUMN "cancelledAt"        timestamptz,
      ADD COLUMN "cancelledByUserId"  uuid,
      ADD COLUMN "cancellationReason" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddTreatmentCancellationAudit1785000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddTreatmentCancellationAudit.down: rifiuto sullo schema "${currentSchema}".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(`
      ALTER TABLE "treatments"
      DROP COLUMN IF EXISTS "cancellationReason",
      DROP COLUMN IF EXISTS "cancelledByUserId",
      DROP COLUMN IF EXISTS "cancelledAt"
    `);
  }
}

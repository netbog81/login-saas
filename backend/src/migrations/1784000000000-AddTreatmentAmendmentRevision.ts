import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Step 7 — Aggiunta colonna `Treatment.amendmentRevision`.
 *
 * Serve per l'evento `treatment.amended.<tenant>`: ogni amend incrementa
 * un intero monotono crescente. Il primo amend ha revision = 1, il
 * secondo 2, ecc. (il treatment.closed iniziale NON usa la revision).
 *
 * Increment atomic via `UPDATE ... SET ar = ar + 1 RETURNING ar` per
 * evitare race tra amend concorrenti (vedi treatment.service.ts hook).
 *
 * SCOPE: tenant target = `bdq` (schema `t_4701c4aaba73713294696ae7ae46d21b`).
 * Stessa guard di Step 1 — niente run su tenant_demo4 / tt_4701original.
 */
export class AddTreatmentAmendmentRevision1784000000000
  implements MigrationInterface
{
  name = 'AddTreatmentAmendmentRevision1784000000000';

  /** Schema su cui questa migration è autorizzata a girare (oltre a `public`). */
  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddTreatmentAmendmentRevision1784000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddTreatmentAmendmentRevision: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${AddTreatmentAmendmentRevision1784000000000.TARGET_SCHEMA}", "public".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    // amendmentRevision: int NOT NULL DEFAULT 0. I trattamenti storici
    // restano a 0 (mai amend-ati). Il primo amend porta a 1.
    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD COLUMN "amendmentRevision" int NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddTreatmentAmendmentRevision1784000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddTreatmentAmendmentRevision.down: rifiuto sullo schema "${currentSchema}".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(
      `ALTER TABLE "treatments" DROP COLUMN IF EXISTS "amendmentRevision"`,
    );
  }
}

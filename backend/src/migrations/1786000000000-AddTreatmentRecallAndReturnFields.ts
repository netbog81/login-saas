import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sessione 7 — Aggiunge le colonne necessarie a supportare il protocollo
 * "richiamo" bidirezionale clinico↔accounting:
 *
 *  RECALL (clinico chiede ad accounting di rilasciare il billable)
 *    recallRequestId            varchar(36) NULL  — eventId del recall in volo
 *    recallRequestedAt          timestamptz NULL  — timestamp del click "Richiama"
 *    lastRecallRejectionMessage text NULL          — banner UI da accounting
 *    lastRecallRejectionAt      timestamptz NULL
 *
 *  RETURN-TO-CLINICAL (accounting restituisce one-way al clinico)
 *    returnedFromAccountingReason       text NULL
 *    returnedFromAccountingAt           timestamptz NULL
 *    returnedFromAccountingByEmail      varchar(255) NULL  — audit operatore
 *    returnedFromAccountingDismissedAt  timestamptz NULL  — banner dismissibile
 *
 * Anti-stale: nessuna colonna nuova — `accountingBillableEventId` esiste già
 * (uuid NULL, sessione 6 Step 1). Gli handler recall-accepted /
 * returned-to-clinical lo azzerano per scartare eventuali eventi
 * `billable.invoiced` di un billable cancellato che arrivassero in coda.
 *
 * SCOPE: tenant target = `bdq` (schema `t_4701c4aaba73713294696ae7ae46d21b`).
 * Stessa guard delle precedenti — niente run su altri tenant.
 */
export class AddTreatmentRecallAndReturnFields1786000000000
  implements MigrationInterface
{
  name = 'AddTreatmentRecallAndReturnFields1786000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddTreatmentRecallAndReturnFields1786000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddTreatmentRecallAndReturnFields: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${AddTreatmentRecallAndReturnFields1786000000000.TARGET_SCHEMA}", "public".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD COLUMN "recallRequestId"                   varchar(36),
      ADD COLUMN "recallRequestedAt"                 timestamptz,
      ADD COLUMN "lastRecallRejectionMessage"        text,
      ADD COLUMN "lastRecallRejectionAt"             timestamptz,
      ADD COLUMN "returnedFromAccountingReason"      text,
      ADD COLUMN "returnedFromAccountingAt"          timestamptz,
      ADD COLUMN "returnedFromAccountingByEmail"     varchar(255),
      ADD COLUMN "returnedFromAccountingDismissedAt" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddTreatmentRecallAndReturnFields1786000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddTreatmentRecallAndReturnFields.down: rifiuto sullo schema "${currentSchema}".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(`
      ALTER TABLE "treatments"
      DROP COLUMN IF EXISTS "returnedFromAccountingDismissedAt",
      DROP COLUMN IF EXISTS "returnedFromAccountingByEmail",
      DROP COLUMN IF EXISTS "returnedFromAccountingAt",
      DROP COLUMN IF EXISTS "returnedFromAccountingReason",
      DROP COLUMN IF EXISTS "lastRecallRejectionAt",
      DROP COLUMN IF EXISTS "lastRecallRejectionMessage",
      DROP COLUMN IF EXISTS "recallRequestedAt",
      DROP COLUMN IF EXISTS "recallRequestId"
    `);
  }
}

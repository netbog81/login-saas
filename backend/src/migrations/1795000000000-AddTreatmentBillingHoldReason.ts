import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-06-30 — Ripresa fatturazione: motivo blocco lato clinico.
 *
 * Aggiunge su `treatments` il motivo per cui l'auto-emissione fattura è
 * bloccata lato accounting (causa risolvibile: indirizzo paziente mancante,
 * P.IVA mancante, mapping fiscale pending):
 *   billingHoldReasonCode  varchar(40) NULL — codice (MISSING_ADDRESS, ...)
 *   billingHoldReason      text        NULL — messaggio human-friendly
 *   billingHoldReasonAt    timestamptz NULL — quando registrato
 *
 * Popolato dal consumer `billable.invoice-blocked`. Azzerato all'emissione
 * riuscita (`billable.invoiced`). Mostrato come banner + pulsante "Verifica
 * risoluzione e riprova" che pubblica `treatment.retry-invoice-requested`.
 *
 * DB-per-tenant (post-containerizzazione 2026-06-11): lanciare con override
 * `DB_DATABASE=clinico_<hash>`; gira sullo schema `public` del DB del tenant.
 * ALTER su tabella esistente → eredita i grant già concessi a `*_svc`.
 */
export class AddTreatmentBillingHoldReason1795000000000
  implements MigrationInterface
{
  name = 'AddTreatmentBillingHoldReason1795000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddTreatmentBillingHoldReason1795000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddTreatmentBillingHoldReason: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${AddTreatmentBillingHoldReason1795000000000.TARGET_SCHEMA}", "public".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD COLUMN IF NOT EXISTS "billingHoldReasonCode" varchar(40) NULL,
      ADD COLUMN IF NOT EXISTS "billingHoldReason"     text        NULL,
      ADD COLUMN IF NOT EXISTS "billingHoldReasonAt"   timestamptz NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddTreatmentBillingHoldReason1795000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddTreatmentBillingHoldReason.down: rifiuto sullo schema "${currentSchema}".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(`
      ALTER TABLE "treatments"
      DROP COLUMN IF EXISTS "billingHoldReasonAt",
      DROP COLUMN IF EXISTS "billingHoldReason",
      DROP COLUMN IF EXISTS "billingHoldReasonCode"
    `);
  }
}

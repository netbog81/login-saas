import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Redesign "Fattura → Incassa" — Step 1 (A4).
 *
 * Aggiunge `accountingTotalAmount` (decimal(10,2) NULL) su `treatments`: il
 * totale REALE della fattura calcolato e confermato da accounting, marca da
 * bollo INCLUSA. Popolato dal consumer `billable.invoiced` con
 * `payload.totalAmount`. NULL finché il treatment non è stato fatturato.
 *
 * Il clinico NON calcola il bollo: lo salva qui e lo mostra. Sul totale
 * confermato si registra poi il pagamento ("Incassa").
 *
 * DB-per-tenant (post-containerizzazione 2026-06-11): lanciare con override
 * `DB_DATABASE=clinico_<hash>`; gira sullo schema `public` del DB del tenant.
 * La guard accetta `public` e lo schema storico `t_<hash>` per retro-compat.
 *
 * NOTA grant: è un ALTER su tabella ESISTENTE → la colonna eredita i privilegi
 * già concessi a `*_svc` sulla tabella `treatments`. Nessun DO-block di
 * auto-grant necessario (serve solo per tabelle NUOVE).
 */
export class AddTreatmentAccountingTotalAmount1794000000000
  implements MigrationInterface
{
  name = 'AddTreatmentAccountingTotalAmount1794000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddTreatmentAccountingTotalAmount1794000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddTreatmentAccountingTotalAmount: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${AddTreatmentAccountingTotalAmount1794000000000.TARGET_SCHEMA}", "public".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD COLUMN IF NOT EXISTS "accountingTotalAmount" numeric(10,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddTreatmentAccountingTotalAmount1794000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddTreatmentAccountingTotalAmount.down: rifiuto sullo schema "${currentSchema}".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(`
      ALTER TABLE "treatments"
      DROP COLUMN IF EXISTS "accountingTotalAmount"
    `);
  }
}

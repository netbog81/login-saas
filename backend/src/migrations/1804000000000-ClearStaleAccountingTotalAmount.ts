import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bonifica dati — `accountingTotalAmount` stale (2026-07-08).
 *
 * `accountingTotalAmount` (totale fattura, marca da bollo INCLUSA) veniva
 * scritto da `billable.invoiced` ma NON azzerato dagli handler che annullano
 * il documento (`billable.uninvoiced`, `billable.recall-accepted`,
 * `billable.returned-to-clinical`). Risultato: treatment tornati a
 * NOT_READY/PENDING conservavano il totale di una fattura non più esistente.
 *
 * Conseguenze osservate:
 *  - la lista trattamenti mostrava l'icona "Totale fattura (bollo incluso)"
 *    (condizione `accountingTotalAmount != null && !== price`) su trattamenti
 *    mai fatturati o con fattura stornata;
 *  - la UI di incasso usa `accountingTotalAmount ?? price` → proponeva di
 *    incassare l'importo di un documento cancellato.
 *
 * Gli handler sono stati corretti (invariante: `accountingTotalAmount` non-null
 * ⟺ esiste un documento accounting corrente). Questa migration allinea le
 * righe già scritte prima del fix.
 *
 * Criterio: `isInvoicedToPatient = false` significa "nessun documento corrente"
 * — è esattamente il flag che i tre handler di reset azzerano. I treatment
 * REFUNDED / PARTIALLY_REFUNDED restano `isInvoicedToPatient = true` (la
 * fattura è stata emessa e poi stornata con nota di credito) e NON vengono
 * toccati: lì il totale è storicamente corretto.
 *
 * DB-per-tenant (post-containerizzazione 2026-06-11): lanciare con override
 * `DB_DATABASE=clinico_<hash>`; gira sullo schema `public` del DB del tenant.
 * La guard accetta `public` e lo schema storico `t_<hash>` per retro-compat.
 */
export class ClearStaleAccountingTotalAmount1804000000000
  implements MigrationInterface
{
  name = 'ClearStaleAccountingTotalAmount1804000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  private static async guardSchema(queryRunner: QueryRunner): Promise<string> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== ClearStaleAccountingTotalAmount1804000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `ClearStaleAccountingTotalAmount: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${ClearStaleAccountingTotalAmount1804000000000.TARGET_SCHEMA}", "public".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    return currentSchema;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await ClearStaleAccountingTotalAmount1804000000000.guardSchema(queryRunner);

    const [{ count }]: Array<{ count: string }> = await queryRunner.query(`
      SELECT COUNT(*)::text AS count
      FROM "treatments"
      WHERE "accountingTotalAmount" IS NOT NULL
        AND "isInvoicedToPatient" = false
    `);

    await queryRunner.query(`
      UPDATE "treatments"
      SET "accountingTotalAmount" = NULL
      WHERE "accountingTotalAmount" IS NOT NULL
        AND "isInvoicedToPatient" = false
    `);

    console.log(
      `[ClearStaleAccountingTotalAmount] ${count} treatment bonificati ` +
        `(accountingTotalAmount stale azzerato).`,
    );
  }

  /**
   * Irreversibile per costruzione: i valori azzerati erano dati corrotti
   * (totali di documenti inesistenti), non c'è nulla da ripristinare.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await ClearStaleAccountingTotalAmount1804000000000.guardSchema(queryRunner);
    console.log(
      '[ClearStaleAccountingTotalAmount] down(): no-op, bonifica dati non reversibile.',
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-07-31 — DISPONIBILITÀ STRAORDINARIE operatori/medici.
 *
 * La pagina "Gestione assenze" diventa "Assenze e disponibilità": oltre a
 * TOGLIERE ore (assenze) si possono AGGIUNGERE finestre di disponibilità su
 * giorni/orari in cui l'operatore normalmente non lavora ("il mercoledì
 * pomeriggio è sempre libero, questa settimana c'è dalle 14 alle 18").
 *
 *  1. availability_exceptions.exceptionType: nuovo valore 'extra'.
 *     Riusa la tabella delle assenze — è già la sorgente unica di verità
 *     letta da calendario, cache disponibilità, ricerca slot e conflitti —
 *     ma con semantica ADDITIVA anziché sottrattiva. Il valore esistente
 *     'modified' NON va bene: è restrittivo (lavora SOLO nella finestra).
 *
 *  2. availability_appointments.conflictReason: nuovo valore
 *     'availability_removed'. Quando una disponibilità straordinaria viene
 *     tolta DOPO che la segreteria ci ha piazzato appuntamenti, quegli
 *     appuntamenti vanno segnalati nella pagina Conflitti — è l'inverso
 *     delle assenze, dove la cancellazione RIPRISTINA i conflitti.
 *
 * Nessuna nuova colonna: sourceGroupId, absenceTypeId/Snapshot, reason e
 * conflictSourceExceptionId (migration 1802) coprono già tutto il fabbisogno.
 *
 * Nota Postgres: `ALTER TYPE ... ADD VALUE` da PG 12 funziona dentro
 * transazione purché il valore non venga usato nella stessa. Qui i valori
 * sono usati solo da codice applicativo, in transazioni successive.
 *
 * DB-per-tenant: lanciare con `npx ts-node scripts/run-migration.ts <alias>`
 * oppure `./scripts/run-all-tenant-migrations.sh` per tutti i tenant.
 */
export class OperatorExtraAvailability1813000000000 implements MigrationInterface {
  name = 'OperatorExtraAvailability1813000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      ALTER TYPE "availability_exceptions_exceptiontype_enum"
        ADD VALUE IF NOT EXISTS 'extra'
    `);

    await queryRunner.query(`
      ALTER TYPE "availability_appointments_conflictreason_enum"
        ADD VALUE IF NOT EXISTS 'availability_removed'
    `);

    // Le disponibilità straordinarie si cercano per operatore+data insieme
    // alle assenze: l'indice (operatorId, exceptionDate) della 1802 copre
    // già il caso. Qui serve solo il filtro per tipo nella pagina di
    // gestione, che lista un range di date filtrando su exceptionType.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_availability_exceptions_type_date"
        ON "availability_exceptions" ("exceptionType", "exceptionDate")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_availability_exceptions_type_date"`,
    );

    // I valori enum non vengono rimossi: Postgres non supporta DROP VALUE e
    // le righe 'extra' / 'availability_removed' eventualmente già scritte
    // renderebbero comunque impossibile la rimozione del tipo.
  }
}

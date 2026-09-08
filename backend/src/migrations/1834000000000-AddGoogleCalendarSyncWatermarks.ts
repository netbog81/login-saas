import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Segnalibri della sincronizzazione Google, per smettere di rifare ogni volta
 * il lavoro gia' fatto.
 *
 * Prima di questi tre campi la riconciliazione, ogni dieci minuti e per ogni
 * operatore collegato, riscriveva TUTTI gli appuntamenti della finestra (sei
 * mesi avanti) e ritentava TUTTE le cancellazioni dei passati — comprese le
 * centinaia gia' fatte nei giri precedenti, che Google respinge con un 404.
 * Su cinque operatori faceva circa 950 chiamate ogni dieci minuti, per un
 * risultato che nel 99% dei casi era identico a quello del giro prima.
 *
 * Il conto lo presentava Google: `Rate Limit Exceeded` a meta' riversata, con
 * decine di appuntamenti che non arrivavano sul telefono fino al giro
 * successivo. Un guasto che peggiora da solo a ogni operatore che si collega.
 *
 * I tre segnalibri:
 *
 *  - `syncedThroughAt` — tutto cio' che e' stato modificato fino a questo
 *    istante e' su Google. Il giro normale scrive solo cio' che e' cambiato
 *    dopo. Avanza solo quando non e' fallito niente, e in caso di errore
 *    torna indietro appena prima del piu' vecchio fallimento: cosi' il giro
 *    dopo lo ripesca da se', senza bisogno di ricordarsi quale fosse.
 *
 *  - `lastFullSyncAt` — l'ultima riversata integrale. Serve a programmarne
 *    una al giorno per collegamento: e' l'unica cosa che rimette a posto cio'
 *    che e' cambiato SENZA toccare l'appuntamento (un servizio rinominato, un
 *    recapito aggiornato) e cio' che qualcuno ha cancellato a mano da Google.
 *
 *  - `prunedThroughDate` — fin dove i passati sono gia' stati tolti. La
 *    potatura riparte dal giorno dopo invece che dall'inizio della finestra.
 *
 * Tutti e tre partono NULL, che significa "non so niente": il primo giro dopo
 * l'aggiornamento si comporta esattamente come prima (riversata integrale,
 * potatura dell'intero arretrato) e da li' in poi tiene il conto.
 */
export class AddGoogleCalendarSyncWatermarks1834000000000 implements MigrationInterface {
  name = 'AddGoogleCalendarSyncWatermarks1834000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE google_calendar_connections
        ADD COLUMN IF NOT EXISTS "syncedThroughAt" timestamp,
        ADD COLUMN IF NOT EXISTS "lastFullSyncAt" timestamp,
        ADD COLUMN IF NOT EXISTS "prunedThroughDate" date
    `);

    /**
     * La riconciliazione incrementale interroga gli appuntamenti per
     * operatore + data + data-di-modifica. I primi due sono gia' coperti da
     * IDX_availability_appointments_operator_date; senza il terzo ogni giro
     * riesaminerebbe comunque tutta la finestra in Postgres per scoprire che
     * non e' cambiato niente — il lavoro che questa migration serve a
     * togliere, spostato dal calendario al database.
     */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_availability_appointments_updated_at"
        ON availability_appointments ("updatedAt")
    `);

    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT rolname FROM pg_roles WHERE rolname LIKE '%\\_svc' LOOP
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE google_calendar_connections TO %I', r.rolname);
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_availability_appointments_updated_at"
    `);
    await queryRunner.query(`
      ALTER TABLE google_calendar_connections
        DROP COLUMN IF EXISTS "syncedThroughAt",
        DROP COLUMN IF EXISTS "lastFullSyncAt",
        DROP COLUMN IF EXISTS "prunedThroughDate"
    `);
  }
}

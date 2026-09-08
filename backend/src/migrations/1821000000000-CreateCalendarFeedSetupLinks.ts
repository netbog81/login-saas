import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Link usa-e-getta per la sottoscrizione dell'agenda.
 *
 * IL PROBLEMA: l'URL del feed è una credenziale — chi ce l'ha legge l'agenda,
 * e con i relativi interruttori attivi anche nomi e telefoni dei pazienti.
 * Mandarlo su WhatsApp o via email significa lasciarlo per sempre in una
 * conversazione, nei backup del telefono e in qualunque inoltro o esportazione
 * di quella chat.
 *
 * LA SOLUZIONE: al destinatario arriva un indirizzo temporaneo, valido pochi
 * minuti e una volta sola. Aprendolo compare la pagina con i pulsanti di
 * sottoscrizione, e da lì l'URL vero entra direttamente nell'app calendario.
 * Nella cronologia resta un link morto: se quel telefono finisce in mani
 * sbagliate, o il numero in anagrafica era di un altro, non c'è nulla da
 * sfruttare.
 *
 * `usedAt` non cancella la riga: serve a distinguere "mai aperto" (magari il
 * messaggio non è arrivato) da "già usato", che sono due problemi diversi per
 * chi deve capire perché un operatore non vede l'agenda.
 */
export class CreateCalendarFeedSetupLinks1821000000000 implements MigrationInterface {
  name = 'CreateCalendarFeedSetupLinks1821000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_feed_setup_links" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "operatorId" uuid NOT NULL,
        "token" character varying(64) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "usedAt" TIMESTAMP,
        "sentVia" character varying(20),
        "sentTo" character varying(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_calendar_feed_setup_links" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_calendar_feed_setup_links_token"
      ON "calendar_feed_setup_links" ("token")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_calendar_feed_setup_links_operator"
      ON "calendar_feed_setup_links" ("operatorId")
    `);

    // Le migration girano come `migrator`, il backend come `*_svc`: senza
    // grant espliciti la tabella esiste ma ogni query dà permission denied.
    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT rolname FROM pg_roles WHERE rolname LIKE '%\\_svc' LOOP
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE calendar_feed_setup_links TO %I', r.rolname);
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_calendar_feed_setup_links_operator"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_calendar_feed_setup_links_token"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "calendar_feed_setup_links"`);
  }
}

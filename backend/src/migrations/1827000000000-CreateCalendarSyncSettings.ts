import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Impostazioni di sincronizzazione verso i calendari esterni.
 *
 * Riguardano SOLO Google Calendar e il feed ICS. Gli appuntamenti del
 * gestionale non vengono mai toccati: restano tutti, passati e futuri.
 *
 * I valori di partenza descrivono il comportamento attuale, così
 * l'aggiornamento non cambia niente per nessuno finché qualcuno non decide.
 */
export class CreateCalendarSyncSettings1827000000000 implements MigrationInterface {
  name = 'CreateCalendarSyncSettings1827000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS calendar_sync_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "keepPastAppointments" boolean NOT NULL DEFAULT true,
        "keepCalendarOnDisconnect" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      INSERT INTO calendar_sync_settings ("keepPastAppointments", "keepCalendarOnDisconnect")
      SELECT true, true
      WHERE NOT EXISTS (SELECT 1 FROM calendar_sync_settings)
    `);

    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT rolname FROM pg_roles WHERE rolname LIKE '%\\_svc' LOOP
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE calendar_sync_settings TO %I', r.rolname);
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS calendar_sync_settings`);
  }
}

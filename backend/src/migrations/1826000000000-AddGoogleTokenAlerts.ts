import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Avvisi di scadenza dell'autorizzazione Google.
 *
 * Finché l'app Curandis è in stato "Testing" presso Google, il permesso
 * scade ogni 7 giorni e il calendario dell'operatore smette di aggiornarsi
 * senza dire niente. L'operatore se ne accorge dagli appuntamenti che non
 * arrivano più — cioè troppo tardi.
 *
 * Da qui: ogni persona sceglie se essere avvisata PRIMA, e su quale canale.
 *
 * `purpose` sui link monouso: gli stessi link usa-e-getta servono ora a due
 * cose — sottoscrivere il feed ICS e riautorizzare Google. Distinguerli evita
 * che un link nato per una cosa apra l'altra.
 */
export class AddGoogleTokenAlerts1826000000000 implements MigrationInterface {
  name = 'AddGoogleTokenAlerts1826000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE operators
        ADD COLUMN IF NOT EXISTS "googleAlertWhatsapp" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "googleAlertEmail" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "googleAlertLastSentAt" timestamp
    `);

    await queryRunner.query(`
      ALTER TABLE calendar_feed_setup_links
        ADD COLUMN IF NOT EXISTS purpose varchar(20) NOT NULL DEFAULT 'feed'
    `);
    await queryRunner.query(`
      ALTER TABLE calendar_feed_setup_links
        DROP CONSTRAINT IF EXISTS chk_setup_link_purpose
    `);
    await queryRunner.query(`
      ALTER TABLE calendar_feed_setup_links
        ADD CONSTRAINT chk_setup_link_purpose
        CHECK (purpose IN ('feed','google_renew'))
    `);

    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT rolname FROM pg_roles WHERE rolname LIKE '%\\_svc' LOOP
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE operators TO %I', r.rolname);
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE calendar_feed_setup_links TO %I', r.rolname);
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE calendar_feed_setup_links
        DROP CONSTRAINT IF EXISTS chk_setup_link_purpose
    `);
    await queryRunner.query(`
      ALTER TABLE calendar_feed_setup_links DROP COLUMN IF EXISTS purpose
    `);
    await queryRunner.query(`
      ALTER TABLE operators
        DROP COLUMN IF EXISTS "googleAlertWhatsapp",
        DROP COLUMN IF EXISTS "googleAlertEmail",
        DROP COLUMN IF EXISTS "googleAlertLastSentAt"
    `);
  }
}

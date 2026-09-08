import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Impostazioni per canale delle notifiche ai pazienti.
 *
 * Una riga per canale (whatsapp, email, sms) con: se è acceso, quali
 * categorie di messaggio può portare, in che ordine si prova rispetto agli
 * altri.
 *
 * Le tre righe nascono qui con WhatsApp acceso su tutte le categorie: è
 * esattamente il comportamento di oggi, così l'aggiornamento non cambia
 * niente per nessuno finché qualcuno non tocca le impostazioni.
 */
export class CreateNotificationChannelSettings1824000000000 implements MigrationInterface {
  name = 'CreateNotificationChannelSettings1824000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_channel_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        channel varchar(20) NOT NULL,
        enabled boolean NOT NULL DEFAULT false,
        categories jsonb NOT NULL DEFAULT '[]'::jsonb,
        priority integer NOT NULL DEFAULT 100,
        "smsDriver" varchar(20),
        "emailFromName" varchar(120),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT uq_notification_channel UNIQUE (channel)
      )
    `);

    // Stato di partenza = comportamento attuale: tutto da WhatsApp.
    await queryRunner.query(`
      INSERT INTO notification_channel_settings (channel, enabled, categories, priority)
      VALUES
        ('whatsapp', true,  '["confirmation","reminder","reschedule","cancellation"]'::jsonb, 1),
        ('email',    false, '[]'::jsonb, 2),
        ('sms',      false, '[]'::jsonb, 3)
      ON CONFLICT (channel) DO NOTHING
    `);

    // Le migration girano come `migrator`, il backend come `<tenant>_svc`:
    // senza grant espliciti la tabella esiste ma ogni query dà permission denied.
    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT rolname FROM pg_roles WHERE rolname LIKE '%\\_svc' LOOP
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE notification_channel_settings TO %I', r.rolname);
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notification_channel_settings`);
  }
}

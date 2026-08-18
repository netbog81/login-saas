import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fascia oraria di invio del promemoria, configurabile per tenant.
 *
 * Il promemoria partiva esattamente 24h prima dell'appuntamento: con la
 * politica di disdetta entro le 24h questo lascia al paziente zero margine, e
 * concentra tutti gli invii del giorno sull'orario degli appuntamenti. Ora può
 * partire il giorno prima dentro una fascia (default 08:30-09:00), con gli
 * invii distribuiti a intervalli casuali per non farsi bannare da WhatsApp.
 *
 * `reminderEarlyPolicy` copre gli appuntamenti che iniziano prima della fine
 * della fascia (con il default: prima delle 09:00), per i quali la fascia del
 * giorno prima cadrebbe a meno di 24h dall'appuntamento:
 *  - SHIFT_PREVIOUS_DAY → arretra alla fascia del giorno ancora precedente
 *  - EXACT_24H          → invia a -24h esatte, fuori fascia
 *  - FORCE_WINDOW       → invia comunque in fascia, sotto le 24h di preavviso
 *
 * Default disattivato: i tenant già in esercizio non cambiano comportamento
 * finché non accendono la fascia dalla configurazione WhatsApp.
 */
export class AddWhatsappReminderWindow1815000000000 implements MigrationInterface {
  name = 'AddWhatsappReminderWindow1815000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "whatsapp_tenant_config"
      ADD COLUMN IF NOT EXISTS "reminderWindowEnabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "reminderWindowStart" character varying(5) NOT NULL DEFAULT '08:30',
      ADD COLUMN IF NOT EXISTS "reminderWindowEnd" character varying(5) NOT NULL DEFAULT '09:00',
      ADD COLUMN IF NOT EXISTS "reminderEarlyPolicy" character varying(20) NOT NULL DEFAULT 'SHIFT_PREVIOUS_DAY'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "whatsapp_tenant_config"
      DROP COLUMN IF EXISTS "reminderWindowEnabled",
      DROP COLUMN IF EXISTS "reminderWindowStart",
      DROP COLUMN IF EXISTS "reminderWindowEnd",
      DROP COLUMN IF EXISTS "reminderEarlyPolicy"
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Testi dei messaggi distinti per canale.
 *
 * Lo stesso avviso si scrive diverso a seconda di dove arriva: l'SMS paga
 * ogni carattere, l'email ha un oggetto e regge righe multiple. Prima la
 * chiave era il solo tipo di messaggio; ora è la coppia (tipo, canale).
 *
 * Le righe esistenti diventano quelle di WhatsApp, che è da dove passano
 * oggi: nessun testo cambia e nessuno deve riscrivere niente.
 */
export class AddTemplateChannel1825000000000 implements MigrationInterface {
  name = 'AddTemplateChannel1825000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE whatsapp_message_templates
        ADD COLUMN IF NOT EXISTS channel varchar(20) NOT NULL DEFAULT 'whatsapp'
    `);

    // L'unicità era sul solo tipo: ora due canali possono avere lo stesso
    // tipo di messaggio con testi diversi. Il vincolo va sostituito, non
    // aggiunto, altrimenti il secondo canale verrebbe rifiutato.
    await queryRunner.query(`
      DO $$
      DECLARE c record;
      BEGIN
        FOR c IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = 'whatsapp_message_templates'::regclass
            AND contype = 'u'
            AND conname <> 'uq_template_type_channel'
        LOOP
          EXECUTE format('ALTER TABLE whatsapp_message_templates DROP CONSTRAINT %I', c.conname);
        END LOOP;
      END $$;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_whatsapp_message_templates_templateType"
    `);

    await queryRunner.query(`
      ALTER TABLE whatsapp_message_templates
        DROP CONSTRAINT IF EXISTS uq_template_type_channel
    `);
    await queryRunner.query(`
      ALTER TABLE whatsapp_message_templates
        ADD CONSTRAINT uq_template_type_channel UNIQUE ("templateType", channel)
    `);

    await queryRunner.query(`
      ALTER TABLE whatsapp_message_templates
        DROP CONSTRAINT IF EXISTS chk_template_channel
    `);
    await queryRunner.query(`
      ALTER TABLE whatsapp_message_templates
        ADD CONSTRAINT chk_template_channel
        CHECK (channel IN ('whatsapp','email','sms'))
    `);

    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT rolname FROM pg_roles WHERE rolname LIKE '%\\_svc' LOOP
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE whatsapp_message_templates TO %I', r.rolname);
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Si tengono solo i testi di WhatsApp: gli altri non hanno più dove stare.
    await queryRunner.query(`DELETE FROM whatsapp_message_templates WHERE channel <> 'whatsapp'`);
    await queryRunner.query(`
      ALTER TABLE whatsapp_message_templates DROP CONSTRAINT IF EXISTS uq_template_type_channel
    `);
    await queryRunner.query(`
      ALTER TABLE whatsapp_message_templates DROP CONSTRAINT IF EXISTS chk_template_channel
    `);
    await queryRunner.query(`
      ALTER TABLE whatsapp_message_templates DROP COLUMN IF EXISTS channel
    `);
    await queryRunner.query(`
      ALTER TABLE whatsapp_message_templates
        ADD CONSTRAINT "UQ_whatsapp_message_templates_templateType" UNIQUE ("templateType")
    `);
  }
}

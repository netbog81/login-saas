import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-08-09 — CHAT WHATSAPP BIDIREZIONALE (inbox segreteria).
 *
 * Fino a oggi il canale WhatsApp era a senso unico: il gateway inoltrava tutti
 * gli eventi Evolution, ma il webhook della main app gestiva `messages.upsert`
 * SOLO con `fromMe = true` — le risposte dei pazienti arrivavano e venivano
 * scartate. Questa migration introduce lo storage della conversazione.
 *
 *  1. whatsapp_conversations — una riga per NUMERO di telefono, non per
 *     paziente: la segreteria riceve messaggi anche da numeri non ancora in
 *     anagrafica e quelle chat devono comunque esistere. `patientId` resta
 *     nullable e viene valorizzato quando il numero è riconosciuto (o
 *     collegato a mano in un secondo momento).
 *
 *  2. whatsapp_chat_messages — i messaggi della conversazione, nei due versi.
 *     Tabella SEPARATA da whatsapp_message_logs: quella traccia il ciclo di
 *     vita dei messaggi automatici per appuntamento (recap/reminder/disdette),
 *     questa contiene testo libero scritto da o verso il paziente. Contenuto e
 *     retention sono diversi, e mescolarli avrebbe legato due cose con regole
 *     diverse. `isAnonymized`/`anonymizedAt` replicano lo schema dei log così
 *     la chat entra nella stessa procedura di anonimizzazione.
 *
 *  3. whatsapp_message_status_enum — nuovo valore 'received': un messaggio in
 *     arrivo non ha uno stato di consegna nostro, e riusare 'sent' avrebbe
 *     confuso il verso.
 *
 * DB-per-tenant: lanciare con `npx ts-node scripts/run-migration.ts <alias>`.
 */
export class CreateWhatsappChat1814000000000 implements MigrationInterface {
  name = 'CreateWhatsappChat1814000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    // ========================================================================
    // 1. Enum
    // ========================================================================
    // 'received' vive sull'enum condiviso con i log: gli stati di consegna sono
    // gli stessi, i log semplicemente non useranno mai questo valore.
    await queryRunner.query(`
      ALTER TYPE "whatsapp_message_status_enum"
        ADD VALUE IF NOT EXISTS 'received'
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_chat_direction_enum') THEN
          CREATE TYPE "whatsapp_chat_direction_enum" AS ENUM ('inbound', 'outbound');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_conversation_status_enum') THEN
          CREATE TYPE "whatsapp_conversation_status_enum" AS ENUM ('open', 'archived', 'blocked');
        END IF;
      END $$;
    `);

    // ========================================================================
    // 2. whatsapp_conversations
    // ========================================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_conversations" (
        "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "phoneNumber"           varchar(32) NOT NULL,
        "patientId"             uuid,
        "patientName"           varchar(255),
        "contactName"           varchar(255),
        "status"                "whatsapp_conversation_status_enum" NOT NULL DEFAULT 'open',
        "lastMessageAt"         timestamptz,
        "lastMessagePreview"    varchar(300),
        "lastMessageDirection"  "whatsapp_chat_direction_enum",
        "unreadCount"           integer NOT NULL DEFAULT 0,
        "createdAt"             timestamptz NOT NULL DEFAULT now(),
        "updatedAt"             timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_wa_conversations_phone" UNIQUE ("phoneNumber")
      )
    `);
    // L'indice unico è già garantito dal constraint; qui servono solo le
    // ricerche per paziente e l'ordinamento dell'elenco chat.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wa_conversations_patient"
        ON "whatsapp_conversations" ("patientId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wa_conversations_last_message"
        ON "whatsapp_conversations" ("lastMessageAt" DESC)
    `);

    // ========================================================================
    // 3. whatsapp_chat_messages
    // ========================================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_chat_messages" (
        "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "conversationId"      uuid NOT NULL,
        "direction"           "whatsapp_chat_direction_enum" NOT NULL,
        "body"                text,
        "mediaType"           varchar(50),
        "status"              "whatsapp_message_status_enum" NOT NULL DEFAULT 'pending',
        "evolutionMessageId"  varchar(255),
        "correlationId"       uuid,
        "senderUserId"        varchar(255),
        "senderName"          varchar(255),
        "errorMessage"        text,
        "sentAt"              timestamptz,
        "deliveredAt"         timestamptz,
        "readAt"              timestamptz,
        "isAnonymized"        boolean NOT NULL DEFAULT false,
        "anonymizedAt"        timestamptz,
        "createdAt"           timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_wa_chat_messages_conversation"
          FOREIGN KEY ("conversationId")
          REFERENCES "whatsapp_conversations" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wa_chat_messages_conversation"
        ON "whatsapp_chat_messages" ("conversationId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wa_chat_messages_evolution"
        ON "whatsapp_chat_messages" ("evolutionMessageId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wa_chat_messages_correlation"
        ON "whatsapp_chat_messages" ("correlationId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wa_chat_messages_anonymized"
        ON "whatsapp_chat_messages" ("isAnonymized")
    `);

    console.log('  ✓ whatsapp_conversations + whatsapp_chat_messages create');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_chat_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_conversations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "whatsapp_conversation_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "whatsapp_chat_direction_enum"`);
    // 'received' resta nell'enum condiviso: PostgreSQL non sa rimuovere un
    // valore da un enum senza ricrearlo, e il valore inutilizzato è innocuo.
  }
}

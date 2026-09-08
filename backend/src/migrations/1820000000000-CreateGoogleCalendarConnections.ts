import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Collegamento a Google Calendar: indirizzo Google dichiarato e token
 * di autorizzazione.
 *
 * DUE PEZZI, di proposito distinti:
 *
 * 1. `google_account_email` su `app_users` — l'indirizzo Google DICHIARATO.
 *    Serve a proporre l'account giusto in fase di autorizzazione
 *    (`login_hint`: chi ha tre account aperti nel browser altrimenti sbaglia)
 *    e a verificare che chi autorizza sia chi ci si aspetta.
 *
 * 2. `google_calendar_connections` — l'autorizzazione vera, con l'indirizzo
 *    che Google restituisce e il refresh token. Confrontare i due è una
 *    protezione concreta: se un operatore autorizza con un Gmail diverso da
 *    quello dichiarato, senza controllo i suoi appuntamenti finirebbero nel
 *    calendario di un'altra persona senza che nessuno se ne accorga.
 *
 * PROPRIETARIO: `app_users` oggi, pazienti domani.
 *
 * NON gli operatori: un operatore È un app_user con `user_type='operator'`
 * (nel tenant di riferimento tutti e 18 hanno il proprio `app_user_id`), e
 * `operators` porta il ruolo e le policy di accesso, non l'identità. Un
 * account Google appartiene alla PERSONA, quindi il collegamento sta dove sta
 * la persona. Il push risale dall'appuntamento all'operatore e da lì al suo
 * app_user: un salto in più, ma il modello resta onesto invece di duplicare
 * la stessa identità in due tabelle.
 *
 * `ownerType` resta comunque un enum e non un booleano perché i pazienti
 * dell'area riservata sono utenti di un'altra natura, con un altro ciclo di
 * vita: quando arriveranno, entrano qui senza migrazione.
 *
 * I TOKEN NON SONO IN CHIARO: `encRefreshToken` è ciphertext del Transit di
 * OpenBao, con la chiave per tenant `clinico-oauth-<alias>` — separata da
 * quella dei documenti (`clinico-docs-<alias>`) per poterle ruotare in modo
 * indipendente. `encKeyName` registra con quale chiave è stato cifrato, senza
 * la quale una rotazione non saprebbe cosa ri-wrappare.
 */
export class CreateGoogleCalendarConnections1820000000000 implements MigrationInterface {
  name = 'CreateGoogleCalendarConnections1820000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Indirizzo Google dichiarato (sulla persona, non sul ruolo) ──
    await queryRunner.query(`
      ALTER TABLE "app_users"
      ADD COLUMN IF NOT EXISTS "google_account_email" character varying(255)
    `);

    // ── 2. Autorizzazioni ──
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "google_calendar_owner_type_enum" AS ENUM ('APP_USER', 'PATIENT');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "google_calendar_connection_status_enum" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "google_calendar_connections" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ownerType" "google_calendar_owner_type_enum" NOT NULL,
        "ownerId" uuid NOT NULL,
        "googleEmail" character varying(255) NOT NULL,
        "calendarId" character varying(255),
        "calendarName" character varying(255),
        "scope" text,
        "encKeyName" character varying(128) NOT NULL,
        "encRefreshToken" text NOT NULL,
        "status" "google_calendar_connection_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "connectedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lastSyncAt" TIMESTAMP,
        "lastErrorAt" TIMESTAMP,
        "lastErrorMessage" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_google_calendar_connections" PRIMARY KEY ("id")
      )
    `);

    // Un solo collegamento per proprietario: due autorizzazioni sulla stessa
    // persona vorrebbero dire due calendari che si contendono gli stessi
    // eventi, e nessun modo di sapere quale sia quello buono.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_google_calendar_connections_owner"
      ON "google_calendar_connections" ("ownerType", "ownerId")
    `);

    // Il push cerca i collegamenti attivi per proprietario a ogni modifica
    // di appuntamento: senza indice sarebbe una scansione per ogni evento.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_google_calendar_connections_status"
      ON "google_calendar_connections" ("status")
    `);

    // Le migration girano come `migrator`, ma il backend si connette come
    // l'utente di servizio `*_svc` → grant espliciti sulle tabelle nuove.
    // Senza questo la tabella esiste ma il backend riceve
    // "permission denied", che in UI si manifesta in modi tutt'altro che
    // evidenti.
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
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_google_calendar_connections_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_google_calendar_connections_owner"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "google_calendar_connections"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "google_calendar_connection_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "google_calendar_owner_type_enum"`);
    await queryRunner.query(`ALTER TABLE "app_users" DROP COLUMN IF EXISTS "google_account_email"`);
  }
}

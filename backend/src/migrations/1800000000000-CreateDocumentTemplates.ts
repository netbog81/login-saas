import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-07-06 — Template documenti personalizzabili (attestati di presenza).
 *
 * Crea `document_templates`: contenuto TipTap JSON (`content` jsonb) con
 * merge field + impostazioni pagina (`pageSettings` jsonb: logo data-URL,
 * colori, font, margini). Rendering e stampa avvengono lato frontend.
 *
 * DB-per-tenant: lanciare con override `DB_DATABASE=clinico_<hash>`.
 */
export class CreateDocumentTemplates1800000000000 implements MigrationInterface {
  name = 'CreateDocumentTemplates1800000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;
    if (
      currentSchema !== CreateDocumentTemplates1800000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `CreateDocumentTemplates: rifiuto di girare sullo schema "${currentSchema}".`,
      );
    }
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_templates" (
        "id"           uuid NOT NULL DEFAULT gen_random_uuid(),
        "name"         varchar(255) NOT NULL,
        "type"         varchar(50) NOT NULL DEFAULT 'ATTENDANCE_CERTIFICATE',
        "content"      jsonb NOT NULL,
        "pageSettings" jsonb,
        "isDefault"    boolean NOT NULL DEFAULT false,
        "createdAt"    TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_templates" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_document_templates_type" ON "document_templates" ("type")
    `);

    // Le migration girano come `migrator`, ma il backend si connette come
    // l'utente di servizio `*_svc` → grant espliciti sulla tabella nuova.
    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT rolname FROM pg_roles WHERE rolname LIKE '%\\_svc' LOOP
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE document_templates TO %I', r.rolname);
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;
    if (
      currentSchema !== CreateDocumentTemplates1800000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `CreateDocumentTemplates.down: rifiuto sullo schema "${currentSchema}".`,
      );
    }
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_templates"`);
  }
}

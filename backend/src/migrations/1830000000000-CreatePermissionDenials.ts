import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Storico degli accessi negati dall'AuthorizationGuard.
 *
 * Finora un rifiuto viveva solo come riga di log del container: spariva al
 * primo restart, e per accorgersene bisognava già sospettare qualcosa e
 * andare a cercarlo. Il caso del 26/08/2026 — una segretaria bloccata per
 * giorni sul riquadro di sincronizzazione agenda — è stato scoperto perché
 * l'ha detto lei, non perché ce ne fossimo accorti.
 *
 * Registra il TENTATIVO, non la richiesta: chi, quale permesso, quale
 * operazione, quando. Nessun contenuto, nessun dato clinico.
 */
export class CreatePermissionDenials1830000000000 implements MigrationInterface {
  name = 'CreatePermissionDenials1830000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS permission_denials (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        app_user_id uuid,
        keycloak_id varchar(100),
        email varchar(255),
        permission varchar(100) NOT NULL,
        operation varchar(200),
        reason varchar(40) NOT NULL DEFAULT 'missing_permission',
        occurred_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Le due letture che facciamo davvero: "cos'è successo di recente" e
    // "quante volte questo permesso". Niente FK su app_user_id: la riga deve
    // restare leggibile anche se l'utente viene cancellato — è proprio uno
    // dei casi in cui si va a guardare lo storico.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_permission_denials_occurred"
        ON permission_denials (occurred_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_permission_denials_permission"
        ON permission_denials (permission)
    `);

    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT rolname FROM pg_roles WHERE rolname LIKE '%\\_svc' LOOP
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE permission_denials TO %I', r.rolname);
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS permission_denials`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed del ruolo applicativo `istruttore`.
 *
 * Il ruolo `istruttore` esiste in Keycloak (assegnato agli utenti che
 * lavorano nel Workspace Istruttore, `/istruttori`) ma non era presente
 * nel DB applicativo: il seed iniziale (1771000000001) conosceva solo
 * admin/medico/infermiere/operatore/segreteria/responsabile_privacy/
 * it_manager.
 *
 * Senza la riga in `roles` (e le relative `role_permissions`) un istruttore
 * passava i guard delle route Angular — che leggono i ruoli dal JWT Keycloak —
 * ma veniva bloccato dall'`AuthorizationGuard` del backend sulle mutation
 * protette da `@RequirePermissions(...)`, perché `getUserPermissions()`
 * interroga proprio `user_roles → roles → role_permissions → permissions`.
 *
 * Permessi assegnati (sola lettura + gestione dei propri trattamenti, SENZA
 * `calendar_manage`: l'istruttore non sposta/modifica gli appuntamenti in
 * calendario):
 *   - patient_read
 *   - calendar_read
 *   - treatment_read
 *   - treatment_create
 *   - treatment_write
 *   - operator_read
 *
 * Tutti questi permessi sono già seedati dalla 1771000000001. La migration è
 * idempotente (`ON CONFLICT DO NOTHING`) e no-op sui permessi mancanti.
 */
export class SeedIstruttoreRole1790000000000 implements MigrationInterface {
  name = 'SeedIstruttoreRole1790000000000';

  private readonly permissions = [
    'patient_read',
    'calendar_read',
    'treatment_read',
    'treatment_create',
    'treatment_write',
    'operator_read',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO roles (name, description, is_system)
       VALUES ('istruttore', 'Istruttore palestra - workspace istruttore, propri trattamenti', true)
       ON CONFLICT (name) DO NOTHING`,
    );

    for (const permName of this.permissions) {
      await queryRunner.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id FROM roles r, permissions p
         WHERE r.name = 'istruttore' AND p.name = $1
         ON CONFLICT DO NOTHING`,
        [permName],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM role_permissions
       WHERE role_id = (SELECT id FROM roles WHERE name = 'istruttore')`,
    );
    // Non rimuoviamo il ruolo se nel frattempo è stato assegnato a utenti.
    await queryRunner.query(
      `DELETE FROM roles
       WHERE name = 'istruttore'
         AND NOT EXISTS (
           SELECT 1 FROM user_roles ur WHERE ur.role_id = roles.id
         )`,
    );
  }
}

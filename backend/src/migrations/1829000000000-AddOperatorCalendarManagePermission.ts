import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permesso dedicato alla sincronizzazione dell'agenda verso i calendari
 * esterni (feed ICS e Google Calendar).
 *
 * Nasce per la segreteria: la rotta di configurazione le è aperta e può
 * modificare l'operatore, ma il riquadro "Sincronizzazione agenda" chiedeva
 * `operator_manage` — che ha solo chi amministra — e le rispondeva con un
 * errore su ogni interruttore.
 *
 * Permesso NUOVO invece di allargare `operator_manage`: quel permesso oggi
 * governa anche cancellazione, archiviazione e ripristino degli operatori, e
 * darlo alla segreteria per farle accendere un interruttore le avrebbe
 * consegnato anche il resto.
 *
 * Sta solo qui, nel DB del tenant: Keycloak porta il RUOLO nel token, la
 * mappa ruolo → permessi è del clinico.
 */
export class AddOperatorCalendarManagePermission1829000000000 implements MigrationInterface {
  name = 'AddOperatorCalendarManagePermission1829000000000';

  /** Chi gestisce la sincronizzazione dell'agenda degli operatori. */
  private static readonly ROLES = ['admin', 'it_manager', 'segreteria'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO permissions (name, resource_type, action, description)
      VALUES (
        'operator_calendar_manage',
        'operator',
        'calendar_manage',
        'Gestire la sincronizzazione agenda degli operatori (feed ICS e Google Calendar)'
      )
      ON CONFLICT (name) DO NOTHING
    `);

    for (const role of AddOperatorCalendarManagePermission1829000000000.ROLES) {
      await queryRunner.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.name = $1 AND p.name = 'operator_calendar_manage'
        ON CONFLICT DO NOTHING
      `, [role]);
    }
  }

  /**
   * Toglie solo il permesso: le associazioni se ne vanno in cascata dalla
   * foreign key, e `operator_manage` non è mai stato toccato.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM permissions WHERE name = 'operator_calendar_manage'`);
  }
}

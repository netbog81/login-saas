import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nuovi permessi per gestire ownership di trattamenti/percorsi e il cestino:
 *
 *  - treatment_delete_own            - operatore elimina i propri trattamenti
 *  - treatment_delete_any            - admin: bypass ownership su trattamenti
 *  - treatment_force_close           - segreteria/admin: forza chiusura di
 *                                      un trattamento aperto da operatore
 *                                      dimentico (IN_PROGRESS → CLOSED)
 *  - therapeutic_path_delete_own     - operatore elimina i propri percorsi
 *  - therapeutic_path_delete_any     - admin: bypass ownership su percorsi
 *  - recycle_bin_view                - accesso al cestino (ogni ruolo vede
 *                                      solo i propri, admin vede tutto)
 *  - recycle_bin_restore_any         - admin: ripristina elementi altrui
 *  - recycle_bin_purge               - admin: eliminazione definitiva
 *                                      (hard delete) dal cestino
 *  - recycle_bin_settings_manage     - admin: configura retentionDays
 *
 * Associazioni di default:
 *  - admin: tutto (incluso *_any e purge)
 *  - medico/operatore/infermiere: *_own + recycle_bin_view
 *  - segreteria: treatment_force_close + recycle_bin_view
 */
export class AddOwnershipPermissions1781000000001
  implements MigrationInterface
{
  name = 'AddOwnershipPermissions1781000000001';

  private readonly newPermissions = [
    {
      name: 'treatment_delete_own',
      resourceType: 'treatment',
      action: 'delete',
      description: 'Eliminare i propri trattamenti',
    },
    {
      name: 'treatment_delete_any',
      resourceType: 'treatment',
      action: 'delete',
      description: 'Eliminare qualsiasi trattamento (admin override)',
    },
    {
      name: 'treatment_force_close',
      resourceType: 'treatment',
      action: 'manage',
      description:
        'Forzare la chiusura di un trattamento lasciato aperto dall\'operatore',
    },
    {
      name: 'therapeutic_path_delete_own',
      resourceType: 'therapeutic_path',
      action: 'delete',
      description: 'Eliminare i propri percorsi terapeutici',
    },
    {
      name: 'therapeutic_path_delete_any',
      resourceType: 'therapeutic_path',
      action: 'delete',
      description:
        'Eliminare qualsiasi percorso terapeutico (admin override)',
    },
    {
      name: 'recycle_bin_view',
      resourceType: 'recycle_bin',
      action: 'read',
      description: 'Accedere al cestino (propri elementi)',
    },
    {
      name: 'recycle_bin_restore_any',
      resourceType: 'recycle_bin',
      action: 'manage',
      description: 'Ripristinare elementi altrui dal cestino (admin)',
    },
    {
      name: 'recycle_bin_purge',
      resourceType: 'recycle_bin',
      action: 'delete',
      description: 'Eliminare definitivamente dal cestino (admin)',
    },
    {
      name: 'recycle_bin_settings_manage',
      resourceType: 'recycle_bin',
      action: 'manage',
      description: 'Configurare la retention del cestino (admin)',
    },
  ];

  private readonly roleAssignments: Record<string, string[]> = {
    admin: [
      'treatment_delete_own',
      'treatment_delete_any',
      'treatment_force_close',
      'therapeutic_path_delete_own',
      'therapeutic_path_delete_any',
      'recycle_bin_view',
      'recycle_bin_restore_any',
      'recycle_bin_purge',
      'recycle_bin_settings_manage',
    ],
    medico: [
      'treatment_delete_own',
      'therapeutic_path_delete_own',
      'recycle_bin_view',
    ],
    infermiere: [
      'treatment_delete_own',
      'therapeutic_path_delete_own',
      'recycle_bin_view',
    ],
    operatore: [
      'treatment_delete_own',
      'therapeutic_path_delete_own',
      'recycle_bin_view',
    ],
    segreteria: ['treatment_force_close', 'recycle_bin_view'],
  };

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const p of this.newPermissions) {
      await queryRunner.query(
        `INSERT INTO permissions (name, resource_type, action, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO NOTHING`,
        [p.name, p.resourceType, p.action, p.description],
      );
    }

    for (const [roleName, permNames] of Object.entries(this.roleAssignments)) {
      for (const permName of permNames) {
        await queryRunner.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT r.id, p.id FROM roles r, permissions p
           WHERE r.name = $1 AND p.name = $2
           ON CONFLICT DO NOTHING`,
          [roleName, permName],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = this.newPermissions.map(p => p.name);
    await queryRunner.query(
      `DELETE FROM role_permissions
       WHERE permission_id IN (SELECT id FROM permissions WHERE name = ANY($1::text[]))`,
      [names],
    );
    await queryRunner.query(
      `DELETE FROM permissions WHERE name = ANY($1::text[])`,
      [names],
    );
  }
}

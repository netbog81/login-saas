import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aggiunge i permessi `treatment_read` e `treatment_write` al ruolo
 * `segreteria`.
 *
 * Motivazione: dopo l'introduzione della tranche 2 (ownership/guard), i
 * mutation `closeTreatment`, `reopenTreatmentBySecretary`,
 * `setReadyForBilling`, `updateTreatmentBySecretary` e simili sono protetti
 * da `@RequirePermissions('treatment_write')` (oltre a, dove serve, dal
 * permesso di force-close). Il seed iniziale (`1771000000001`) non
 * includeva permessi di trattamento per la segreteria perché in quella
 * fase i resolver erano senza guard.
 *
 * La segreteria deve poter:
 *  - leggere i trattamenti (`treatment_read`) per visualizzare la lista
 *  - chiuderli/riaprirli/aggiornare campi economici (`treatment_write`)
 * `treatment_force_close` è già stato seedato in `1781000000001`.
 */
export class AddTreatmentPermsToSegreteria1781000000002
  implements MigrationInterface
{
  name = 'AddTreatmentPermsToSegreteria1781000000002';

  private readonly perms = ['treatment_read', 'treatment_write'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const permName of this.perms) {
      await queryRunner.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id FROM roles r, permissions p
         WHERE r.name = 'segreteria' AND p.name = $1
         ON CONFLICT DO NOTHING`,
        [permName],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM role_permissions
       WHERE role_id IN (SELECT id FROM roles WHERE name = 'segreteria')
         AND permission_id IN (SELECT id FROM permissions WHERE name = ANY($1::text[]))`,
      [this.perms],
    );
  }
}

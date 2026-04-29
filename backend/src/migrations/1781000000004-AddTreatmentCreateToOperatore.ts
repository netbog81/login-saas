import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aggiunge il permesso `treatment_create` al ruolo applicativo `operatore`.
 *
 * Motivazione: nel seed iniziale (1771000000001) `treatment_create` era
 * assegnato solo al ruolo `medico`. In Curandis tutti gli utenti
 * "operativi" (sia con macroCategory medico, fisioterapista o istruttore
 * palestra) hanno user_type='operator' e ruolo applicativo `operatore`.
 * Senza `treatment_create` non possono creare trattamenti dalla scheda
 * paziente — bloccati dal guard `@RequirePermissions('treatment_create')`
 * sul resolver `createTreatment` introdotto nella tranche 2.
 *
 * Lasciamo `infermiere` come da seed (ruolo non utilizzato attualmente);
 * se in futuro emergerà l'esigenza si aggiungerà con migration dedicata.
 */
export class AddTreatmentCreateToOperatore1781000000004
  implements MigrationInterface
{
  name = 'AddTreatmentCreateToOperatore1781000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id FROM roles r, permissions p
       WHERE r.name = 'operatore' AND p.name = 'treatment_create'
       ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM role_permissions
       WHERE role_id = (SELECT id FROM roles WHERE name = 'operatore')
         AND permission_id = (SELECT id FROM permissions WHERE name = 'treatment_create')`,
    );
  }
}

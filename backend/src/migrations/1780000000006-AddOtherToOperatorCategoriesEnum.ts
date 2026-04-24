import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aggiunge il valore 'other' all'enum operator_categories_macrocategory_enum.
 *
 * Questo enum è stato creato in 1763973730807 con soli 3 valori
 * (doctor, physiotherapist, gym_instructor) e mai aggiornato. Altri enum
 * paralleli (services, service_subcategories, operators dopo 1780000000004)
 * includono 'other': lo allineiamo per coerenza così la UI può mostrare la
 * categoria Altro anche sul form "Categorie operatore" (scheda
 * Configurazioni > Categorie).
 */
export class AddOtherToOperatorCategoriesEnum1780000000006
  implements MigrationInterface
{
  name = 'AddOtherToOperatorCategoriesEnum1780000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Non qualificare con "public": l'enum sta nello schema del tenant.
    await queryRunner.query(
      `ALTER TYPE "operator_categories_macrocategory_enum" ADD VALUE IF NOT EXISTS 'other'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres non supporta la rimozione di un valore da un enum.
  }
}

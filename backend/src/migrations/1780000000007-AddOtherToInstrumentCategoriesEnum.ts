import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aggiunge il valore 'other' all'enum instrument_categories_macrocategory_enum.
 *
 * Stesso razionale di 1780000000006: allineamento con gli altri enum
 * macroCategory che già includono 'other'.
 */
export class AddOtherToInstrumentCategoriesEnum1780000000007
  implements MigrationInterface
{
  name = 'AddOtherToInstrumentCategoriesEnum1780000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Non qualificare con "public": l'enum sta nello schema del tenant.
    await queryRunner.query(
      `ALTER TYPE "instrument_categories_macrocategory_enum" ADD VALUE IF NOT EXISTS 'other'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres non supporta la rimozione di un valore da un enum.
  }
}

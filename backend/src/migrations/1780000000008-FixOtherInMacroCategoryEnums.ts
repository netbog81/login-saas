import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Safety-net: si assicura che 'other' sia presente su tutti gli enum
 * *_macrocategory_enum del tenant corrente.
 *
 * Contesto: ogni tenant ha i propri enum nel proprio schema (non vivono in
 * `public`). Il runner fa SET search_path TO "<tenant>" prima di eseguire
 * le migration, quindi gli ALTER TYPE senza qualifier toccano correttamente
 * l'enum del tenant corrente. Grazie a IF NOT EXISTS è idempotente:
 *   - per tenant nuovi costruiti da zero, imposta tutti gli enum con 'other';
 *   - per tenant esistenti su cui #4/#6/#7 erano già passate (o avevano
 *     toccato lo schema sbagliato a causa di bug precedenti), allinea
 *     lo stato senza fare danno.
 */
export class FixOtherInMacroCategoryEnums1780000000008
  implements MigrationInterface
{
  name = 'FixOtherInMacroCategoryEnums1780000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nessun qualifier: l'ALTER va sull'enum dello schema tenant corrente.
    await queryRunner.query(
      `ALTER TYPE "operators_macrocategory_enum" ADD VALUE IF NOT EXISTS 'other'`,
    );
    await queryRunner.query(
      `ALTER TYPE "operator_categories_macrocategory_enum" ADD VALUE IF NOT EXISTS 'other'`,
    );
    await queryRunner.query(
      `ALTER TYPE "instrument_categories_macrocategory_enum" ADD VALUE IF NOT EXISTS 'other'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres non supporta la rimozione di valori da enum.
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aggiunge il valore 'other' all'enum operators_macrocategory_enum del DB.
 *
 * Contesto: il TS enum OperatorMacroCategory include OTHER='other' da tempo,
 * ma il tipo enum del DB (creato in 1763973730807) aveva solo doctor,
 * physiotherapist, gym_instructor. Il TS funzionava comunque perché nessuno
 * inseriva mai 'other' nel DB. La migration successiva
 * (CreateServiceInvoicePrefixes) inserisce righe con macroCategory='other'
 * quindi l'enum deve essere esteso prima.
 *
 * Nota Postgres: `ALTER TYPE ... ADD VALUE` è consentito dentro una
 * transazione dalla 12 in poi a condizione che il nuovo valore NON venga
 * usato nella stessa transazione. Qui facciamo solo l'ALTER: il primo uso
 * ('other' nel seed) avviene nella migration successiva, in transazione
 * separata, quindi è sicuro lasciare che TypeORM wrappi in transazione.
 */
export class AddOtherToOperatorsMacroCategoryEnum1780000000004
  implements MigrationInterface
{
  name = 'AddOtherToOperatorsMacroCategoryEnum1780000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nota: NON qualifichiamo con "public" perché gli enum vengono creati
    // nello schema del tenant (il runner fa SET search_path TO "<tenant>"
    // prima di eseguire le migration). Se qualificassimo con public
    // modificheremmo un enum omonimo nello schema sbagliato, lasciando
    // quello del tenant invariato e la migration seguente fallirebbe
    // con "invalid input value for enum: other".
    await queryRunner.query(
      `ALTER TYPE "operators_macrocategory_enum" ADD VALUE IF NOT EXISTS 'other'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL non supporta la rimozione di un valore da un enum:
    // la down è un no-op. Se necessario, andrebbe ricreato l'enum da zero.
  }
}

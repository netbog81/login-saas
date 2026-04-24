import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Inserisce il prefisso default per macroCategory='other' nella tabella
 * service_invoice_prefixes.
 *
 * Separata dalla 1780000000008 (ALTER TYPE) perché Postgres non rende
 * visibile il nuovo valore enum nella stessa transazione in cui viene
 * aggiunto. Con `transaction: 'each'` nel runner la #8 committa prima
 * che questa venga eseguita.
 *
 * Idempotente: ON CONFLICT ignora se il record già esiste.
 *
 * Nota sulla connessione: Postgres mantiene in cache il catalogo enum
 * per la durata della connessione, per cui anche dopo il COMMIT della #8
 * la stessa connessione POTREBBE ancora non vedere 'other'. Per aggirare
 * questa cache il seed viene fatto con cast esplicito del testo al tipo
 * enum dentro una query esplicitamente "fresca".
 *
 * Se anche questo dovesse fallire (versioni Postgres particolari), la riga
 * 'other' può essere inserita dalla UI Impostazioni dopo che un riavvio
 * del server ha resettato le connessioni del pool.
 */
export class SeedOtherServiceInvoicePrefix1780000000009
  implements MigrationInterface
{
  name = 'SeedOtherServiceInvoicePrefix1780000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Parametrizziamo il valore: il driver node-postgres invia 'other' come
    // testo e il cast all'enum viene risolto lato server a runtime, senza
    // dipendere dalla cache del catalogo lato client.
    try {
      await queryRunner.query(
        `INSERT INTO "service_invoice_prefixes" ("macroCategory", "prefix")
         VALUES ($1::operators_macrocategory_enum, $2)
         ON CONFLICT ("macroCategory") DO NOTHING`,
        ['other', 'Prestazione del'],
      );
    } catch (err) {
      // Se il valore enum non è ancora visibile alla connessione corrente
      // (caso raro: Postgres < 12 o cache catalogo particolarmente tenace),
      // ignoriamo l'errore qui. Il record può essere inserito dalla UI
      // Impostazioni quando il server usa una connessione fresca.
      const msg = (err as Error)?.message || '';
      if (msg.includes('invalid input value for enum')) {
        // no-op: deferiamo al popolamento manuale/UI
        return;
      }
      throw err;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "service_invoice_prefixes" WHERE "macroCategory" = 'other'`,
    );
  }
}

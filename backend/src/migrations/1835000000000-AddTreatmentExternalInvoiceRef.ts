import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-09-03 — Riferimento a una fattura emessa FUORI da Curandis.
 *
 * Nasce dai voucher "anticipo fattura" dell'accounting: il paziente ha già
 * pagato un anticipo, e quell'anticipo può essere documentato da una fattura
 * del gestionale precedente. Quando una prestazione viene scalata da quel
 * credito è fatturata e incassata a tutti gli effetti — ma il documento non
 * esiste in Curandis, quindi `accountingDocumentId` resta NULL.
 *
 * Senza queste colonne il clinico non poteva rappresentare quel caso: o
 * riceveva un id documento inventato (e il download del PDF sarebbe fallito
 * su una fattura inesistente), oppure il trattamento restava "da fatturare"
 * mentre in accounting risultava chiuso — i due moduli disallineati.
 *
 * Il numero è testo libero perché arriva com'è dall'originale ("45/2025").
 * La data è nullable: di certe fatture vecchie si conosce solo il numero.
 *
 * Nessun indice: sono campi di sola visualizzazione sulla scheda del
 * trattamento, mai criteri di ricerca.
 *
 * GRANT: colonne su una tabella esistente, i ruoli `*_svc` hanno già i
 * privilegi su `treatments`.
 */
export class AddTreatmentExternalInvoiceRef1835000000000 implements MigrationInterface {
  name = 'AddTreatmentExternalInvoiceRef1835000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE treatments
      ADD COLUMN IF NOT EXISTS "accountingExternalRefNumber" varchar(50)
    `);
    await queryRunner.query(`
      ALTER TABLE treatments
      ADD COLUMN IF NOT EXISTS "accountingExternalRefDate" date
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE treatments DROP COLUMN IF EXISTS "accountingExternalRefDate"
    `);
    await queryRunner.query(`
      ALTER TABLE treatments DROP COLUMN IF EXISTS "accountingExternalRefNumber"
    `);
  }
}

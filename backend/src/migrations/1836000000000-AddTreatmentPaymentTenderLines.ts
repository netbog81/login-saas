import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-09-03 — Come è stato composto l'incasso, non solo "con quale metodo".
 *
 * `treatments.paymentMethod` tiene una stringa sola, e per un incasso misto
 * (parte con un buono, parte in contanti) quella stringa non basta. Le righe
 * di tender arrivavano già in `recordPayment` — servivano a scalare i voucher
 * FE e a comporre l'evento verso la contabilità — ma non venivano salvate da
 * nessuna parte: finito il metodo, l'informazione spariva.
 *
 * Il guasto che questo risolve: la segreteria incassa con un voucher "anticipo
 * fattura" PRIMA di mandare il trattamento a fatturazione. In quel caso
 * l'evento `treatment.payment-recorded` non parte (il trattamento non è ancora
 * stato inviato) e il pagamento viaggia dentro `treatment.closed` — dove però
 * c'era solo il metodo, senza l'id del buono. Risultato: in contabilità il
 * residuo del voucher non veniva scalato né allora né dopo l'invio, e i due
 * moduli restavano disallineati.
 *
 * jsonb e non una tabella dedicata: è uno snapshot di com'era composto QUEL
 * pagamento, si scrive una volta e si rilegge intero. Nullable, perché per
 * tutti gli incassi già registrati non è ricostruibile.
 *
 * GRANT: colonna su tabella esistente, i ruoli `*_svc` hanno già i privilegi
 * su `treatments`.
 */
export class AddTreatmentPaymentTenderLines1836000000000 implements MigrationInterface {
  name = 'AddTreatmentPaymentTenderLines1836000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE treatments
      ADD COLUMN IF NOT EXISTS "paymentTenderLines" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE treatments DROP COLUMN IF EXISTS "paymentTenderLines"
    `);
  }
}

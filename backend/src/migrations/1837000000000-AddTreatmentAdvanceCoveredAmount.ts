import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-09-04 — Quanto della prestazione è già stato coperto da un voucher
 * "anticipo fattura".
 *
 * Il guasto che risolve: una seduta da 55 € con 35 € coperti da un anticipo
 * viene fatturata per il solo residuo, e il documento totalizza 20 €. Il
 * clinico riceveva quel 20 in `accountingTotalAmount` e lo mostrava in elenco
 * come importo della prestazione — che invece vale 55. Su bdq è successo col
 * trattamento di Aldo Martino Graglia sulla ricevuta 3910.
 *
 * Non si poteva risolvere allargando `accountingTotalAmount`: quel campo è
 * anche l'importo che il clinico propone quando si registra l'incasso, e lì
 * il numero giusto è il residuo (20), non il valore della prestazione. Due
 * significati diversi, due colonne.
 *
 * Da qui in poi: valore della prestazione = `accountingTotalAmount` +
 * `accountingAdvanceCoveredAmount`.
 *
 * Nullable e senza backfill: per gli incassi già registrati la quota non è
 * ricostruibile dal clinico (la conosce solo la contabilità), e null significa
 * onestamente "non lo so", che è diverso da "zero".
 *
 * GRANT: colonna su tabella esistente, i ruoli `*_svc` hanno già i privilegi
 * su `treatments`.
 */
export class AddTreatmentAdvanceCoveredAmount1837000000000 implements MigrationInterface {
  name = 'AddTreatmentAdvanceCoveredAmount1837000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE treatments
      ADD COLUMN IF NOT EXISTS "accountingAdvanceCoveredAmount" numeric(10,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE treatments DROP COLUMN IF EXISTS "accountingAdvanceCoveredAmount"
    `);
  }
}

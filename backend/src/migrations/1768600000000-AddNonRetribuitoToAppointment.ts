import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddNonRetribuitoToAppointment1768600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'availability_appointments',
      new TableColumn({
        name: 'non_retribuito',
        type: 'boolean',
        default: false,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('availability_appointments', 'non_retribuito');
  }
}

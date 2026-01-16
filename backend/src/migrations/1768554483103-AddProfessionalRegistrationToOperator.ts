import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProfessionalRegistrationToOperator1768554483103 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'operators',
      new TableColumn({
        name: 'professional_registration',
        type: 'varchar',
        length: '255',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('operators', 'professional_registration');
  }
}

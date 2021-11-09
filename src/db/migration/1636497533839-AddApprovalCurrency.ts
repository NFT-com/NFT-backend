import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddApprovalCurrency1636497533839 implements MigrationInterface {

  name = 'AddApprovalCurrency1636497533839'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "approval" ADD "currency" character varying NOT NULL')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "approval" DROP COLUMN "currency"')
  }

}

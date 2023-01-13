import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateTxTransactionEntity1673581190155 implements MigrationInterface {

  name = 'UpdateTxTransactionEntity1673581190155'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "listingOrderId"')
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "bidOrderId"')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD "bidOrderId" character varying')
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD "listingOrderId" character varying')
  }

}

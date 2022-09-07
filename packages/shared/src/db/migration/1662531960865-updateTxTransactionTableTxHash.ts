import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateTxTransactionTableTxHash1662531960865 implements MigrationInterface {

  name = 'updateTxTransactionTableTxHash1662531960865'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD CONSTRAINT "UQ_5ddb20b9d9d2aeabb8bf588a214" UNIQUE ("transactionHash")')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP CONSTRAINT "UQ_5ddb20b9d9d2aeabb8bf588a214"')
  }

}

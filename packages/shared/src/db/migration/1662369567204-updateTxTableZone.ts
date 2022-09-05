import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateTxTableZone1662369567204 implements MigrationInterface {

  name = 'updateTxTableZone1662369567204'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "sender"')
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "receiver"')
    await queryRunner.query('ALTER TABLE "tx_order" ADD "zone" character varying')
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD "eventType" character varying NOT NULL DEFAULT \'Default\'')
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD "maker" character varying NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD "taker" character varying NOT NULL')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "taker"')
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "maker"')
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "eventType"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "zone"')
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD "receiver" character varying NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD "sender" character varying NOT NULL')
  }

}

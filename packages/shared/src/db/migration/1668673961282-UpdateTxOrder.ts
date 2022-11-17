import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateTxOrder1668673961282 implements MigrationInterface {

  name = 'UpdateTxOrder1668673961282'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_order" ADD "makeAsset" json NOT NULL DEFAULT \'[]\'')
    await queryRunner.query('ALTER TABLE "tx_order" ADD "takeAsset" json NOT NULL DEFAULT \'[]\'')
    await queryRunner.query('ALTER TABLE "tx_order" ADD "swapTransactionId" character varying')
    await queryRunner.query('ALTER TABLE "tx_order" ADD "acceptedAt" TIMESTAMP WITH TIME ZONE')
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD "listingOrderId" character varying')
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD "bidOrderId" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "bidOrderId"')
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "listingOrderId"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "acceptedAt"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "swapTransactionId"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "takeAsset"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "makeAsset"')
  }

}

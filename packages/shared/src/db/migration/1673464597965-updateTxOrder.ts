import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateTxOrder1673464597965 implements MigrationInterface {

  name = 'updateTxOrder1673464597965'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "makeAsset"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "takeAsset"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "swapTransactionId"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "acceptedAt"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "listingId"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "rejectedAt"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "buyNowTaker"')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_order" ADD "buyNowTaker" character varying')
    await queryRunner.query('ALTER TABLE "tx_order" ADD "rejectedAt" TIMESTAMP WITH TIME ZONE')
    await queryRunner.query('ALTER TABLE "tx_order" ADD "listingId" character varying')
    await queryRunner.query('ALTER TABLE "tx_order" ADD "acceptedAt" TIMESTAMP WITH TIME ZONE')
    await queryRunner.query('ALTER TABLE "tx_order" ADD "swapTransactionId" character varying')
    await queryRunner.query('ALTER TABLE "tx_order" ADD "takeAsset" json NOT NULL DEFAULT \'[]\'')
    await queryRunner.query('ALTER TABLE "tx_order" ADD "makeAsset" json NOT NULL DEFAULT \'[]\'')
  }

}

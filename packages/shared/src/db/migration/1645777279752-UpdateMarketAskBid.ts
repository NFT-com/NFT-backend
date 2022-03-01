import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateMarketAskBid1645777279752 implements MigrationInterface {

  name = 'UpdateMarketAskBid1645777279752'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "market_ask" ADD "marketSwapId" character varying')
    await queryRunner.query('ALTER TABLE "market_ask" ADD "approvalTxHash" character varying')
    await queryRunner.query('ALTER TABLE "market_ask" ADD "cancelTxHash" character varying')
    await queryRunner.query('ALTER TABLE "market_bid" ADD "marketSwapId" character varying')
    await queryRunner.query('ALTER TABLE "market_bid" ADD "approvalTxHash" character varying')
    await queryRunner.query('ALTER TABLE "market_bid" ADD "cancelTxHash" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "market_bid" DROP COLUMN "cancelTxHash"')
    await queryRunner.query('ALTER TABLE "market_bid" DROP COLUMN "approvalTxHash"')
    await queryRunner.query('ALTER TABLE "market_bid" DROP COLUMN "marketSwapId"')
    await queryRunner.query('ALTER TABLE "market_ask" DROP COLUMN "cancelTxHash"')
    await queryRunner.query('ALTER TABLE "market_ask" DROP COLUMN "approvalTxHash"')
    await queryRunner.query('ALTER TABLE "market_ask" DROP COLUMN "marketSwapId"')
  }

}

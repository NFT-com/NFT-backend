import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateMarketSwapEntity1646582119287 implements MigrationInterface {

  name = 'UpdateMarketSwapEntity1646582119287'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "market_swap" DROP COLUMN "askId"')
    await queryRunner.query('ALTER TABLE "market_swap" DROP COLUMN "bidId"')
    await queryRunner.query('ALTER TABLE "market_swap" ADD "marketAskId" character varying')
    await queryRunner.query('ALTER TABLE "market_swap" ADD CONSTRAINT "UQ_c27294251ee1c5d9c03f95ddf24" UNIQUE ("marketAskId")')
    await queryRunner.query('ALTER TABLE "market_swap" ADD "marketBidId" character varying')
    await queryRunner.query('ALTER TABLE "market_swap" ADD CONSTRAINT "UQ_23438b727a123a21411db77ceeb" UNIQUE ("marketBidId")')
    await queryRunner.query('ALTER TABLE "market_ask" ALTER COLUMN "auctionType" SET NOT NULL')
    await queryRunner.query('ALTER TABLE "market_swap" ADD CONSTRAINT "FK_c27294251ee1c5d9c03f95ddf24" FOREIGN KEY ("marketAskId") REFERENCES "market_ask"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
    await queryRunner.query('ALTER TABLE "market_swap" ADD CONSTRAINT "FK_23438b727a123a21411db77ceeb" FOREIGN KEY ("marketBidId") REFERENCES "market_bid"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "market_swap" DROP CONSTRAINT "FK_23438b727a123a21411db77ceeb"')
    await queryRunner.query('ALTER TABLE "market_swap" DROP CONSTRAINT "FK_c27294251ee1c5d9c03f95ddf24"')
    await queryRunner.query('ALTER TABLE "market_ask" ALTER COLUMN "auctionType" DROP NOT NULL')
    await queryRunner.query('ALTER TABLE "market_swap" DROP CONSTRAINT "UQ_23438b727a123a21411db77ceeb"')
    await queryRunner.query('ALTER TABLE "market_swap" DROP COLUMN "marketBidId"')
    await queryRunner.query('ALTER TABLE "market_swap" DROP CONSTRAINT "UQ_c27294251ee1c5d9c03f95ddf24"')
    await queryRunner.query('ALTER TABLE "market_swap" DROP COLUMN "marketAskId"')
    await queryRunner.query('ALTER TABLE "market_swap" ADD "bidId" character varying')
    await queryRunner.query('ALTER TABLE "market_swap" ADD "askId" character varying NOT NULL')
  }

}

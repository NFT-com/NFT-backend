import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateMarketBid1647291325206 implements MigrationInterface {

  name = 'UpdateMarketBid1647291325206'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."market_bid_auctiontype_enum" AS ENUM(\'FixedPrice\', \'English\', \'Decreasing\')')
    await queryRunner.query('ALTER TABLE "market_bid" ADD "auctionType" "public"."market_bid_auctiontype_enum" NOT NULL')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "market_bid" DROP COLUMN "auctionType"')
    await queryRunner.query('DROP TYPE "public"."market_bid_auctiontype_enum"')
  }

}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddBuyNowTakerToMarketAsk1647259841026 implements MigrationInterface {

  name = 'AddBuyNowTakerToMarketAsk1647259841026'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "market_ask" ADD "buyNowTaker" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "market_ask" DROP COLUMN "buyNowTaker"')
  }

}

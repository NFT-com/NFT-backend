import { MigrationInterface, QueryRunner } from 'typeorm'

export class mpSalesUSDNull1663096782309 implements MigrationInterface {

  name = 'mpSalesUSDNull1663096782309'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "marketplace_sale" ALTER COLUMN "priceUSD" DROP NOT NULL')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "marketplace_sale" ALTER COLUMN "priceUSD" SET NOT NULL')
  }

}

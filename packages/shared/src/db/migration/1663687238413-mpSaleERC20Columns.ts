import { MigrationInterface, QueryRunner } from 'typeorm'

export class mpSaleERC20Columns1663687238413 implements MigrationInterface {

  name = 'mpSaleERC20Columns1663687238413'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "marketplace_sale" ADD "price" numeric')
    await queryRunner.query('ALTER TABLE "marketplace_sale" ADD "symbol" character varying NOT NULL DEFAULT \'\'')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "marketplace_sale" DROP COLUMN "symbol"')
    await queryRunner.query('ALTER TABLE "marketplace_sale" DROP COLUMN "price"')
  }

}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateMarketplaceSaleIndex1668024365731 implements MigrationInterface {

  name = 'updateMarketplaceSaleIndex1668024365731'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE INDEX "IDX_41c6c6f43e4ce665604d0b8318" ON "marketplace_sale" ("contractAddress", "date", "tokenId") ')
    await queryRunner.query('CREATE INDEX "IDX_16df044c9aaab6a6ec8da1b965" ON "marketplace_sale" ("contractAddress", "date") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_16df044c9aaab6a6ec8da1b965"')
    await queryRunner.query('DROP INDEX "public"."IDX_41c6c6f43e4ce665604d0b8318"')
  }

}

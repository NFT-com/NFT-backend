import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdatePriceNFTEntity1642536659070 implements MigrationInterface {

  name = 'UpdatePriceNFTEntity1642536659070'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" ALTER COLUMN "price" DROP NOT NULL')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" ALTER COLUMN "price" SET NOT NULL')
  }

}

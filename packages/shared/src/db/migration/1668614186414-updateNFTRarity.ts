import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateNFTRarity1668614186414 implements MigrationInterface {

  name = 'updateNFTRarity1668614186414'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" ADD "rarity" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "rarity"')
  }

}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateNFTEntity1662962774771 implements MigrationInterface {

  name = 'UpdateNFTEntity1662962774771'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" ADD "lastRefreshed" TIMESTAMP WITH TIME ZONE')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "lastRefreshed"')
  }

}

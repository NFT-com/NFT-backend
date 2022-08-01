import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateNFTEntity1658950521961 implements MigrationInterface {

  name = 'UpdateNFTEntity1658950521961'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" ADD "memo" character varying(2000)')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_list" ALTER COLUMN "consideration" SET NOT NULL')
  }

}

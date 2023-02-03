import { MigrationInterface, QueryRunner } from 'typeorm'

export class nftOwner1675346066023 implements MigrationInterface {

  name = 'nftOwner1675346066023'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" ADD "owner" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "owner"')
  }

}

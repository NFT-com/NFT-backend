import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateNFTEntity1661450639656 implements MigrationInterface {

  name = 'UpdateNFTEntity1661450639656'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" ADD "previewLink" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "previewLink"')
  }

}
